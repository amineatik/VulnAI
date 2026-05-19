# backend/database.py
from sqlalchemy import create_engine, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Créer l'engine SQLAlchemy
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dépendance FastAPI pour obtenir une session base de données"""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Erreur de base de données: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def init_db():
    """Initialise la base de données"""
    try:
        with engine.connect() as conn:
            logger.info("✅ Connexion à MySQL réussie!")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Tables vérifiées/créées")
    except Exception as e:
        logger.error(f"❌ Erreur: {e}")
        raise