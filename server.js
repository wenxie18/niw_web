const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
// Centralized configuration
const DB_NAME = process.env.DB_NAME || 'niw_database.db';

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] // Replace with your actual domain
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Sessions (memory store OK for dev)
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        secure: process.env.NODE_ENV === 'production'
    }
}));

// Serve static files (disable default index.html at '/')
app.use(express.static(path.join(__dirname), { index: false }));

// Database initialization
const db = new sqlite3.Database(DB_NAME, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
});

function initDatabase() {
    // Create survey_responses table
    db.run(`
        CREATE TABLE IF NOT EXISTS survey_responses (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT,
            submission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            data TEXT,
            status TEXT DEFAULT 'submitted'
        )
    `, (err) => {
        if (err) {
            console.error('Error creating survey_responses table:', err.message);
        } else {
            console.log('Survey responses table ready');
        }
    });

    // Create response_fields table for easier querying
    db.run(`
        CREATE TABLE IF NOT EXISTS response_fields (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            response_id TEXT,
            field_name TEXT,
            field_value TEXT,
            FOREIGN KEY (response_id) REFERENCES survey_responses (id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating response_fields table:', err.message);
        } else {
            console.log('Response fields table ready');
        }
    });

    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            paid INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Error creating users table:', err.message);
    });
}

// Routes
// Pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/survey', (req, res) => {
    // Require login and paid account before serving survey
    if (!req.session.user || !req.session.user.paid) {
        return res.redirect('/account');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/account', (req, res) => {
    res.sendFile(path.join(__dirname, 'account.html'));
});

// API Routes
// Auth endpoints
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });
        if (password.length < 8 || password.length > 12) {
            return res.status(400).json({ success: false, error: 'Password must be 8–12 characters.' });
        }
        const hash = await bcrypt.hash(password, 10);
        await new Promise((resolve, reject) => {
            db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, hash], function(err){
                if (err) return reject(err);
                resolve();
            });
        });
        req.session.user = { email, paid: 0 };
        res.json({ success: true });
    } catch (e) {
        if (e && e.message && e.message.includes('UNIQUE'))
            return res.status(409).json({ success: false, error: 'Email already registered' });
        console.error(e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT email, password_hash, paid FROM users WHERE email = ?', [email], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
        if (!user) return res.status(404).json({ success: false, error: 'No account found. Please create an account.' });
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ success: false, error: 'Incorrect password' });
        req.session.user = { email: user.email, paid: user.paid === 1 };
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', (req, res) => {
    res.json({ success: true, user: req.session.user || null });
});

app.post('/api/pay', async (req, res) => {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) return res.status(401).json({ success: false, error: 'Not authenticated' });
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET paid = 1 WHERE email = ?', [sessionUser.email], function(err){
                if (err) return reject(err);
                resolve();
            });
        });
        req.session.user.paid = true;
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.post('/api/submit-survey', async (req, res) => {
    try {
        const { email, ...formData } = req.body;
        
        // For testing: allow empty submissions
        if (!email) {
            email = 'test@example.com'; // Default email for testing
        }

        // Validate email format only if email is provided
        if (email && email !== 'test@example.com') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid email format' 
                });
            }
        }

        const responseId = uuidv4();
        const fullName = formData.PERSONAL_FULL_NAME || '';
        const dataJson = JSON.stringify(formData);

        // Save to database
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO survey_responses (id, email, full_name, data)
                VALUES (?, ?, ?, ?)
            `, [responseId, email, fullName, dataJson], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        // Save individual fields
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM response_fields WHERE response_id = ?', [responseId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        for (const [fieldName, fieldValue] of Object.entries(formData)) {
            if (fieldValue && fieldValue.toString().trim()) {
                await new Promise((resolve, reject) => {
                    db.run(`
                        INSERT INTO response_fields (response_id, field_name, field_value)
                        VALUES (?, ?, ?)
                    `, [responseId, fieldName, fieldValue.toString()], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
        }

        res.json({
            success: true,
            message: 'Survey submitted successfully',
            responseId: responseId
        });

    } catch (error) {
        console.error('Error submitting survey:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

app.get('/api/survey/:email', (req, res) => {
    const { email } = req.params;
    
    db.get(`
        SELECT id, email, full_name, submission_date, data, status
        FROM survey_responses
        WHERE email = ?
        ORDER BY submission_date DESC
        LIMIT 1
    `, [email], (err, row) => {
        if (err) {
            console.error('Error retrieving survey:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Internal server error' 
            });
        }

        if (!row) {
            return res.status(404).json({ 
                success: false, 
                error: 'Survey not found' 
            });
        }

        res.json({
            success: true,
            data: {
                id: row.id,
                email: row.email,
                full_name: row.full_name,
                submission_date: row.submission_date,
                data: JSON.parse(row.data || '{}'),
                status: row.status
            }
        });
    });
});

app.get('/api/surveys', (req, res) => {
    db.all(`
        SELECT id, email, full_name, submission_date, status
        FROM survey_responses
        ORDER BY submission_date DESC
    `, (err, rows) => {
        if (err) {
            console.error('Error retrieving surveys:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Internal server error' 
            });
        }

        res.json({
            success: true,
            data: rows
        });
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        version: '1.0.0'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Route not found' 
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
🚀 NIW Survey Server Running!
📍 Local: http://localhost:${PORT}
🌐 Network: http://0.0.0.0:${PORT}
📊 Database: ${DB_NAME}

API Endpoints:
  POST /api/submit-survey - Submit survey data
  GET  /api/survey/:email - Get survey by email
  GET  /api/surveys - Get all surveys
  GET  /api/health - Health check

Press Ctrl+C to stop the server
    `);
});

module.exports = app;
