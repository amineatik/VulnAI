# main.py — VulnGuard AI Backend
# Lancer : uvicorn main:app --reload --port 8000

from fastapi import FastAPI, Depends, APIRouter, Query, HTTPException, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, field_validator
from routes.reports import router as reports_router

import bcrypt
import jwt
import logging
import httpx
import time
import re
import random
from sqlalchemy import or_

from database import init_db, get_db, SessionLocal
from config import settings
from models import Vulnerability, User, Scan

# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="VulnGuard AI — Backend API",
    version="2.0.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# AUTH HELPERS
# ============================================================

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: int, expires_hours: int = 168) -> str:
    expire = datetime.utcnow() + timedelta(hours=expires_hours)
    payload = {"sub": str(user_id), "exp": expire, "iat": datetime.utcnow()}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant")
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user


# ============================================================
# SCHEMAS
# ============================================================

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username minimum 3 caractères")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Mot de passe minimum 8 caractères")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


def vuln_to_dict(v: Vulnerability) -> Dict[str, Any]:
    try:
        score = float(v.cvss_score) if v.cvss_score else 0.0
    except:
        score = 0.0
    return {
        "id": v.id,
        "cve_id": v.cve_id or f"VULN-{v.id:05d}",
        "title": v.title or "Sans titre",
        "description": v.description or "",
        "severity": (v.severity or "UNKNOWN").upper(),
        "cvss_score": round(score, 1),
        "endpoint": v.endpoint or "",
        "status": v.status or "open",
        "remediation": getattr(v, "remediation", "") or "",
    }


# ============================================================
# SCAN BACKGROUND - UNIQUEMENT BASÉ SUR LE DATASET CVE
# ============================================================

def run_scan_background(scan_id: int, target_url: str, scan_type: str):
    """Scan intelligent basé UNIQUEMENT sur la base de données CVE"""
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            return
        
        scan.status = "running"
        scan.started_at = datetime.now()
        db.commit()
        print(f" Scan {scan_id} démarré sur {target_url}")
        
        time.sleep(2)
        
        # Extraire le domaine de l'URL
        domain = re.sub(r'^https?://', '', target_url)
        domain = domain.split('/')[0]
        
        # ============================================================
        # RECHERCHE DE VULNÉRABILITÉS DANS LE DATASET CVE
        # ============================================================
        
        # Mots-clés pour la recherche
        search_keywords = [
            "xss", "cross-site scripting", "cross site scripting", "injection",
            "sql", "sql injection", "csrf", "cross-site request",
            "ssrf", "server-side request", "authentication", "auth bypass",
            "rce", "remote code execution", "command injection",
            "lfi", "local file inclusion", "path traversal", "directory traversal",
            "xxe", "xml external entity", "information disclosure",
            "broken access control", "privilege escalation"
        ]
        
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        added_cves = set()
        vulnerabilities_to_add = []
        
        print(f"    Recherche dans la base CVE ({db.query(Vulnerability).count()} entrées)...")
        
        # Rechercher des CVEs par mots-clés
        for keyword in search_keywords:
            # Chercher dans la base
            cves = db.query(Vulnerability).filter(
                or_(
                    Vulnerability.title.ilike(f"%{keyword}%"),
                    Vulnerability.description.ilike(f"%{keyword}%")
                )
            ).limit(3).all()
            
            for cve in cves:
                if cve.cve_id and cve.cve_id in added_cves:
                    continue
                
                # Déterminer la sévérité réelle depuis la base
                severity = cve.severity.lower() if cve.severity else "medium"
                severity_counts[severity] = severity_counts.get(severity, 0) + 1
                
                vuln = Vulnerability(
                    scan_id=scan_id,
                    cve_id=cve.cve_id,
                    title=cve.title[:200],
                    description=cve.description[:500] if cve.description else f"Vulnérabilité détectée sur {domain}",
                    severity=severity,
                    cvss_score=cve.cvss_score,
                    endpoint=target_url,
                    remediation=cve.remediation if hasattr(cve, 'remediation') else "Consulter la documentation CVE",
                    status="open"
                )
                vulnerabilities_to_add.append(vuln)
                added_cves.add(cve.cve_id)
                
                print(f"  ✅ {cve.cve_id} - {cve.title[:60]}... ({severity})")
                
                # Limiter à 15 vulnérabilités maximum par scan
                if len(vulnerabilities_to_add) >= 15:
                    break
            
            if len(vulnerabilities_to_add) >= 15:
                break
        
        # Si aucune vulnérabilité trouvée, ajouter quelques CVEs aléatoires
        if len(vulnerabilities_to_add) == 0:
            print("   ⚠️ Aucune CVE trouvée par mot-clé, ajout de CVEs aléatoires...")
            random_cves = db.query(Vulnerability).order_by(Vulnerability.id).limit(5).all()
            for cve in random_cves:
                if cve.cve_id and cve.cve_id in added_cves:
                    continue
                severity = cve.severity.lower() if cve.severity else "medium"
                severity_counts[severity] = severity_counts.get(severity, 0) + 1
                vuln = Vulnerability(
                    scan_id=scan_id,
                    cve_id=cve.cve_id,
                    title=cve.title[:200],
                    description=cve.description[:500] if cve.description else f"Vulnérabilité potentielle sur {domain}",
                    severity=severity,
                    cvss_score=cve.cvss_score,
                    endpoint=target_url,
                    remediation=cve.remediation if hasattr(cve, 'remediation') else "Consulter la documentation CVE",
                    status="open"
                )
                vulnerabilities_to_add.append(vuln)
                added_cves.add(cve.cve_id)
                print(f"  ✅ {cve.cve_id} - {cve.title[:60]}... ({severity})")
        
        # Ajouter toutes les vulnérabilités à la base
        for vuln in vulnerabilities_to_add:
            db.add(vuln)
        
        # Calcul du score de sécurité (basé sur le nombre de vulns et leur sévérité)
        total_vulns = len(vulnerabilities_to_add)
        penalty = (severity_counts.get("critical", 0) * 15) + \
                  (severity_counts.get("high", 0) * 10) + \
                  (severity_counts.get("medium", 0) * 5)
        security_score = max(0, min(100, 100 - penalty))
        
        # Mettre à jour le scan
        scan.status = "completed"
        scan.completed_at = datetime.now()
        scan.security_score = security_score
        scan.critical_count = severity_counts.get("critical", 0)
        scan.high_count = severity_counts.get("high", 0)
        scan.medium_count = severity_counts.get("medium", 0)
        scan.low_count = severity_counts.get("low", 0)
        scan.info_count = 0
        
        db.commit()
        
        print(f"✅ Scan {scan_id} terminé")
        print(f"   Score: {security_score}%")
        print(f"   Vulnérabilités trouvées: {total_vulns}")
        print(f"   Détails: C:{severity_counts.get('critical',0)} H:{severity_counts.get('high',0)} M:{severity_counts.get('medium',0)} L:{severity_counts.get('low',0)}")
        
    except Exception as e:
        print(f"❌ Erreur scan {scan_id}: {e}")
        import traceback
        traceback.print_exc()
        try:
            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            if scan:
                scan.status = "failed"
                db.commit()
        except:
            pass
    finally:
        db.close()


