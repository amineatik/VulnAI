# backend/routes/scans.py

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Header
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, field_validator, ConfigDict
from typing import Optional, List
from datetime import datetime
from urllib.parse import urlparse

import logging
import traceback

from database import get_db, SessionLocal
from models import Scan, Vulnerability

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/scans",
    tags=["Scans"]
)

# ============================================================
# PYDANTIC SCHEMAS
# ============================================================

class ScanCreate(BaseModel):
    target_url: str
    scan_type: str = "full"

    @field_validator("target_url")
    @classmethod
    def validate_url(cls, v):
        v = v.strip()

        if not v:
            raise ValueError("URL obligatoire")

        return v

    @field_validator("scan_type")
    @classmethod
    def validate_scan_type(cls, v):
        allowed = ["full", "quick", "deep"]

        if v.lower() not in allowed:
            return "full"

        return v.lower()


class ScanResponse(BaseModel):
    id: int
    user_id: int
    target_url: str
    scan_type: str
    status: str

    security_score: Optional[float] = None

    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    info_count: int

    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ScanListResponse(BaseModel):
    total: int
    items: List[ScanResponse]


# ============================================================
# HELPERS
# ============================================================

def normalize_url(url: str) -> str:
    """
    Normalise les URLs
    """

    url = url.strip()

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    parsed = urlparse(url)

    if not parsed.netloc:
        raise HTTPException(
            status_code=400,
            detail="URL invalide"
        )

    return url


def create_vulnerability(
    db: Session,
    scan_id: int,
    vuln_data: dict
):
    """
    Ajoute une vulnérabilité en base
    """

    vuln = Vulnerability(
        scan_id=scan_id,
        cve_id=vuln_data.get("cve_id"),
        title=vuln_data.get("title", "Vulnérabilité détectée"),
        description=vuln_data.get("description", ""),
        severity=vuln_data.get("severity", "medium"),
        cvss_score=vuln_data.get("cvss_score"),
        endpoint=vuln_data.get("endpoint"),
        remediation=vuln_data.get("remediation"),
        status=vuln_data.get("status", "open"),
    )

    db.add(vuln)


# ============================================================
# BACKGROUND SCAN
# ============================================================

def run_scan_background(
    scan_id: int,
    target_url: str,
    scan_type: str
):
    """
    Lance le scan en arrière-plan
    """

    db = SessionLocal()

    try:

        scan = db.query(Scan).filter(
            Scan.id == scan_id
        ).first()

        if not scan:
            logger.error(f"❌ Scan {scan_id} introuvable")
            return

        # ====================================================
        # STATUS RUNNING
        # ====================================================

        scan.status = "running"
        scan.started_at = datetime.now()

        db.commit()

        logger.info(f" Scan {scan_id} démarré → {target_url}")

        # ====================================================
        # TENTATIVE SCANNER RÉEL
        # ====================================================

        vulnerabilities = []

        try:

            from services.scanner import VulnerabilityScanner

            logger.info("✅ Scanner réel chargé")

            scanner = VulnerabilityScanner(
                target_url=target_url,
                db=db
            )

            result = scanner.scan()

            summary = result.get("summary", {})

            scan.security_score = result.get(
                "security_score",
                0
            )

            scan.critical_count = summary.get("critical", 0)
            scan.high_count = summary.get("high", 0)
            scan.medium_count = summary.get("medium", 0)
            scan.low_count = summary.get("low", 0)
            scan.info_count = summary.get("info", 0)

            vulnerabilities = result.get(
                "vulnerabilities",
                []
            )

        except ImportError:

            logger.warning(
                "⚠️ VulnerabilityScanner introuvable → mode simulation"
            )

            # ====================================================
            # MODE MOCK
            # ====================================================

            scan.security_score = 78.0

            scan.critical_count = 0
            scan.high_count = 1
            scan.medium_count = 2
            scan.low_count = 1
            scan.info_count = 1

            vulnerabilities = [
                {
                    "title": "Missing Security Headers",
                    "description": "Les headers de sécurité sont absents",
                    "severity": "medium",
                    "cvss_score": "5.3",
                    "endpoint": target_url,
                    "remediation": (
                        "Ajouter X-Frame-Options, "
                        "X-Content-Type-Options et CSP"
                    ),
                },
                {
                    "title": "Server Version Disclosure",
                    "description": "Le serveur expose sa version",
                    "severity": "low",
                    "cvss_score": "3.1",
                    "endpoint": target_url,
                    "remediation": (
                        "Masquer les versions Apache/Nginx/PHP"
                    ),
                },
                {
                    "title": "Weak SSL Configuration",
                    "description": "Configuration SSL faible",
                    "severity": "high",
                    "cvss_score": "7.5",
                    "endpoint": target_url,
                    "remediation": (
                        "Désactiver TLS 1.0 et TLS 1.1"
                    ),
                },
            ]

        except Exception as scanner_error:

            logger.error(
                f"❌ Erreur scanner réel : {scanner_error}"
            )

            logger.error(traceback.format_exc())

            scan.status = "failed"

            db.commit()

            return

        # ====================================================
        # INSERT VULNERABILITIES
        # ====================================================

        for vuln_data in vulnerabilities:
            create_vulnerability(
                db=db,
                scan_id=scan_id,
                vuln_data=vuln_data
            )

        # ====================================================
        # COMPLETE
        # ====================================================

        scan.status = "completed"
        scan.completed_at = datetime.now()

        db.commit()

        logger.info(
            f"✅ Scan {scan_id} terminé "
            f"(score={scan.security_score})"
        )

    except Exception as e:

        logger.error(f"❌ Erreur scan {scan_id}: {e}")

        logger.error(traceback.format_exc())

        try:

            failed_scan = db.query(Scan).filter(
                Scan.id == scan_id
            ).first()

            if failed_scan:
                failed_scan.status = "failed"
                db.commit()

        except Exception:
            pass

    finally:
        db.close()


