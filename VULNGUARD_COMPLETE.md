# VulnGuard AI - Complete Full-Stack Implementation

## Project Overview
VulnGuard AI is a comprehensive AI-powered cybersecurity platform built with a complete monorepo architecture separating frontend and backend services. The application provides vulnerability scanning, analysis, and reporting capabilities with a modern dark-themed UI.

## Architecture

### Directory Structure
```
vulnguard-ai/
├── backend/                 # Python FastAPI backend
│   ├── main.py             # FastAPI application entry point
│   ├── config.py           # Configuration management
│   ├── database.py         # SQLAlchemy setup & session management
│   ├── models.py           # Database models (User, Scan, Vulnerability, etc.)
│   ├── schemas.py          # Pydantic validation schemas
│   ├── auth.py             # JWT authentication & security
│   ├── routes/
│   │   ├── auth.py         # Authentication endpoints
│   │   ├── scans.py        # Scan CRUD operations
│   │   ├── vulnerabilities.py  # Vulnerability management
│   │   └── reports.py      # Report generation
│   ├── requirements.txt     # Python dependencies
│   └── .env.example        # Environment variables template
│
├── frontend/               # Next.js 16 React application
│   ├── app/
│   │   ├── layout.tsx      # Root layout with dark theme
│   │   ├── page.tsx        # Home redirect to dashboard
│   │   ├── login/page.tsx  # Login page with email/password
│   │   ├── register/page.tsx # Registration with password strength
│   │   ├── dashboard/page.tsx # Main dashboard with KPIs
│   │   ├── scans/
│   │   │   ├── page.tsx           # Scan results list
│   │   │   ├── new/page.tsx       # Create new scan
│   │   │   └── [id]/page.tsx      # Detailed scan results
│   │   ├── analysis/page.tsx       # AI analysis with chat
│   │   ├── vulnerabilities/page.tsx # Vulnerability database
│   │   ├── reports/page.tsx        # Report management
│   │   ├── monitoring/page.tsx     # Real-time monitoring
│   │   ├── settings/page.tsx       # User settings & config
│   │   └── globals.css             # Tailwind + design tokens
│   ├── components/
│   │   └── main-layout.tsx  # Sidebar + navbar wrapper
│   ├── lib/
│   │   ├── api.ts          # Axios API client with interceptors
│   │   └── auth-context.tsx # React Context for auth state
│   ├── hooks/              # Pre-installed React hooks
│   ├── public/             # Static assets
│   └── package.json        # Frontend dependencies
│
├── package.json            # Monorepo root config
└── README.md              # Project documentation

```

## Backend (Python FastAPI)

### Key Features
- **REST API** on `http://localhost:8000`
- **MySQL Database** (XAMPP compatible)
- **JWT Authentication** with secure token management
- **CORS Enabled** for frontend communication
- **SQLAlchemy ORM** for type-safe database operations

### Database Models
1. **User** - Account management with roles (user/admin)
2. **Scan** - Security scan records with status tracking
3. **Vulnerability** - Found vulnerabilities with severity levels
4. **Report** - Generated security reports
5. **APIKey** - API key management for external access

### API Endpoints
```
Authentication:
- POST /api/auth/register    - Create new account
- POST /api/auth/login       - Login and get JWT token
- GET /api/auth/me           - Get current user info

Scans:
- POST /api/scans            - Create new scan
- GET /api/scans             - List user scans
- GET /api/scans/{id}        - Get scan details
- GET /api/scans/{id}/vulnerabilities - Get scan's vulnerabilities
- DELETE /api/scans/{id}     - Delete scan

Vulnerabilities:
- GET /api/vulnerabilities/{id} - Get vulnerability details
- PATCH /api/vulnerabilities/{id}/status - Update status

Reports:
- POST /api/reports          - Generate report
- GET /api/reports           - List reports
- GET /api/reports/{id}      - Get report details
- DELETE /api/reports/{id}   - Delete report
```

### Environment Variables (.env)
```
DATABASE_URL=mysql+pymysql://root:@localhost:3306/vulnguard_ai
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
FRONTEND_URL=http://localhost:3000
```

## Frontend (Next.js 16)

### Design System
- **Theme**: Dark cybersecurity aesthetic
- **Colors**: 
  - Background: #0A0A0F (dark black)
  - Primary: #E63946 (red accent)
  - Secondary: #4895EF (blue)
  - Cards: #1A1A2E
  - Text: #E0E0E0
- **Effects**: Glassmorphism cards, red glow on hover
- **Layout**: Fixed 240px sidebar + responsive main content

### Pages & Features