# ============================================================
# AUTH ROUTER
# ============================================================

auth_router = APIRouter(prefix="/auth", tags=["Auth"])


@auth_router.post("/register", status_code=201)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Nom d'utilisateur déjà pris")

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role="user",
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Compte créé avec succès", "user_id": new_user.id}


@auth_router.post("/login", response_model=TokenResponse)
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Compte désactivé")

    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": user}


class ForgotPasswordBody(BaseModel):
    email: str

class ResetPasswordBody(BaseModel):
    token: str
    new_password: str

# Stockage temporaire des tokens de reset (en prod: Redis/DB)
_reset_tokens: dict = {}

@auth_router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    # Toujours répondre OK pour ne pas révéler si l'email existe
    if user:
        import secrets as _sec
        reset_token = _sec.token_urlsafe(32)
        _reset_tokens[reset_token] = {"user_id": user.id, "expires": datetime.now().timestamp() + 3600}
        # En production ici on enverrait un vrai email
        # Pour le dev : on log le token et on le retourne
        logger.info(f"[RESET] Token pour {body.email}: {reset_token}")
        return {
            "message": "Si cet email est enregistré, un lien a été envoyé.",
            "dev_token": reset_token,  # Seulement en développement !
            "reset_url": f"http://localhost:3000/reset-password?token={reset_token}"
        }
    return {"message": "Si cet email est enregistré, un lien a été envoyé."}

