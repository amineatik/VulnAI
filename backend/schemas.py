from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# ========== ENUMS ==========

class ScanStatusEnum(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class SeverityEnum(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class UserRoleEnum(str, Enum):
    ADMIN = "admin"
    USER = "user"
    PREMIUM = "premium"


# ========== USER SCHEMAS ==========

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., pattern=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    is_active: bool = True

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserResponse(UserBase):
    id: int
    role: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class UserLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: Optional[str] = None


# ========== SCAN SCHEMAS (CORRIGÉS AVEC NOUVEAUX CHAMPS) ==========

class ScanCreate(BaseModel):
    target_url: str = Field(..., min_length=1, max_length=500)
    scan_type: str = Field(..., min_length=1, max_length=50)

class ScanResponse(BaseModel):
    id: int
    user_id: int
    target_url: str
    scan_type: str
    status: ScanStatusEnum
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    
    # ✅ NOUVEAUX CHAMPS AJOUTÉS
    security_score: Optional[float] = None
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    info_count: int = 0
    
    model_config = ConfigDict(from_attributes=True)

class ScanListResponse(BaseModel):
    total: int
    items: List[ScanResponse]


# ========== VULNERABILITY SCHEMAS ==========

class VulnerabilityBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    severity: SeverityEnum
    cvss_score: Optional[str] = None
    endpoint: Optional[str] = None
    remediation: Optional[str] = None
    status: str = "open"

class VulnerabilityCreate(VulnerabilityBase):
    scan_id: int
    cve_id: Optional[str] = None

class VulnerabilityResponse(BaseModel):
    id: int
    scan_id: Optional[int] = None  # nullable pour les CVEs importés
    cve_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    severity: SeverityEnum
    cvss_score: Optional[str] = None
    endpoint: Optional[str] = None
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class VulnerabilityDetailResponse(VulnerabilityResponse):
    remediation: Optional[str] = None


class VulnerabilityStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r'^(open|fixed|ignored)$')


# ========== CVE SCHEMAS (pour l'import) ==========

class CVEBase(BaseModel):
    cve_id: str = Field(..., pattern=r'^CVE-\d{4}-\d{4,}$')
    title: str = Field(..., max_length=500)
    description: str
    severity: SeverityEnum
    cvss_score: Optional[str] = None
    remediation: Optional[str] = None

class CVEImportResult(BaseModel):
    imported: int
    skipped: int
    errors: int
    total: int


# ========== REPORT SCHEMAS ==========

class ReportCreate(BaseModel):
    scan_id: int
    title: str = Field(..., min_length=1, max_length=200)
    report_type: str = Field(..., min_length=1, max_length=50)
    content: Optional[Dict[str, Any]] = None

class ReportResponse(BaseModel):
    id: int
    user_id: int
    scan_id: Optional[int] = None
    title: str
    report_type: str
    content: Dict[str, Any]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ReportListResponse(BaseModel):
    total: int
    items: List[ReportResponse]


# ========== AI SCHEMAS ==========

class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1)
    context: Optional[str] = ""
    history: Optional[List[Dict[str, str]]] = []

class ChatResponse(BaseModel):
    response: str
    context_used: Optional[Dict[str, Any]] = None

class AIQuery(BaseModel):
    vulnerability_title: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)
    description: Optional[str] = None
    severity: Optional[str] = None

class AIResponse(BaseModel):
    answer: str
    analysis: Optional[str] = None
    recommendations: List[str] = []
    similar_cves: List[Dict[str, Any]] = []


# ========== DASHBOARD SCHEMAS ==========

class DashboardStats(BaseModel):
    total_scans: int
    total_vulnerabilities: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    average_security_score: Optional[float] = None
    recent_scans: List[ScanResponse] = []


# ========== PAGINATION ==========

class PaginationParams(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)


class PaginatedResponse(BaseModel):
    total: int
    skip: int
    limit: int
    items: List[Any]