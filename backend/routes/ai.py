# backend/routes/ai.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import httpx
from sqlalchemy.orm import Session
from database import get_db
from models import Vulnerability
from config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

class ChatMessage(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []


@router.post("/chat")
async def chat_with_ai(data: ChatMessage, db: Session = Depends(get_db)):
    """Chat avec Llama via Ollama"""
    message = data.message
    
    # Contexte des CVE trouvés dans la base
    cve_context = ""
    try:
        keywords = message.lower().split()[:3]
        for kw in keywords:
            if len(kw) > 3:
                cves = db.query(Vulnerability).filter(
                    Vulnerability.title.contains(kw)
                ).limit(3).all()
                if cves:
                    cve_context = "\n\nInformations CVE trouvées:\n" + "\n".join(
                        [f"- {c.cve_id}: {c.title}" for c in cves]
                    )
                    break
    except:
        pass
    
    # Prompt système pour Llama
    system_prompt = """Tu es VulnGuard AI, un assistant expert en cybersécurité.
Tu es amical, précis et pédagogique.
Tu réponds TOUJOURS en français, de façon détaillée et utile.
Si on te pose une question hors cybersécurité, tu réponds quand même poliment.
Tu as accès à une base CVE pour donner des exemples concrets.
Structure tes réponses clairement avec des points si nécessaire."""
    
    full_prompt = f"{system_prompt}\n\nQuestion: {message}{cve_context}\n\nRéponse:"
    
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": 1024,
                        "top_p": 0.9
                    }
                }
            )
        
        if response.status_code == 200:
            result = response.json()
            ai_response = result.get("response", "Je n'ai pas pu générer de réponse.")
            logger.info(f"✅ Llama a répondu: {ai_response[:100]}...")
            return {
                "response": ai_response,
                "model_used": settings.OLLAMA_MODEL,
                "success": True
            }
        else:
            return {
                "response": f"❌ Erreur Ollama: {response.status_code}",
                "success": False
            }
            
    except httpx.ConnectError:
        logger.error("Ollama non connecté")
        return {
            "response": " **Ollama n'est pas démarré**\n\nÉtapes:\n1. Installez Ollama depuis https://ollama.com\n2. Téléchargez un modèle: `ollama pull llama3.2:1b`\n3. Démarrez: `ollama serve`\n4. Puis rafraîchissez la page",
            "success": False
        }
    except Exception as e:
        logger.error(f"Erreur: {e}")
        return {
            "response": f"❌ Erreur technique: {str(e)}",
            "success": False
        }


@router.get("/health")
async def health():
    """Vérifie la connexion à Ollama"""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{settings.OLLAMA_URL}/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [m.get("name") for m in models]
                model_available = settings.OLLAMA_MODEL in model_names
                
                return {
                    "status": "ok",
                    "ollama_configured": True,
                    "ollama_available": True,
                    "model": settings.OLLAMA_MODEL,
                    "model_available": model_available,
                    "available_models": model_names,
                    "message": "✅ Ollama connecté" if model_available else f"⚠️ Modèle {settings.OLLAMA_MODEL} non trouvé"
                }
    except:
        pass
    
    return {
        "status": "ok",
        "ollama_configured": False,
        "ollama_available": False,
        "model": settings.OLLAMA_MODEL,
        "message": " Ollama non démarré. Lancez: ollama serve"
    }


@router.post("/analyze")
async def analyze_vulnerability(data: dict, db: Session = Depends(get_db)):
    """Analyse une vulnérabilité avec Llama"""
    vuln_title = data.get("vulnerability_title", "")
    description = data.get("description", "")
    severity = data.get("severity", "")
    
    prompt = f"""Analyse cette vulnérabilité en français:
Titre: {vuln_title}
Sévérité: {severity}
Description: {description}

Donne-moi:
1. L'analyse du risque (0/10)
2. L'impact potentiel
3. Les corrections recommandées
4. Un exemple concret"""

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.5, "num_predict": 800}
                }
            )
        
        if response.status_code == 200:
            analysis = response.json().get("response", "")
            return {
                "answer": analysis,
                "analysis": analysis,
                "recommendations": []
            }
    except:
        pass
    
    # Réponse par défaut si Llama indisponible
    return {
        "answer": f" **Analyse de {vuln_title}**\n\n**Risque:** {severity.upper()}\n\n**Description:** {description}\n\n**Recommandations:**\n• Identifier les composants vulnérables\n• Appliquer les correctifs\n• Tester la correction",
        "analysis": description,
        "recommendations": ["Isoler les systèmes", "Appliquer les correctifs", "Tester la correction"]
    }


@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Statistiques des CVEs"""
    try:
        total = db.query(Vulnerability).count()
        critical = db.query(Vulnerability).filter(Vulnerability.severity == "critical").count()
        high = db.query(Vulnerability).filter(Vulnerability.severity == "high").count()
        medium = db.query(Vulnerability).filter(Vulnerability.severity == "medium").count()
        low = db.query(Vulnerability).filter(Vulnerability.severity == "low").count()
        
        return {
            "total": total,
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "has_data": total > 0
        }
    except:
        return {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0, "has_data": False}