@auth_router.post("/reset-password")
async def reset_password(body: ResetPasswordBody, db: Session = Depends(get_db)):
    token_data = _reset_tokens.get(body.token)
    if not token_data:
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")
    if datetime.now().timestamp() > token_data["expires"]:
        del _reset_tokens[body.token]
        raise HTTPException(status_code=400, detail="Token expiré")
    user = db.query(User).filter(User.id == token_data["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    del _reset_tokens[body.token]
    return {"message": "Mot de passe mis à jour avec succès"}


# ============================================================
# SCANS ROUTER
# ============================================================

scans_router = APIRouter(prefix="/scans", tags=["Scans"])


@scans_router.get("/all")
async def get_all_scans(limit: int = Query(1000, ge=1, le=10000), db: Session = Depends(get_db)):
    """Tous les scans pour Attack Surface"""
    scans = db.query(Scan).order_by(Scan.created_at.desc()).limit(limit).all()
    return [
        {
            "id": s.id,
            "target_url": s.target_url,
            "scan_type": s.scan_type,
            "status": s.status,
            "security_score": s.security_score or 0,
            "critical_count": s.critical_count or 0,
            "high_count": s.high_count or 0,
            "medium_count": s.medium_count or 0,
            "low_count": s.low_count or 0,
            "user_id": s.user_id,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        }
        for s in scans
    ]


@scans_router.get("/")
async def get_scans_list(db: Session = Depends(get_db)):
    scans = db.query(Scan).order_by(Scan.created_at.desc()).all()
    return [
        {
            "id": s.id,
            "target_url": s.target_url,
            "scan_type": s.scan_type,
            "status": s.status,
            "security_score": s.security_score or 0,
            "critical_count": s.critical_count or 0,
            "high_count": s.high_count or 0,
            "medium_count": s.medium_count or 0,
            "low_count": s.low_count or 0,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        }
        for s in scans
    ]


class ScanCreateBody(BaseModel):
    target_url: str
    scan_type: str = "full"


@scans_router.post("/")
async def create_new_scan(
    body: ScanCreateBody,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    # Récupère l'user connecté depuis le token JWT, sinon prend le premier user dispo
    user_id = None
    if authorization and authorization.startswith("Bearer "):
        try:
            payload = decode_token(authorization.split(" ")[1])
            user_id = int(payload.get("sub", 0))
        except Exception:
            user_id = None
    if not user_id:
        first_user = db.query(User).first()
        user_id = first_user.id if first_user else 2

    url = body.target_url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    scan_type = body.scan_type or "full"
    new_scan = Scan(
        user_id=user_id,
        target_url=url,
        scan_type=scan_type,
        status="pending",
        created_at=datetime.now(),
        security_score=0,
        critical_count=0,
        high_count=0,
        medium_count=0,
        low_count=0,
        info_count=0
    )
    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)
    background_tasks.add_task(run_scan_background, new_scan.id, url, scan_type)
    return {
        "id": new_scan.id,
        "target_url": url,
        "scan_type": scan_type,
        "status": "pending",
        "security_score": 0,
        "critical_count": 0,
        "high_count": 0,
        "medium_count": 0,
        "low_count": 0,
        "info_count": 0,
        "created_at": new_scan.created_at.isoformat() if new_scan.created_at else None,
        "completed_at": None,
    }


@scans_router.get("/{scan_id}")
async def get_scan_by_id(scan_id: int, db: Session = Depends(get_db)):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan non trouvé")
    return {
        "id": scan.id,
        "target_url": scan.target_url,
        "scan_type": scan.scan_type,
        "status": scan.status,
        "security_score": scan.security_score or 0,
        "critical_count": scan.critical_count or 0,
        "high_count": scan.high_count or 0,
        "medium_count": scan.medium_count or 0,
        "low_count": scan.low_count or 0,
        "created_at": scan.created_at.isoformat() if scan.created_at else None,
        "completed_at": scan.completed_at.isoformat() if scan.completed_at else None,
    }


@scans_router.get("/{scan_id}/vulnerabilities")
async def get_scan_vulnerabilities(scan_id: int, db: Session = Depends(get_db)):
    vulns = db.query(Vulnerability).filter(Vulnerability.scan_id == scan_id).all()
    return [
        {
            "id": v.id,
            "cve_id": v.cve_id,
            "title": v.title,
            "description": v.description,
            "severity": v.severity,
            "cvss_score": v.cvss_score,
            "endpoint": v.endpoint,
            "remediation": v.remediation,
            "status": v.status,
        }
        for v in vulns
    ]


@scans_router.delete("/{scan_id}")
async def delete_scan_by_id(scan_id: int, db: Session = Depends(get_db)):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan non trouvé")
    db.query(Vulnerability).filter(Vulnerability.scan_id == scan_id).delete()
    db.delete(scan)
    db.commit()
    return {"message": f"Scan {scan_id} supprimé"}


# ============================================================
# VULNERABILITIES ROUTER
# ============================================================

vulns_router = APIRouter(prefix="/vulnerabilities", tags=["Vulnerabilities"])


@vulns_router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    total = db.query(Vulnerability).count()
    critical = db.query(Vulnerability).filter(Vulnerability.severity.ilike("critical")).count()
    high = db.query(Vulnerability).filter(Vulnerability.severity.ilike("high")).count()
    medium = db.query(Vulnerability).filter(Vulnerability.severity.ilike("medium")).count()
    low = db.query(Vulnerability).filter(Vulnerability.severity.ilike("low")).count()
    return {"total": total, "critical": critical, "high": high, "medium": medium, "low": low, "has_data": total > 0}


@vulns_router.get("/")
async def get_all_vulnerabilities(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=10000),
    db: Session = Depends(get_db),
):
    vulns = db.query(Vulnerability).offset(skip).limit(limit).all()
    return [vuln_to_dict(v) for v in vulns]


@vulns_router.get("/{vuln_id}")
async def get_vulnerability(vuln_id: int, db: Session = Depends(get_db)):
    vuln = db.query(Vulnerability).filter(Vulnerability.id == vuln_id).first()
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnérabilité introuvable")
    return vuln_to_dict(vuln)


# ============================================================
# AI ROUTER
# ============================================================

ai_router = APIRouter(prefix="/ai", tags=["AI"])


class ChatMessage(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []


def build_smart_response(message: str, db) -> str:
    """Génère une réponse intelligente basée sur la base CVE sans Ollama."""
    msg = message.lower().strip()

    # ── 1. Détection de l'intention ────────────────────────────────────────────
    is_remediation = any(w in msg for w in ["remédiation","remediation","corriger","fixer","réparer","mitiger","atténuer","patch","solution","résoudre"])
    is_explain     = any(w in msg for w in ["explique","c'est quoi","qu'est","définition","définir","comment fonctionne","qu'est-ce"])
    is_stats       = any(w in msg for w in ["statistique","combien","nombre","total","count","stats"])
    is_top         = any(w in msg for w in ["top","plus critique","les plus","pire","dangereux","critiques"])
    is_owasp       = "owasp" in msg
    is_xss         = any(w in msg for w in ["xss","cross-site scripting","cross site"])
    is_sql         = any(w in msg for w in ["sql injection","sql","sqli"])
    is_csrf        = "csrf" in msg
    is_cvss        = "cvss" in msg
    is_hardening   = any(w in msg for w in ["hardening","durcissement","sécuriser","serveur"])

    # ── 2. CVE ID direct (ex: CVE-2021-44228, NET-000001) ─────────────────────
    import re as _re
    cve_match = _re.search(r'(CVE-\d{4}-\d+|[A-Z]+-\d+)', message, _re.IGNORECASE)
    if cve_match:
        cve_id = cve_match.group(1).upper()
        vuln = db.query(Vulnerability).filter(Vulnerability.cve_id.ilike(cve_id)).first()
        if not vuln:
            vuln = db.query(Vulnerability).filter(Vulnerability.cve_id.ilike(f"%{cve_id}%")).first()
        if vuln:
            sev = (vuln.severity or "UNKNOWN").upper()
            score = vuln.cvss_score or "N/A"
            desc = vuln.description or "Aucune description disponible."
            rem  = vuln.remediation or "Consulter la documentation officielle CVE."
            return (
                f"## Analyse de {vuln.cve_id}\n\n"
                f"**Titre :** {vuln.title}\n\n"
                f"**Sévérité :** {sev} | **Score CVSS :** {score}\n\n"
                f"**Description :**\n{desc[:600]}\n\n"
                f"**Remédiation recommandée :**\n{rem[:500]}\n\n"
                f"**Statut actuel :** {(vuln.status or 'open').upper()}\n\n"
                f"---\n*Source : Base de données CVE VulnAI ({db.query(Vulnerability).count()} entrées)*"
            )

    # ── 3. Statistiques de la base ─────────────────────────────────────────────
    if is_stats:
        total    = db.query(Vulnerability).count()
        critical = db.query(Vulnerability).filter(Vulnerability.severity.ilike("critical")).count()
        high     = db.query(Vulnerability).filter(Vulnerability.severity.ilike("high")).count()
        medium   = db.query(Vulnerability).filter(Vulnerability.severity.ilike("medium")).count()
        low      = db.query(Vulnerability).filter(Vulnerability.severity.ilike("low")).count()
        scans    = db.query(Scan).count()
        return (
            f"## Statistiques de la base CVE VulnAI\n\n"
            f"| Sévérité | Nombre |\n|---|---|\n"
            f"| CRITICAL | {critical} |\n"
            f"| HIGH | {high} |\n"
            f"| MEDIUM | {medium} |\n"
            f"| LOW | {low} |\n"
            f"| **TOTAL** | **{total}** |\n\n"
            f"**Scans effectués :** {scans}\n\n"
            f"Votre score de sécurité moyen est calculé en temps réel à partir de ces données."
        )

    # ── 4. Top vulnérabilités critiques ────────────────────────────────────────
    if is_top:
        from sqlalchemy import func as sf
        top_vulns = db.query(Vulnerability).filter(
            Vulnerability.severity.ilike("critical")
        ).order_by(Vulnerability.cvss_score.desc()).limit(5).all()
        if not top_vulns:
            top_vulns = db.query(Vulnerability).order_by(Vulnerability.id.desc()).limit(5).all()
        lines = "\n".join([f"{i+1}. **{v.cve_id}** — {v.title[:80]} (CVSS: {v.cvss_score or 'N/A'})" for i,v in enumerate(top_vulns)])
        return (
            f"## Top 5 Vulnérabilités Critiques\n\n{lines}\n\n"
            f"Ces vulnérabilités ont le score CVSS le plus élevé dans votre base. "
            f"Priorisez leur correction en commençant par celles avec le score CVSS ≥ 9.0."
        )

    # ── 5. OWASP Top 10 ────────────────────────────────────────────────────────
    if is_owasp:
        return (
            "## OWASP Top 10 — 2021\n\n"
            "1. **A01 - Broken Access Control** — Contrôle d'accès défaillant\n"
            "2. **A02 - Cryptographic Failures** — Défaillances cryptographiques\n"
            "3. **A03 - Injection** — Injections SQL, NoSQL, OS, LDAP\n"
            "4. **A04 - Insecure Design** — Conception non sécurisée\n"
            "5. **A05 - Security Misconfiguration** — Mauvaise configuration\n"
            "6. **A06 - Vulnerable Components** — Composants vulnérables\n"
            "7. **A07 - Auth Failures** — Échecs d'identification\n"
            "8. **A08 - Software Integrity Failures** — Intégrité logicielle\n"
            "9. **A09 - Logging Failures** — Journalisation insuffisante\n"
            "10. **A10 - SSRF** — Falsification de requête côté serveur\n\n"
            "**Dans votre base CVE :**\n"
            + "\n".join([f"- {v.cve_id}: {v.title[:70]}" for v in db.query(Vulnerability).filter(
                Vulnerability.title.ilike("%injection%") | Vulnerability.title.ilike("%access control%")
            ).limit(3).all()])
        )

    # ── 6. XSS ─────────────────────────────────────────────────────────────────
    if is_xss:
        cves = db.query(Vulnerability).filter(
            Vulnerability.title.ilike("%xss%") | Vulnerability.title.ilike("%cross-site%") | Vulnerability.description.ilike("%cross-site scripting%")
        ).limit(4).all()
        cve_list = "\n".join([f"- **{v.cve_id}** : {v.title[:70]} (CVSS: {v.cvss_score})" for v in cves]) if cves else "- Aucune CVE XSS spécifique dans la base."
        return (
            "## Cross-Site Scripting (XSS)\n\n"
            "**Définition :** L'XSS permet à un attaquant d'injecter du code JavaScript malveillant dans une page web consultée par d'autres utilisateurs.\n\n"
            "**Types :**\n"
            "- **Réfléchi** : Le payload est dans l'URL\n"
            "- **Stocké** : Le payload est sauvegardé en base de données\n"
            "- **DOM-based** : Manipulation du DOM côté client\n\n"
            "**Remédiation :**\n"
            "1. Encoder toutes les sorties HTML (`htmlspecialchars`)\n"
            "2. Utiliser une Content Security Policy (CSP)\n"
            "3. Valider et assainir toutes les entrées utilisateur\n"
            "4. Utiliser des frameworks avec protection XSS intégrée\n\n"
            f"**CVE XSS dans votre base :**\n{cve_list}"
        )

    # ── 7. SQL Injection ───────────────────────────────────────────────────────
    if is_sql:
        cves = db.query(Vulnerability).filter(
            Vulnerability.title.ilike("%sql%") | Vulnerability.description.ilike("%sql injection%")
        ).limit(4).all()
        cve_list = "\n".join([f"- **{v.cve_id}** : {v.title[:70]} (CVSS: {v.cvss_score})" for v in cves]) if cves else "- Aucune CVE SQL spécifique."
        return (
            "## SQL Injection\n\n"
            "**Définition :** Injection de requêtes SQL malveillantes via des entrées non validées, permettant d'accéder ou modifier la base de données.\n\n"
            "**Remédiation :**\n"
            "1. Utiliser des requêtes préparées (prepared statements)\n"
            "2. Employer un ORM (SQLAlchemy, Hibernate)\n"
            "3. Valider et assainir toutes les entrées\n"
            "4. Principe du moindre privilège pour les comptes BD\n"
            "5. Web Application Firewall (WAF)\n\n"
            f"**CVE SQL dans votre base :**\n{cve_list}"
        )

    # ── 8. CSRF ────────────────────────────────────────────────────────────────
    if is_csrf:
        return (
            "## CSRF — Cross-Site Request Forgery\n\n"
            "**Définition :** Force un utilisateur authentifié à effectuer des actions non désirées sur une application web.\n\n"
            "**Remédiation :**\n"
            "1. Implémenter des tokens CSRF synchronisés\n"
            "2. Vérifier l'en-tête `Origin` et `Referer`\n"
            "3. Utiliser le cookie `SameSite=Strict`\n"
            "4. Double-submit cookie pattern\n"
            "5. Re-authentification pour les actions sensibles\n\n"
            "**Frameworks :** Django, Laravel, Spring Security intègrent la protection CSRF automatiquement."
        )

    # ── 9. CVSS ────────────────────────────────────────────────────────────────
    if is_cvss:
        return (
            "## Score CVSS (Common Vulnerability Scoring System)\n\n"
            "Le CVSS est le standard industrie pour mesurer la sévérité des vulnérabilités.\n\n"
            "| Score | Sévérité |\n|---|---|\n"
            "| 0.0 | None |\n| 0.1 – 3.9 | Low |\n| 4.0 – 6.9 | Medium |\n| 7.0 – 8.9 | High |\n| 9.0 – 10.0 | Critical |\n\n"
            "**Métriques CVSS v3 :**\n"
            "- **AV** : Vecteur d'attaque (Network, Adjacent, Local, Physical)\n"
            "- **AC** : Complexité d'attaque (Low / High)\n"
            "- **PR** : Privilèges requis\n"
            "- **UI** : Interaction utilisateur\n"
            "- **C/I/A** : Confidentialité / Intégrité / Disponibilité\n\n"
            f"**Dans votre base :** score moyen des vulnérabilités critiques disponible dans `/dashboard/stats`"
        )

    # ── 10. Hardening serveur ──────────────────────────────────────────────────
    if is_hardening:
        return (
            "## Hardening Serveur — Bonnes Pratiques\n\n"
            "**Headers HTTP de sécurité :**\n"
            "```\nStrict-Transport-Security: max-age=31536000; includeSubDomains\n"
            "X-Frame-Options: DENY\nX-Content-Type-Options: nosniff\n"
            "Content-Security-Policy: default-src 'self'\nPermissions-Policy: geolocation=()\n```\n\n"
            "**SSL/TLS :**\n"
            "- Désactiver TLS 1.0 et TLS 1.1\n"
            "- Utiliser TLS 1.3 en priorité\n"
            "- Certificats Let's Encrypt (renouvellement auto)\n\n"
            "**Serveur :**\n"
            "- Masquer les versions (Server header)\n"
            "- Désactiver les services inutiles\n"
            "- Firewall + fail2ban\n"
            "- Mises à jour automatiques de sécurité\n"
            "- Audit logs activés"
        )

    # ── 11. Remédiation générale ───────────────────────────────────────────────
    if is_remediation:
        keywords = [w for w in msg.split() if len(w) > 3]
        cves = []
        for kw in keywords[:4]:
            found = db.query(Vulnerability).filter(
                Vulnerability.title.ilike(f"%{kw}%") | Vulnerability.description.ilike(f"%{kw}%")
            ).limit(3).all()
            cves.extend(found)
        cves = list({v.cve_id: v for v in cves if v.cve_id}.values())[:5]
        if cves:
            lines = []
            for v in cves:
                rem = v.remediation or "Appliquer les patchs de sécurité disponibles"
                lines.append(f"### {v.cve_id} — {v.title[:60]}\n**Sévérité :** {v.severity.upper()} | CVSS: {v.cvss_score}\n\n{rem[:300]}")
            return (
                f"## Plan de Remédiation\n\n"
                + "\n\n---\n\n".join(lines)
                + "\n\n---\n*Recommandation : Priorisez par ordre de sévérité CVSS décroissant.*"
            )

    # ── 12. Recherche générale dans la base CVE ────────────────────────────────
    keywords = [w for w in msg.split() if len(w) > 3 and w not in {"pour","avec","dans","comment","quelles","quels","sont","les","des","une","que"}]
    cves_found = []
    for kw in keywords[:5]:
        found = db.query(Vulnerability).filter(
            Vulnerability.title.ilike(f"%{kw}%") | Vulnerability.description.ilike(f"%{kw}%")
        ).limit(3).all()
        cves_found.extend(found)

    unique = list({v.id: v for v in cves_found}.values())[:6]

    if unique:
        lines = [f"- **{v.cve_id}** ({v.severity.upper()}, CVSS {v.cvss_score}) : {v.title[:80]}" for v in unique]
        return (
            f"## Résultats pour : *{message[:60]}*\n\n"
            f"J'ai trouvé **{len(unique)} vulnérabilité(s)** correspondante(s) dans votre base CVE :\n\n"
            + "\n".join(lines)
            + "\n\nPour une analyse détaillée, cliquez sur une vulnérabilité dans la liste de gauche, ou demandez-moi : *'Analyse CVE-XXXX-YYYY'*"
        )

    # ── 13. Fallback avec contexte ─────────────────────────────────────────────
    total = db.query(Vulnerability).count()
    return (
        f"Je suis l'assistant IA de VulnAI, spécialisé en cybersécurité.\n\n"
        f"Votre base contient **{total} vulnérabilités CVE**. Je peux vous aider à :\n\n"
        "- Analyser un CVE spécifique : *'Analyse CVE-2021-44228'*\n"
        "- Expliquer une attaque : *'Explique XSS'*, *'SQL Injection'*, *'CSRF'*\n"
        "- Voir les plus critiques : *'Top vulnérabilités critiques'*\n"
        "- Statistiques : *'Statistiques de la base'*\n"
        "- Remédiation : *'Remédiation pour Insider Threat'*\n"
        "- Hardening : *'Comment sécuriser un serveur'*\n\n"
        f"*Question posée : « {message} »*"
    )


@ai_router.post("/chat")
async def ai_chat(data: ChatMessage, db: Session = Depends(get_db)):
    message = data.message

    # ── Contexte CVE court (max 3 CVE, 100 chars chacun) ─────────────────────
    cve_context = ""
    try:
        import re as _re
        cve_match = _re.search(r'(CVE-\d{4}-\d+|[A-Z]{2,}-\d+)', message, _re.IGNORECASE)
        cves_found = []
        if cve_match:
            cid = cve_match.group(1).upper()
            v = db.query(Vulnerability).filter(Vulnerability.cve_id.ilike(f"%{cid}%")).first()
            if v:
                cves_found = [v]
        if not cves_found:
            keywords = [w for w in message.lower().split() if len(w) > 4
                        and w not in {"pour","avec","dans","comment","quelles","quels",
                                      "sont","les","des","une","que","est","quel","cette"}]
            for kw in keywords[:3]:
                found = db.query(Vulnerability).filter(
                    Vulnerability.title.ilike(f"%{kw}%")
                ).limit(2).all()
                cves_found.extend(found)
        unique = list({v.id: v for v in cves_found}.values())[:3]
        if unique:
            lines = [f"- {v.cve_id} ({v.severity.upper()}, CVSS {v.cvss_score}): {v.title[:80]}" for v in unique]
            cve_context = "\nCVE dans la base: " + "; ".join([v.cve_id for v in unique])
    except Exception:
        pass

    # ── Prompt compact ────────────────────────────────────────────────────────
    full_prompt = (
        f"Tu es VulnGuard AI, expert cybersécurité. Réponds en français, sois concis et structuré (titres, listes). "
        f"{cve_context}\n\n"
        f"Question: {message}\n\nRéponse:"
    )

    # ── Appel Ollama ──────────────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": 500,
                        "top_p": 0.9,
                        "stop": ["Question:", "Human:", "User:"]
                    }
                }
            )
        if response.status_code == 200:
            text = response.json().get("response", "").strip()
            if text and len(text) > 20:
                return {"response": text, "success": True, "engine": "ollama"}
    except Exception:
        pass

    # ── Fallback : moteur CVE DB local ────────────────────────────────────────
    smart_response = build_smart_response(message, db)
    return {"response": smart_response, "success": True, "engine": "cve_db"}


