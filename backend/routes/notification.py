from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Vulnerability
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("/")
async def get_notifications(db: Session = Depends(get_db)):
    try:
        critical_vulns = db.query(Vulnerability).filter(
            Vulnerability.severity == "critical"
        ).order_by(Vulnerability.created_at.desc()).limit(5).all()

        return [
            {
                "id": v.id,
                "title": v.title[:100],
                "severity": v.severity,
                "cve_id": v.cve_id,
                "created_at": v.created_at.isoformat() if v.created_at else None,
                "read": False,
            }
            for v in critical_vulns
        ]
    except Exception as e:
        logger.error(f"Erreur notifications: {e}")
        return []
