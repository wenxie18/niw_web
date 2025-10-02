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

// Load configuration
let config;
try {
    config = require('./config.js');
} catch (e) {
    console.log('⚠️  config.js not found, using environment variables');
    config = {
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
        STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
        DB_NAME: process.env.DB_NAME || 'niw_database.db',
        SESSION_SECRET: process.env.SESSION_SECRET || 'dev-secret',
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || 3000
    };
}
const Stripe = require('stripe');

const app = express();
const PORT = config.PORT;
// Centralized configuration
const DB_NAME = config.DB_NAME;
const STRIPE_SECRET_KEY = config.STRIPE_SECRET_KEY;
const stripe = STRIPE_SECRET_KEY ? Stripe(STRIPE_SECRET_KEY) : null;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
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
    origin: config.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] // Replace with your actual domain
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Sessions (memory store OK for dev)
app.use(session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        secure: config.NODE_ENV === 'production'
    }
}));

// Serve static files from public directory first (for both local and Vercel)
app.use(express.static(path.join(__dirname, 'public')));

// Serve other static files from root directory (disable default index.html at '/')
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

    // Create first_survey_responses table
    db.run(`
        CREATE TABLE IF NOT EXISTS first_survey_responses (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT,
            submission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            data TEXT,
            status TEXT DEFAULT 'submitted'
        )
    `, (err) => {
        if (err) {
            console.error('Error creating first_survey_responses table:', err.message);
        } else {
            console.log('First survey responses table ready');
        }
    });

    // Create first_survey_fields table for easier querying
    db.run(`
        CREATE TABLE IF NOT EXISTS first_survey_fields (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            response_id TEXT,
            field_name TEXT,
            field_value TEXT,
            FOREIGN KEY (response_id) REFERENCES first_survey_responses (id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating first_survey_fields table:', err.message);
        } else {
            console.log('First survey fields table ready');
        }
    });

    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            paid INTEGER DEFAULT 0,
            package_type TEXT DEFAULT 'full',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Error creating users table:', err.message);
    });

    // Add package_type column if it doesn't exist (migration)
    db.run(`
        ALTER TABLE users ADD COLUMN package_type TEXT DEFAULT 'full'
    `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding package_type column:', err.message);
        }
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
    const surveyType = (config && config.SURVEY_TYPE) ? config.SURVEY_TYPE : 'full';
    const surveyFile = surveyType === 'simplified' ? 'second-survey-simplified.html' : 'second-survey.html';
    res.sendFile(path.join(__dirname, surveyFile));
});

app.get('/account', (req, res) => {
    res.sendFile(path.join(__dirname, 'account.html'));
});

app.get('/first-survey', (req, res) => {
    // Require login and paid account before serving first survey
    if (!req.session.user || !req.session.user.paid) {
        return res.redirect('/account');
    }
    res.sendFile(path.join(__dirname, 'first-survey.html'));
});

app.get('/evaluation', (req, res) => {
    res.sendFile(path.join(__dirname, 'evaluation.html'));
});

// API endpoint for evaluation form submission
app.post('/api/submit-evaluation', async (req, res) => {
    try {
        const { email, name, education, publications, citations, research_field, work_experience, current_position, awards, grants, patents, research_description, timeline } = req.body;
        
        // Basic validation
        if (!email || !name || !education || !publications || !citations) {
            return res.status(400).json({ 
                success: false, 
                error: 'Please fill in all required fields.' 
            });
        }

        // Create evaluation record
        const evaluationId = uuidv4();
        const evaluationData = {
            email,
            name,
            education,
            publications: parseInt(publications),
            citations: parseInt(citations),
            research_field,
            work_experience: parseInt(work_experience) || 0,
            current_position,
            awards,
            grants,
            patents,
            research_description,
            timeline,
            submission_date: new Date().toISOString()
        };

        // Save to database (you can create a separate table for evaluations)
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO survey_responses (id, email, full_name, data)
                VALUES (?, ?, ?, ?)
            `, [evaluationId, email, name, JSON.stringify(evaluationData)], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({
            success: true,
            message: 'Evaluation submitted successfully',
            evaluationId: evaluationId
        });

    } catch (error) {
        console.error('Error submitting evaluation:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
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

app.get('/api/stripe-config', (req, res) => {
    res.json({ 
        success: true, 
        publishableKey: config.STRIPE_PUBLISHABLE_KEY 
    });
});

// Stripe: Create Checkout Session (Test mode when using test secret key)
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({ success: false, error: 'Stripe not configured. Set STRIPE_SECRET_KEY.' });
        }
        const sessionUser = req.session.user;
        if (!sessionUser) return res.status(401).json({ success: false, error: 'Not authenticated' });

        const origin = `${req.protocol}://${req.get('host')}`;
        
        // Determine price based on package type and payment status
        const packageType = sessionUser.packageType || 'full';
        let priceInCents, productName;
        
        if (packageType === 'form-filling') {
            if (sessionUser.paid) {
                // User already paid for form-filling, this is an upgrade
                priceInCents = 130000; // $1,300.00 (difference)
                productName = 'Upgrade to Complete NIW Prep';
            } else {
                priceInCents = 29900; // $299.00
                productName = 'Form Filling Package';
            }
        } else {
            priceInCents = 159900; // $1,599.00
            productName = 'Complete NIW Prep';
        }

        const checkout = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: { name: productName },
                        unit_amount: priceInCents
                    },
                    quantity: 1
                }
            ],
            client_reference_id: sessionUser.email,
            metadata: { email: sessionUser.email },
            success_url: `${origin}/account?success=1&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/account?canceled=1`
        });

        res.json({ success: true, url: checkout.url });
    } catch (e) {
        console.error('Error creating checkout session:', e);
        res.status(500).json({ success: false, error: 'Failed to create checkout session' });
    }
});