GREETINGS = {
    "bonjour","salut","hello","hi","bonsoir","hey","coucou","yo","slt","bjr",
    "bonjour!","salut!","hello!","bonsoir!","salam","marhba","ahlan",
}

SMALL_TALK = {
    "comment tu vas","comment vas-tu","ca va","ça va","tu vas bien","comment tu t'appelles",
    "qui es-tu","tu es quoi","c'est quoi ton nom","tu es une ia","tu es une intelligence",
    "tu peux m'aider","aide moi","help","merci","thank you","thanks","de rien",
    "au revoir","bye","a bientot","bonne journee","bonne nuit",
}

def is_greeting(msg: str) -> bool:
    m = msg.lower().strip().rstrip("!?.").strip()
    if m in GREETINGS:
        return True
    words = m.split()
    if len(words) <= 2 and words[0] in GREETINGS:
        return True
    return False

def is_small_talk(msg: str) -> bool:
    m = msg.lower().strip()
    return any(phrase in m for phrase in SMALL_TALK)

def is_security_question(msg: str) -> bool:
    """Détermine si la question est liée à la cybersécurité."""
    security_words = {
        "cve","cvss","xss","sql","csrf","ssrf","rce","lfi","xxe","injection",
        "vulnérabilité","vulnerability","vuln","exploit","attaque","attack",
        "sécurité","security","malware","ransomware","phishing","hack","hacker",
        "patch","remédiation","remediation","pentest","scan","owasp","firewall",
        "authentification","auth","token","jwt","ssl","tls","https","chiffrement",
        "cryptographie","payload","reverse shell","buffer overflow","zero day",
        "insider","threat","ddos","botnet","backdoor","rootkit","spyware",
        "hardening","durcissement","audit","compliance","nist","iso27001",
    }
    m = msg.lower()
    import re as _re
    if _re.search(r'CVE-\d{4}-\d+|NET-\d+|[A-Z]{2,}-\d+', msg, _re.IGNORECASE):
        return True
    return any(w in m for w in security_words)


