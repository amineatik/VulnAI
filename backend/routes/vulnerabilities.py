# backend/routes/vulnerabilities.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from database import get_db
from models import Vulnerability, Scan, User
from routes.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vulnerabilities", tags=["Vulnerabilities"])


# ============================================================
# ENDPOINTS PUBLICS — consultation sans authentification
# ============================================================

@router.get("/stats")
async def get_vulnerability_stats(db: Session = Depends(get_db)):
    """Statistiques globales par sévérité."""
    total = db.query(Vulnerability).count()

    def count(sev): return db.query(Vulnerability).filter(Vulnerability.severity == sev).count()

    critical, high, medium, low = count("critical"), count("high"), count("medium"), count("low")

    result = {
        "total": total,
        "critical": critical,
        "high": high,
        "medium": medium,
        "low": low,
        "has_data": total > 0,
    }

    if total > 0:
        result["critical_percent"] = round(critical / total * 100, 1)
        result["high_percent"] = round(high / total * 100, 1)
        result["medium_percent"] = round(medium / total * 100, 1)
        result["low_percent"] = round(low / total * 100, 1)

    return result


@router.get("/")
async def get_all_vulnerabilities(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=10000),
    severity: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Liste toutes les vulnérabilités avec filtrage optionnel.
    Accessible sans authentification.
    """
    query = db.query(Vulnerability)

    if severity and severity.lower() in ("critical", "high", "medium", "low"):
        query = query.filter(Vulnerability.severity == severity.lower())

    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                Vulnerability.title.ilike(term),
                Vulnerability.description.ilike(term),
                Vulnerability.cve_id.ilike(term),
            )
        )

    total = query.count()
    vulns = query.order_by(Vulnerability.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "results": [_serialize(v) for v in vulns],
    }


@router.get("/search")
async def search_vulnerabilities(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Recherche rapide par mot-clé."""
    term = f"%{q}%"
    results = (
        db.query(Vulnerability)
        .filter(
            or_(
                Vulnerability.title.ilike(term),
                Vulnerability.description.ilike(term),
                Vulnerability.cve_id.ilike(term),
            )
        )
        .limit(limit)
        .all()
    )
    return {"query": q, "count": len(results), "results": [_serialize(v, short=True) for v in results]}