// Stripe: Confirm payment after redirect (server-side verification)
app.get('/api/checkout/confirm', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({ success: false, error: 'Stripe not configured. Set STRIPE_SECRET_KEY.' });
        }
        const sessionId = req.query.session_id;
        if (!sessionId) return res.status(400).json({ success: false, error: 'Missing session_id' });

        const checkout = await stripe.checkout.sessions.retrieve(sessionId);
        if (checkout && checkout.payment_status === 'paid') {
            const paidEmail = (checkout.client_reference_id) || (checkout.metadata && checkout.metadata.email);
            if (paidEmail) {
                await new Promise((resolve, reject) => {
                    db.run('UPDATE users SET paid = 1 WHERE email = ?', [paidEmail], function(err){
                        if (err) return reject(err);
                        resolve();
                    });
                });
                if (req.session.user && req.session.user.email === paidEmail) {
                    req.session.user.paid = true;
                }
            }
            return res.json({ success: true, paid: true });
        }
        res.json({ success: true, paid: false });
    } catch (e) {
        console.error('Error confirming checkout session:', e);
        res.status(500).json({ success: false, error: 'Failed to confirm payment' });
    }
});

// Set package type
app.post('/api/set-package', async (req, res) => {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) return res.status(401).json({ success: false, error: 'Not authenticated' });

        const { packageType } = req.body;
        if (!packageType || !['form-filling', 'full'].includes(packageType)) {
            return res.status(400).json({ success: false, error: 'Invalid package type' });
        }

        // Store package type in user session
        req.session.user.packageType = packageType;

        // Update database
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET package_type = ? WHERE email = ?', [packageType, sessionUser.email], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
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

// First Survey Submission Route
app.post('/api/submit-first-survey', async (req, res) => {
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
        const fullName = `${formData.FIRST_NAME || ''} ${formData.LAST_NAME || ''}`.trim();
        const dataJson = JSON.stringify(formData);

        // Save to database
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO first_survey_responses (id, email, full_name, data, submission_date)
                VALUES (?, ?, ?, ?, datetime('now'))
            `, [responseId, email, fullName, dataJson], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        // Save individual fields
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM first_survey_fields WHERE response_id = ?', [responseId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        for (const [fieldName, fieldValue] of Object.entries(formData)) {
            if (fieldValue && fieldValue.toString().trim()) {
                await new Promise((resolve, reject) => {
                    db.run(`
                        INSERT INTO first_survey_fields (response_id, field_name, field_value)
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
            message: 'First survey submitted successfully',
            responseId: responseId
        });

    } catch (error) {
        console.error('Error submitting first survey:', error);
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

// Handle static files for Vercel - serve from public directory
app.get('/styles.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'styles.css'));
});

app.get('/TurboNIW-name-italic.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'TurboNIW-name-italic.png'));
});

app.get('/hero-image.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hero-image.jpg'));
});

app.get('/script.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'script.js'));
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