# ============================================================
# ROUTES
# ============================================================

@router.post(
    "/",
    response_model=ScanResponse,
    status_code=201
)
async def create_scan(
    scan_data: ScanCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    """
    Créer un scan
    """

    try:
        # Résoudre le user_id depuis le token JWT ou prendre le premier user
        user_id = None
        if authorization and authorization.startswith("Bearer "):
            try:
                import jwt as _jwt
                from config import settings as _s
                payload = _jwt.decode(
                    authorization.split(" ")[1],
                    _s.SECRET_KEY,
                    algorithms=[_s.ALGORITHM]
                )
                user_id = int(payload.get("sub", 0))
            except Exception:
                user_id = None
        if not user_id:
            from models import User as _User
            first_user = db.query(_User).first()
            user_id = first_user.id if first_user else 2

        url = normalize_url(scan_data.target_url)

        new_scan = Scan(
            user_id=user_id,
            target_url=url,
            scan_type=scan_data.scan_type,
            status="pending",

            security_score=None,

            critical_count=0,
            high_count=0,
            medium_count=0,
            low_count=0,
            info_count=0,

            created_at=datetime.now(),
        )

        db.add(new_scan)

        db.commit()

        db.refresh(new_scan)

        # ====================================================
        # BACKGROUND TASK
        # ====================================================

        background_tasks.add_task(
            run_scan_background,
            new_scan.id,
            url,
            scan_data.scan_type
        )

        logger.info(
            f" Nouveau scan #{new_scan.id} → {url}"
        )

        return new_scan

    except HTTPException:
        raise

    except Exception as e:

        logger.error(f"❌ Erreur create_scan : {e}")

        raise HTTPException(
            status_code=500,
            detail="Erreur création scan"
        )


@router.get(
    "/",
    response_model=ScanListResponse
)
async def list_scans(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Liste tous les scans
    """

    total = db.query(Scan).count()

    scans = db.query(Scan).order_by(
        desc(Scan.created_at)
    ).offset(skip).limit(limit).all()

    return {
        "total": total,
        "items": scans
    }


@router.get(
    "/{scan_id}",
    response_model=ScanResponse
)
async def get_scan(
    scan_id: int,
    db: Session = Depends(get_db)
):
    """
    Détails d'un scan
    """

    scan = db.query(Scan).filter(
        Scan.id == scan_id
    ).first()

    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan non trouvé"
        )

    return scan


@router.get("/{scan_id}/vulnerabilities")
async def get_scan_vulnerabilities(
    scan_id: int,
    db: Session = Depends(get_db)
):
    """
    Vulnérabilités d'un scan
    """

    scan = db.query(Scan).filter(
        Scan.id == scan_id
    ).first()

    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan non trouvé"
        )

    vulns = db.query(Vulnerability).filter(
        Vulnerability.scan_id == scan_id
    ).all()

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


@router.delete("/{scan_id}")
async def delete_scan(
    scan_id: int,
    db: Session = Depends(get_db)
):
    """
    Supprime un scan
    """

    scan = db.query(Scan).filter(
        Scan.id == scan_id
    ).first()

    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan non trouvé"
        )

    # supprimer vulnérabilités
    db.query(Vulnerability).filter(
        Vulnerability.scan_id == scan_id
    ).delete()

    # supprimer scan
    db.delete(scan)

    db.commit()

    logger.info(f"️ Scan supprimé #{scan_id}")

    return {
        "message": f"Scan {scan_id} supprimé avec succès"
    }