@router.get("/recent")
async def get_recent_vulnerabilities(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Dernières vulnérabilités ajoutées."""
    vulns = db.query(Vulnerability).order_by(Vulnerability.created_at.desc()).limit(limit).all()
    return {"count": len(vulns), "results": [_serialize(v, short=True) for v in vulns]}


@router.get("/severity/{severity_level}")
async def get_by_severity(
    severity_level: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=10000),
    db: Session = Depends(get_db),
):
    """Vulnérabilités filtrées par sévérité."""
    sev = severity_level.lower()
    if sev not in ("critical", "high", "medium", "low"):
        raise HTTPException(status_code=400, detail="Sévérité invalide : critical | high | medium | low")

    query = db.query(Vulnerability).filter(Vulnerability.severity == sev)
    total = query.count()
    vulns = query.offset(skip).limit(limit).all()
    return {"severity": sev, "total": total, "skip": skip, "limit": limit, "results": [_serialize(v) for v in vulns]}


@router.get("/by-cve/{cve_id}")
async def get_by_cve_id(cve_id: str, db: Session = Depends(get_db)):
    """Détail d'une vulnérabilité par son CVE-ID."""
    vuln = db.query(Vulnerability).filter(Vulnerability.cve_id == cve_id.upper()).first()
    if not vuln:
        raise HTTPException(status_code=404, detail=f"CVE {cve_id} introuvable")
    return _serialize(vuln, full=True)


# ============================================================
# ENDPOINTS PROTÉGÉS — nécessitent un JWT valide
# ============================================================

@router.get("/{vuln_id}")
async def get_vulnerability_detail(
    vuln_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Détail complet d'une vulnérabilité (authentification requise)."""
    vuln = db.query(Vulnerability).filter(Vulnerability.id == vuln_id).first()
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnérabilité introuvable")

    # Si liée à un scan, vérifier les droits
    if getattr(vuln, "scan_id", None):
        scan = db.query(Scan).filter(Scan.id == vuln.scan_id).first()
        if scan and scan.user_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Accès refusé")

    return _serialize(vuln, full=True)


@router.patch("/{vuln_id}/status")
async def update_status(
    vuln_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Changer le statut d'une vulnérabilité : open | fixed | ignored."""
    vuln = db.query(Vulnerability).filter(Vulnerability.id == vuln_id).first()
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnérabilité introuvable")

    if getattr(vuln, "scan_id", None):
        scan = db.query(Scan).filter(Scan.id == vuln.scan_id).first()
        if scan and scan.user_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Accès refusé")

    new_status = body.get("status", "open")
    if new_status not in ("open", "fixed", "ignored"):
        raise HTTPException(status_code=400, detail="Statut invalide : open | fixed | ignored")

    old_status = vuln.status
    vuln.status = new_status
    db.commit()

    logger.info(f"[{current_user.username}] {vuln.cve_id} : {old_status} → {new_status}")
    return {"id": vuln.id, "cve_id": vuln.cve_id, "old_status": old_status, "new_status": new_status}


@router.get("/scan/{scan_id}")
async def get_by_scan(
    scan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Vulnérabilités d'un scan appartenant à l'utilisateur connecté."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan introuvable")
    if scan.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")

    vulns = db.query(Vulnerability).filter(Vulnerability.scan_id == scan_id).all()
    return {
        "scan_id": scan_id,
        "scan_target": scan.target_url,
        "scan_status": scan.status,
        "total": len(vulns),
        "results": [_serialize(v) for v in vulns],
    }


# ============================================================
# ENDPOINTS ADMIN
# ============================================================

@router.delete("/{vuln_id}")
async def delete_vulnerability(
    vuln_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Supprime une vulnérabilité (admin uniquement)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs")

    vuln = db.query(Vulnerability).filter(Vulnerability.id == vuln_id).first()
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnérabilité introuvable")

    db.delete(vuln)
    db.commit()
    return {"message": f"Vulnérabilité {vuln.cve_id} supprimée"}


@router.post("/bulk-import", status_code=201)
async def bulk_import(
    data: List[dict],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import en masse de vulnérabilités (admin uniquement)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs")

    imported, errors = 0, []

    for item in data:
        try:
            cve_id = item.get("cve_id")
            if cve_id and not db.query(Vulnerability).filter(Vulnerability.cve_id == cve_id).first():
                db.add(Vulnerability(
                    cve_id=cve_id,
                    title=(item.get("title") or "")[:500],
                    description=item.get("description"),
                    severity=item.get("severity", "medium"),
                    cvss_score=item.get("cvss_score"),
                    remediation=item.get("remediation"),
                    status=item.get("status", "open"),
                ))
                imported += 1
        except Exception as e:
            errors.append({"cve_id": item.get("cve_id"), "error": str(e)})

        if imported % 100 == 0:
            db.commit()

    db.commit()
    logger.info(f"[{current_user.username}] Import : {imported} vulnérabilités ajoutées")
    return {"imported": imported, "errors": errors, "total_processed": len(data)}


# ============================================================
# HELPER
# ============================================================

def _sev_value(v) -> str:
    """Retourne la sévérité sous forme de str quelle que soit sa représentation."""
    return v.severity if isinstance(v.severity, str) else v.severity.value


def _serialize(v: Vulnerability, short=False, full=False) -> dict:
    base = {
        "id": v.id,
        "cve_id": v.cve_id,
        "title": v.title,
        "severity": _sev_value(v),
        "cvss_score": v.cvss_score,
        "status": getattr(v, "status", "open"),
        "created_at": getattr(v, "created_at", None),
    }
    if not short:
        base["description"] = (v.description or "")[:300] if not full else v.description
        base["remediation"] = v.remediation
    return base