# Website Structure & Technical Architecture

## 🏗️ Overall Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                        │
├─────────────────────────────────────────────────────────────┤
│  HTML5 + CSS3 + JavaScript (Vanilla)                      │
│  ├── index.html (Survey Form)                             │
│  ├── styles.css (Professional Styling)                    │
│  └── script.js (Form Logic & API Calls)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/HTTPS
                              │
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (Node.js)                        │
├─────────────────────────────────────────────────────────────┤
│  Express.js Framework                                      │
│  ├── server.js (Main Application)                         │
│  ├── Middleware (Security, CORS, Rate Limiting)           │
│  └── API Routes (RESTful Endpoints)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ SQL Queries
                              │
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE (SQLite)                        │
├─────────────────────────────────────────────────────────────┤
│  File-based Database                                       │
│  ├── niw_survey.db (Main Database File)                   │
│  ├── survey_responses (Main Table)                        │
│  └── response_fields (Individual Fields Table)            │
└─────────────────────────────────────────────────────────────┘
```

## 📁 File Structure Breakdown

### Frontend Files
```
niw_web/
├── index.html                    # Main survey form
│   ├── <head>                   # Meta tags, CSS, JS imports
│   ├── <header>                 # Logo, title, subtitle
│   ├── <main>                   # Survey form sections
│   │   ├── Progress Bar         # Visual progress indicator
│   │   ├── Form Sections (8)    # Multi-step form
│   │   └── Navigation Buttons   # Previous/Next/Submit
│   └── <footer>                 # Success message
│
├── styles.css                   # Professional styling
│   ├── Reset & Base Styles      # CSS reset, typography
│   ├── Layout Components        # Grid, flexbox layouts
│   ├── Form Styling            # Input fields, buttons
│   ├── Responsive Design       # Mobile-first approach
│   └── Animations              # Transitions, hover effects
│
└── script.js                    # Frontend functionality
    ├── SurveyForm Class         # Main form management
    ├── Navigation Logic         # Step-by-step navigation
    ├── Validation System       # Real-time form validation
    ├── API Communication       # Backend data exchange
    └── Utility Functions       # Helper functions
```

### Backend Files
```
niw_web/
├── server.js                    # Express.js application
│   ├── Dependencies            # Express, SQLite, CORS, etc.
│   ├── Middleware Setup        # Security, parsing, CORS
│   ├── Database Initialization # SQLite setup
│   ├── API Routes              # RESTful endpoints
│   ├── Error Handling          # Global error management
│   └── Server Startup          # Port configuration
│
├── package.json                # Node.js configuration
│   ├── Dependencies            # Production packages
│   ├── Dev Dependencies        # Development tools
│   ├── Scripts                 # npm commands
│   └── Metadata                # Project information
│
└── vercel.json                 # Deployment configuration
    ├── Build Settings          # Node.js build config
    ├── Routes                  # URL routing rules
    └── Environment Variables   # Production settings
```

## 🗄️ Database Structure

### SQLite Database: `niw_survey.db`

#### Table 1: `survey_responses`
```sql
CREATE TABLE survey_responses (
    id TEXT PRIMARY KEY,           -- UUID for unique identification
    email TEXT UNIQUE NOT NULL,   -- User's email (primary key for queries)
    full_name TEXT,               -- User's full name for easy identification
    submission_date DATETIME DEFAULT CURRENT_TIMESTAMP,  -- When submitted
    data TEXT,                    -- JSON string of all form data
    status TEXT DEFAULT 'submitted'  -- Status tracking
);
```

**Sample Data:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john.doe@example.com",
  "full_name": "John Doe",
  "submission_date": "2024-09-21 16:49:46",
  "data": "{\"PERSONAL_EMAIL\":\"john.doe@example.com\",\"PERSONAL_FULL_NAME\":\"John Doe\",...}",
  "status": "submitted"
}
```

#### Table 2: `response_fields`
```sql
CREATE TABLE response_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Auto-incrementing ID
    response_id TEXT,                      -- Links to survey_responses.id
    field_name TEXT,                       -- Field name (e.g., "PERSONAL_EMAIL")
    field_value TEXT,                      -- Field value
    FOREIGN KEY (response_id) REFERENCES survey_responses (id)
);
```

**Sample Data:**
```json
[
  {"id": 1, "response_id": "550e8400-e29b-41d4-a716-446655440000", "field_name": "PERSONAL_EMAIL", "field_value": "john.doe@example.com"},
  {"id": 2, "response_id": "550e8400-e29b-41d4-a716-446655440000", "field_name": "PERSONAL_FULL_NAME", "field_value": "John Doe"},
  {"id": 3, "response_id": "550e8400-e29b-41d4-a716-446655440000", "field_name": "JOB_TITLE", "field_value": "Research Scientist"}
]
```

## 🔄 Data Flow Architecture

### 1. User Interaction Flow
```
User Input → Form Validation → Auto-save (localStorage) → Submit → API Call → Database Storage
```

### 2. API Request Flow
```
Frontend → Express Router → Middleware → Route Handler → Database Query → Response
```