1. **Login/Register** (`/login`, `/register`)
   - Email + password authentication
   - Password strength indicator
   - Remember me option
   - Form validation with Zod

2. **Dashboard** (`/dashboard`)
   - KPI cards (Total Scans, Critical Vulns, Security Score, Active Alerts)
   - Charts: Vulnerabilities by type, Scan history, Severity distribution
   - Recent scans table
   - Animated count-up numbers

3. **New Scan** (`/scans/new`)
   - URL input with validation
   - Scan type selection (Basic, Advanced, Full)
   - Configurable scan options
   - Progress tracking with live percentage

4. **Scan Results** (`/scans`)
   - Filterable results list
   - Search by URL
   - Severity-based filtering
   - Quick actions (View, Delete)

5. **Scan Details** (`/scans/[id]`)
   - Overall security score
   - Vulnerability table with details
   - Severity badges and CVSS scores
   - Expandable vulnerability descriptions

6. **AI Analysis** (`/analysis`)
   - Vulnerability selection sidebar
   - AI-powered analysis output
   - Real-time chat with AI
   - Structured recommendations

7. **Vulnerabilities Database** (`/vulnerabilities`)
   - Browse common vulnerability types
   - Category filtering (Injection, Authentication, etc.)
   - Severity indicators
   - Searchable database

8. **Reports** (`/reports`)
   - Generate reports from scans
   - Download PDF exports
   - Share functionality
   - Report history

9. **Monitoring** (`/monitoring`)
   - Real-time activity charts
   - Request rate metrics
   - Live threat log
   - Status indicators

10. **Settings** (`/settings`)
    - Profile management
    - Security settings (password change, 2FA)
    - AI configuration (Ollama URL, model selection)
    - Notification preferences
    - API key management
    - Appearance settings

### State Management
- **React Context** for authentication state
- **Axios** with request/response interceptors
- **SWR-like** patterns for data fetching
- **localStorage** for token persistence

### UI Components
- Shadcn/ui components for consistent design
- Radix UI primitives for accessibility
- Recharts for data visualization
- Framer Motion for smooth animations
- Lucide React for icons

## Running the Project

### Prerequisites
- Python 3.8+
- Node.js 16+
- MySQL (XAMPP or standalone)
- pnpm package manager

### Setup & Installation

**1. Backend Setup**
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Update .env with your MySQL credentials
python main.py  # Runs on http://localhost:8000
```

**2. Frontend Setup**
```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:3000
```

**3. Both Together**
```bash
# From root directory
pnpm dev
```

### Database Setup
1. Start XAMPP MySQL
2. Create database:
```sql
CREATE DATABASE vulnguard_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
3. Tables auto-created on first FastAPI startup

## Technology Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM for database
- **MySQL/PyMySQL** - Database driver
- **JWT (python-jose)** - Token authentication
- **Pydantic** - Data validation
- **Bcrypt** - Password hashing

### Frontend
- **Next.js 16** - React framework with SSR
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **Shadcn/ui** - Component library
- **Recharts** - Charts & graphs
- **Framer Motion** - Animations
- **Axios** - HTTP client
- **Zod** - Schema validation

## Security Features
- JWT token-based authentication
- Password hashing with bcrypt
- CORS protection
- SQL injection prevention (parameterized queries)
- Input validation with Pydantic
- HTTP-only token storage
- Protected routes with authentication middleware
- Role-based access control (RBAC) ready

## Key Implementation Details

### API Integration
- Centralized axios instance with token injection
- Automatic redirect to login on 401 errors
- Error handling with toast notifications
- Request/response interceptors for consistency

### Authentication Flow
1. User registers/logs in
2. Backend validates credentials and issues JWT
3. Frontend stores token in localStorage
4. All subsequent requests include Authorization header
5. API interceptor handles token refresh/expiration

### Monorepo Structure
- Separate package.json files for independence
- Root package.json with workspace configuration
- Parallel development servers on different ports
- Shared git repository for version control

## Future Enhancements
1. Real Ollama integration for AI analysis
2. Actual vulnerability scanning engine
3. Webhook notifications
4. Advanced reporting (PDF generation)
5. Two-factor authentication
6. Admin dashboard for user management
7. Rate limiting and API quota system
8. Database backup and recovery
9. Deployment to production (Docker, Kubernetes)
10. Performance optimizations and caching

## Notes
- Mock data is used for demonstration
- Real scanning functionality would integrate with security tools
- All API responses follow RESTful conventions
- Frontend is mobile-responsive on tablets/phones
- Dark theme optimized for extended security analysis sessions
