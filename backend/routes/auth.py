# backend/routes/auth.py

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator, ConfigDict
from typing import Optional
from datetime import datetime, timedelta
import jwt
import bcrypt

from database import get_db
from models import User
from config import settings

# ============================================================
# SECURITY
# ============================================================

security = HTTPBearer()

# ============================================================
# UTILITAIRES AUTH
# ============================================================

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta if expires_delta
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Dépendance FastAPI — extrait et valide le JWT depuis le header Authorization.
    Utilisation : current_user = Depends(get_current_user)
    """
    token = credentials.credentials
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Token invalide")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Compte désactivé")

    return user


# ============================================================
# ROUTER  ✅ prefix /auth — cohérent avec main.py et le frontend
# ============================================================

router = APIRouter(prefix="/auth", tags=["Auth"])

# ============================================================
# SCHEMAS PYDANTIC
# ============================================================

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Minimum 3 caractères")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Caractères autorisés : lettres, chiffres, _ et -")
        return v

    @field_validator("email")
    @classmethod
    def email_valid(cls, v):
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Email invalide")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v):
        if len(v) < 8:
            raise ValueError("Minimum 8 caractères")
        return v


class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v):
        return v.strip().lower()


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/register", status_code=201)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Créer un nouveau compte utilisateur."""

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


@router.post("/login", response_model=TokenResponse)
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """Authentifier un utilisateur et retourner un JWT."""

    user = db.query(User).filter(User.email == login_data.email).first()

    # Message générique volontaire : ne pas révéler si l'email existe
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Compte désactivé")

    access_token = create_access_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
        },
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Retourner les infos de l'utilisateur connecté (nécessite un token valide)."""
    return current_user


@router.post("/logout")
async def logout():
    """
    JWT est stateless — la déconnexion se fait côté client
    en supprimant le token du localStorage.
    Pour une invalidation serveur, implémenter une blacklist Redis.
    """
    return {"message": "Déconnexion réussie"}


@router.get("/check")
async def check_auth(current_user: User = Depends(get_current_user)):
    """Vérifier si le token est valide et retourner les infos de base."""
    return {
        "authenticated": True,
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
    }