@ai_router.post("/chat/stream")
async def ai_chat_stream(data: ChatMessage, db: Session = Depends(get_db)):
    """Streaming SSE — affiche les tokens au fur et à mesure"""
    message = data.message
    import json as _json

    # ── Salutation simple → réponse directe sans contexte CVE ────────────────
    if is_greeting(message):
        try:
            total = db.query(Vulnerability).count()
        except Exception:
            total = 0
        greeting_prompt = (
            f"Tu es VulnGuard AI. L'utilisateur dit : '{message}'. "
            f"Réponds UNIQUEMENT par une salutation chaleureuse en français, "
            f"présente-toi en une phrase (ex: 'Bonjour ! Je suis VulnGuard AI, ton assistant cybersécurité.'), "
            f"et demande comment tu peux aider. "
            f"NE parle PAS de CVE, de vulnérabilités ou de cybersécurité en détail. "
            f"Maximum 2 phrases courtes. Réponse:"
        )
        async def greet_gen():
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    async with client.stream("POST", f"{settings.OLLAMA_URL}/api/generate",
                        json={"model": settings.OLLAMA_MODEL, "prompt": greeting_prompt, "stream": True,
                              "options": {"temperature": 0.7, "num_predict": 60, "stop": ["\n\n", "CVE", "vulnérabilité"]}}) as resp:
                        if resp.status_code == 200:
                            async for line in resp.aiter_lines():
                                if line:
                                    try:
                                        c = _json.loads(line)
                                        t = c.get("response", "")
                                        if t:
                                            yield f"data: {_json.dumps({'token': t, 'done': False})}\n\n"
                                        if c.get("done"):
                                            yield f"data: {_json.dumps({'token': '', 'done': True, 'engine': 'ollama'})}\n\n"
                                            return
                                    except Exception:
                                        continue
            except Exception:
                pass
            fallback = f"Bonjour ! Je suis **VulnGuard AI**, votre assistant cybersécurité.\n\nJe suis prêt à analyser des vulnérabilités CVE, expliquer des attaques et proposer des remédiations.\n\nVotre base contient **{total} CVE**. Comment puis-je vous aider ?"
            for chunk in [fallback[i:i+30] for i in range(0, len(fallback), 30)]:
                yield f"data: {_json.dumps({'token': chunk, 'done': False})}\n\n"
            yield f"data: {_json.dumps({'token': '', 'done': True, 'engine': 'cve_db'})}\n\n"
        return StreamingResponse(greet_gen(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    # ── Small talk (merci, au revoir...) ──────────────────────────────────────
    if is_small_talk(message) and not is_security_question(message):
        async def small_talk_gen():
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    async with client.stream("POST", f"{settings.OLLAMA_URL}/api/generate",
                        json={"model": settings.OLLAMA_MODEL,
                              "prompt": f"Tu es VulnGuard AI, assistant cybersécurité. Réponds naturellement en français à : '{message}'. Sois bref et amical. Réponse:",
                              "stream": True, "options": {"temperature": 0.8, "num_predict": 100}}) as resp:
                        if resp.status_code == 200:
                            async for line in resp.aiter_lines():
                                if line:
                                    try:
                                        c = _json.loads(line)
                                        t = c.get("response", "")
                                        if t:
                                            yield f"data: {_json.dumps({'token': t, 'done': False})}\n\n"
                                        if c.get("done"):
                                            yield f"data: {_json.dumps({'token': '', 'done': True, 'engine': 'ollama'})}\n\n"
                                            return
                                    except Exception:
                                        continue
            except Exception:
                pass
            yield f"data: {_json.dumps({'token': 'Je suis là pour vous aider !', 'done': False})}\n\n"
            yield f"data: {_json.dumps({'token': '', 'done': True, 'engine': 'cve_db'})}\n\n"
        return StreamingResponse(small_talk_gen(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    # ── Question cybersécurité → contexte CVE ─────────────────────────────────
    cve_context = ""
    try:
        import re as _re
        cve_match = _re.search(r'(CVE-\d{4}-\d+|[A-Z]{2,}-\d+)', message, _re.IGNORECASE)
        cves_found = []
        if cve_match:
            cid = cve_match.group(1).upper()
            v = db.query(Vulnerability).filter(Vulnerability.cve_id.ilike(f"%{cid}%")).first()
            if v:
                cves_found = [v]
        if not cves_found and is_security_question(message):
            keywords = [w for w in message.lower().split() if len(w) > 4
                        and w not in {"pour","avec","dans","comment","quelles","quels",
                                      "sont","les","des","une","que","est","quel","cette"}]
            for kw in keywords[:2]:
                found = db.query(Vulnerability).filter(
                    Vulnerability.title.ilike(f"%{kw}%")
                ).limit(2).all()
                cves_found.extend(found)
        unique = list({v.id: v for v in cves_found}.values())[:3]
        if unique:
            cve_context = "\nCVE pertinentes dans la base: " + ", ".join([f"{v.cve_id} ({v.severity.upper()})" for v in unique])
    except Exception:
        pass

    full_prompt = (
        f"Tu es VulnGuard AI, expert cybersécurité. Réponds en français, sois concis et structuré (titres, listes)."
        f"{cve_context}\n\nQuestion: {message}\n\nRéponse:"
    )

    import json as _json

    async def event_generator():
        try:
            async with httpx.AsyncClient(timeout=90) as client:
                async with client.stream(
                    "POST",
                    f"{settings.OLLAMA_URL}/api/generate",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "prompt": full_prompt,
                        "stream": True,
                        "options": {"temperature": 0.7, "num_predict": 500, "top_p": 0.9}
                    }
                ) as resp:
                    if resp.status_code == 200:
                        async for line in resp.aiter_lines():
                            if line:
                                try:
                                    chunk = _json.loads(line)
                                    token = chunk.get("response", "")
                                    done  = chunk.get("done", False)
                                    if token:
                                        yield f"data: {_json.dumps({'token': token, 'done': False})}\n\n"
                                    if done:
                                        yield f"data: {_json.dumps({'token': '', 'done': True, 'engine': 'ollama'})}\n\n"
                                        return
                                except Exception:
                                    continue
        except Exception:
            pass
        # Fallback CVE DB
        fallback = build_smart_response(message, db)
        for chunk in [fallback[i:i+40] for i in range(0, len(fallback), 40)]:
            yield f"data: {_json.dumps({'token': chunk, 'done': False})}\n\n"
        yield f"data: {_json.dumps({'token': '', 'done': True, 'engine': 'cve_db'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@ai_router.get("/health")
async def ai_health():
    ollama_ok = False
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{settings.OLLAMA_URL}/api/tags")
            ollama_ok = r.status_code == 200
    except Exception:
        pass
    return {
        "status": "ok",
        "ollama_configured": True,
        "ollama_available": ollama_ok,
        "engine": "ollama" if ollama_ok else "cve_db",
        "message": "Ollama disponible" if ollama_ok else "Mode CVE DB — réponses intelligentes sans Ollama"
    }


# ============================================================
# ROUTES API
# ============================================================

@app.get("/api/notifications")
async def get_notifications(db: Session = Depends(get_db)):
    vulns = db.query(Vulnerability).filter(
        Vulnerability.severity.in_(["critical", "high"])
    ).order_by(Vulnerability.created_at.desc()).limit(8).all()
    notifs = []
    for i, v in enumerate(vulns):
        sev = (v.severity or "info").lower()
        notif_type = "critical" if sev == "critical" else ("warning" if sev == "high" else "info")
        notifs.append({
            "id": v.id,
            "message": v.title,
            "type": notif_type,
            "time": v.created_at.strftime("%H:%M") if v.created_at else "—",
            "read": i > 2,
            "category": sev.upper(),
        })
    return notifs


@app.get("/api/reports")
async def get_reports(limit: int = 5, db: Session = Depends(get_db)):
    scans = db.query(Scan).order_by(Scan.created_at.desc()).limit(limit).all()
    return [{"id": s.id, "title": s.target_url, "type": "scan"} for s in scans]


@app.get("/api/scans")
async def get_scans_api(limit: int = 5, db: Session = Depends(get_db)):
    scans = db.query(Scan).order_by(Scan.created_at.desc()).limit(limit).all()
    return [{"id": s.id, "target_url": s.target_url, "status": s.status} for s in scans]


# ============================================================
# USERS ROUTER (Team page)
# ============================================================

users_router = APIRouter(prefix="/users", tags=["Users"])


class UserUpdateBody(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserInviteBody(BaseModel):
    email: str
    role: str = "user"


@users_router.get("/")
async def list_users(db: Session = Depends(get_db)):
    """Liste tous les utilisateurs avec leurs stats"""
    users = db.query(User).all()
    result = []
    for u in users:
        scans_count = db.query(Scan).filter(Scan.user_id == u.id).count()
        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "scans_count": scans_count,
            "vulns_fixed": 0,
            "last_active": u.updated_at.isoformat() if u.updated_at else (u.created_at.isoformat() if u.created_at else None),
        })
    return result


@users_router.patch("/{user_id}")
async def update_user(user_id: int, body: UserUpdateBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if body.username is not None:
        user.username = body.username
    if body.email is not None:
        user.email = body.email
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "email": user.email, "role": user.role, "is_active": user.is_active}


@users_router.delete("/{user_id}")
async def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    db.delete(user)
    db.commit()
    return {"message": f"Utilisateur {user_id} supprimé"}


@users_router.post("/invite")
async def invite_user(body: UserInviteBody, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    username = body.email.split("@")[0]
    base = username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base}{counter}"
        counter += 1
    new_user = User(
        username=username,
        email=body.email,
        hashed_password=hash_password("ChangeMe123!"),
        role=body.role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": f"Utilisateur {body.email} créé", "user_id": new_user.id, "temp_password": "ChangeMe123!"}


# ============================================================
# DASHBOARD ROUTER
# ============================================================

dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@dashboard_router.get("/stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    total_scans = db.query(Scan).count()
    total_vulns = db.query(Vulnerability).filter(Vulnerability.scan_id.isnot(None)).count()
    all_vulns   = db.query(Vulnerability).count()
    critical    = db.query(Vulnerability).filter(Vulnerability.severity.ilike("critical")).count()
    high        = db.query(Vulnerability).filter(Vulnerability.severity.ilike("high")).count()
    medium      = db.query(Vulnerability).filter(Vulnerability.severity.ilike("medium")).count()
    low         = db.query(Vulnerability).filter(Vulnerability.severity.ilike("low")).count()
    from sqlalchemy import func as sqlfunc
    avg_score   = db.query(sqlfunc.avg(Scan.security_score)).filter(Scan.security_score.isnot(None)).scalar()
    recent_scans = db.query(Scan).order_by(Scan.created_at.desc()).limit(5).all()
    return {
        "total_scans": total_scans,
        "total_vulnerabilities": all_vulns,
        "critical_count": critical,
        "high_count": high,
        "medium_count": medium,
        "low_count": low,
        "average_security_score": round(float(avg_score), 1) if avg_score else None,
        "recent_scans": [
            {
                "id": s.id,
                "target_url": s.target_url,
                "scan_type": s.scan_type,
                "status": s.status,
                "security_score": s.security_score,
                "critical_count": s.critical_count or 0,
                "high_count": s.high_count or 0,
                "medium_count": s.medium_count or 0,
                "low_count": s.low_count or 0,
                "info_count": s.info_count or 0,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            }
            for s in recent_scans
        ],
    }


# ============================================================
# INCLUDE ROUTERS
# ============================================================

app.include_router(auth_router)
app.include_router(vulns_router)
app.include_router(scans_router)
app.include_router(ai_router)
app.include_router(reports_router)
app.include_router(users_router)
app.include_router(dashboard_router)


# ============================================================
# ROOT ROUTES
# ============================================================

@app.get("/")
async def root():
    return {"name": "VulnGuard AI", "version": "2.0.0", "status": "online", "docs": "/docs"}


@app.get("/health")
async def health(db: Session = Depends(get_db)):
    return {"status": "healthy", "database": "connected", "vulnerabilities": db.query(Vulnerability).count()}


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
async def startup_event():
    logger.info(" VulnGuard AI Backend démarré")
    try:
        init_db()
        db = SessionLocal()
        logger.info(f" {db.query(Vulnerability).count()} vulnérabilités en base")
        db.close()
    except Exception as e:
        logger.error(f"❌ Erreur startup: {e}")


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)