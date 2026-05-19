# backend/models.py

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


# ========== USER ROLE ==========

class UserRole:
    ADMIN = "admin"
    USER = "user"


# ========== MODELS ==========

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    role = Column(String(20), default=UserRole.USER)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    scans = relationship(
        "Scan",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    reports = relationship(
        "Report",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    conversations = relationship(
        "Conversation",
        back_populates="user",
        cascade="all, delete-orphan"
    )


class Scan(Base):
    __tablename__ = "scans"
    
    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    target_url = Column(String(500), nullable=False)

    scan_type = Column(String(50), nullable=False)

    status = Column(String(20), default="pending")

    started_at = Column(DateTime(timezone=True), nullable=True)

    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    
    security_score = Column(Float, nullable=True)

    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)
    info_count = Column(Integer, default=0)
    
    user = relationship("User", back_populates="scans")

    vulnerabilities = relationship(
        "Vulnerability",
        back_populates="scan",
        cascade="all, delete-orphan"
    )


class Vulnerability(Base):
    __tablename__ = "vulnerabilities"
    
    id = Column(Integer, primary_key=True, index=True)

    scan_id = Column(
        Integer,
        ForeignKey("scans.id"),
        nullable=True
    )

    cve_id = Column(String(50), index=True, nullable=True)

    title = Column(String(500), nullable=False)

    description = Column(Text, nullable=True)

    severity = Column(String(20), nullable=False)

    cvss_score = Column(String(10), nullable=True)

    endpoint = Column(String(500), nullable=True)

    remediation = Column(Text, nullable=True)

    status = Column(String(20), default="open")

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    
    scan = relationship(
        "Scan",
        back_populates="vulnerabilities"
    )


class Report(Base):
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    scan_id = Column(
        Integer,
        ForeignKey("scans.id"),
        nullable=True
    )

    title = Column(String(200), nullable=False)

    report_type = Column(String(50), nullable=False)

    content = Column(JSON, default={})

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    
    user = relationship(
        "User",
        back_populates="reports"
    )


class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    title = Column(
        String(200),
        default="Nouvelle conversation"
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now()
    )
    
    user = relationship(
        "User",
        back_populates="conversations"
    )

    messages = relationship(
        "ConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan"
    )


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"
    
    id = Column(Integer, primary_key=True, index=True)

    conversation_id = Column(
        Integer,
        ForeignKey("conversations.id"),
        nullable=False
    )

    role = Column(String(20), nullable=False)

    content = Column(Text, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    
    conversation = relationship(
        "Conversation",
        back_populates="messages"
    )