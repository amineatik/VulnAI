# backend/config.py
import os
from dotenv import load_dotenv

load_dotenv(override=True)

class Settings:
    """Configuration de l'application"""
    
    # Database - MySQL (XAMPP)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "mysql+pymysql://root:@localhost:3306/vulnai_db?charset=utf8mb4"
    )
    
    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "votre-cle-secrete-tres-securisee-123456789")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
    ANTHROPIC_API_KEY: str = ""
    # Frontend
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # Ollama
    OLLAMA_URL = "http://localhost:11434"
    OLLAMA_MODEL = "llama3.2:1b"  # le plus rapide pour le chat temps réel
    
    # Debug
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"

settings = Settings()

print(f"[CONFIG] Database: MySQL on localhost")
print(f"[CONFIG] Ollama URL: {settings.OLLAMA_URL}")