### 3. Database Operations
```
INSERT/UPDATE → SQLite → File System → Response → JSON → Frontend
```

## 🌐 API Endpoints Structure

### Base URL: `http://localhost:3000`

#### 1. Survey Form
```
GET /
├── Serves: index.html
├── Purpose: Display survey form
└── Response: HTML page
```

#### 2. Submit Survey
```
POST /api/submit-survey
├── Body: { email: string, ...formData }
├── Validation: Email format, required fields
├── Database: INSERT/UPDATE survey_responses
├── Database: INSERT response_fields
└── Response: { success: boolean, message: string, responseId: string }
```

#### 3. Get Survey by Email
```
GET /api/survey/:email
├── Params: email (string)
├── Database: SELECT from survey_responses
├── Processing: Parse JSON data
└── Response: { success: boolean, data: object }
```

#### 4. Get All Surveys (Admin)
```
GET /api/surveys
├── Database: SELECT all from survey_responses
├── Processing: Format response data
└── Response: { success: boolean, data: array }
```

#### 5. Health Check
```
GET /api/health
├── Database: Connection check
├── System: Status verification
└── Response: { status: string, timestamp: string, database: string }
```

## 🎨 Frontend Component Structure

### HTML Structure
```html
<!DOCTYPE html>
<html>
<head>
  ├── Meta tags (viewport, charset)
  ├── Title and favicon
  ├── CSS imports (Google Fonts, Font Awesome)
  └── External stylesheets
</head>
<body>
  ├── Container
  │   ├── Header (Logo, title, subtitle)
  │   ├── Progress Bar (Visual progress indicator)
  │   ├── Survey Form
  │   │   ├── Section 1: Personal Information (12 fields)
  │   │   ├── Section 2: USCIS Information (4 fields)
  │   │   ├── Section 3: Educational Background (10 fields)
  │   │   ├── Section 4: Additional Education (12 fields)
  │   │   ├── Section 5: Professional Information (12 fields)
  │   │   ├── Section 6: Research Expertise (20 fields)
  │   │   ├── Section 7: Publications (25 fields)
  │   │   └── Section 8: Citations & Impact (25 fields)
  │   └── Navigation Buttons (Previous, Next, Submit)
  └── Success Message (Hidden by default)
</body>
</html>
```

### CSS Architecture
```css
/* Reset & Base Styles */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; }

/* Layout Components */
.container { max-width: 1200px; margin: 0 auto; }
.header { background: rgba(255, 255, 255, 0.95); }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }

/* Component Styles */
.form-section { display: none; }
.form-section.active { display: block; }
.btn { padding: 12px 30px; border-radius: 10px; }

/* Responsive Design */
@media (max-width: 768px) { /* Mobile styles */ }
@media (max-width: 480px) { /* Small mobile styles */ }
```

### JavaScript Architecture
```javascript
class SurveyForm {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 8;
    this.formData = {};
  }
  
  // Navigation methods
  nextStep() { /* Move to next section */ }
  previousStep() { /* Move to previous section */ }
  
  // Validation methods
  validateCurrentStep() { /* Check required fields */ }
  isValidEmail(email) { /* Email format validation */ }
  
  // Data management
  saveFormData() { /* Save to localStorage */ }
  loadSavedData() { /* Load from localStorage */ }
  
  // API communication
  submitToAPI() { /* Send data to backend */ }
  
  // UI updates
  updateProgress() { /* Update progress bar */ }
  showSuccessMessage() { /* Display success page */ }
}
```

## 🔒 Security Architecture

### Frontend Security
- **Input Validation**: Real-time client-side validation
- **XSS Protection**: Input sanitization
- **CSRF Protection**: Same-origin policy
- **Content Security Policy**: Restricted resource loading

### Backend Security
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for specific origins
- **Helmet.js**: Security headers
- **Input Validation**: Server-side validation
- **SQL Injection Protection**: Parameterized queries

### Database Security
- **File Permissions**: Restricted database file access
- **Data Validation**: Type checking and sanitization
- **Backup Strategy**: Regular database backups

## 📱 Responsive Design Structure

### Breakpoints
```css
/* Mobile First Approach */
Default: 320px - 767px    /* Mobile devices */
Tablet: 768px - 1023px    /* Tablet devices */
Desktop: 1024px+          /* Desktop devices */
```

### Layout Adaptations
- **Mobile**: Single column, stacked layout
- **Tablet**: Two columns, optimized spacing
- **Desktop**: Multi-column grid, full features

## 🚀 Deployment Architecture

### Local Development
```
Developer Machine
├── Node.js Runtime
├── npm (Package Manager)
├── SQLite Database
└── Local Server (Port 3000)
```

### Cloud Deployment (Vercel)
```
Vercel Platform
├── Node.js Runtime
├── Serverless Functions
├── Global CDN
├── SQLite Database (File-based)
└── Automatic Scaling
```

### Production Considerations
- **Environment Variables**: Configuration management
- **Database Backup**: Regular data backups
- **Monitoring**: Health checks and logging
- **Scaling**: Load balancing for high traffic

---

**This structure provides a solid foundation for your NIW survey application and can easily be extended for future features and scaling needs.**
