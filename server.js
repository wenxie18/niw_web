// Load environment variables for local development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const db = require('./database');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const path = require('path');
const Stripe = require('stripe');

// Load configuration from config.js
const config = require('./config.js');

const app = express();
const PORT = config.PORT;

// Trust proxy for Vercel (fixes rate limiting issue)
app.set('trust proxy', 1);

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
            connectSrc: ["'self'", "https://api.stripe.com"],
            frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
        },
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://niw-web.vercel.app', 'https://www.niw-web.vercel.app']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax'
    }
}));

// JWT verification middleware
function verifyJWT(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    
    if (!token) {
        return next();
    }
    
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('JWT verification failed:', error.message);
        next();
    }
}

// Middleware to handle session fallback for Vercel
app.use((req, res, next) => {
    // If no session user but we have email in query params, try to restore session
    if (!req.session.user && req.query.email) {
        // This will be handled by individual routes that need authentication
        req.sessionFallback = {
            email: req.query.email
        };
    }
    next();
});

// Serve static files from public directory first (for both local and Vercel)
app.use(express.static(path.join(__dirname, 'public')));

// Serve other static files from root directory (disable default index.html at '/')
app.use(express.static(path.join(__dirname), { index: false }));


// Database initialization
db.initDatabase().catch(console.error);

// API Routes

app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        
        await db.run('INSERT INTO users (email, password_hash) VALUES ($1, $2)', [email.toLowerCase(), hashedPassword]);
        
        // Create JWT token
        const token = jwt.sign(
            { 
                email: email.toLowerCase(), 
                paid: false, 
                packageType: null 
            },
            config.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // Also set session for backward compatibility
        req.session.user = { 
            email: email.toLowerCase(), 
            paid: false, 
            packageType: null
        };
        
        res.json({ success: true, token });
    } catch (e) {
        console.error(e);
        if (e.code === '23505') { // Unique constraint violation
            res.status(400).json({ success: false, error: 'Email already registered. Please login instead.' });
        } else {
        res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
});

app.post('/api/login', async (req, res) => {
    try {
        console.log('Login attempt received for email:', req.body.email);
        const { email, password } = req.body;
        if (!email || !password) {
            console.log('Missing email or password');
            return res.status(400).json({ success: false, error: 'Email and password required' });
        }
        
        console.log('Querying database for user:', email);
        const user = await db.get('SELECT email, password_hash, paid, package_type FROM users WHERE email = $1', [email.toLowerCase()]);
        
        if (!user) {
            console.log('User not found in database');
            return res.status(404).json({ success: false, error: 'No account found. Please create an account.' });
        }
        
        console.log('Comparing password for user:', email);
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            console.log('Password comparison failed');
            return res.status(401).json({ success: false, error: 'Incorrect password' });
        }
        
        console.log('Login successful, setting session for user:', email);
        
        // Create JWT token
        const token = jwt.sign(
            { 
                email: user.email, 
                paid: user.paid === true,
                packageType: user.package_type || 'full'
            },
            config.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // Also set session for backward compatibility
        req.session.user = { 
            email: user.email, 
            paid: user.paid === true,
            packageType: user.package_type || 'full'
        };
        
        res.json({ success: true, token });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', verifyJWT, async (req, res) => {
    try {
        // If we have a JWT user, return it
        if (req.user) {
            return res.json({ success: true, user: req.user });
        }
        
        // If we have a session user, return it
        if (req.session.user) {
            return res.json({ success: true, user: req.session.user });
        }
        
        // If no session but we have session fallback, try to restore user from database
        if (req.sessionFallback && req.sessionFallback.email) {
            const user = await db.get('SELECT email, paid, package_type FROM users WHERE email = $1', [req.sessionFallback.email]);
            if (user) {
                // Restore session
                req.session.user = {
                    email: user.email,
                    paid: user.paid,
                    packageType: user.package_type
                };
                return res.json({ success: true, user: req.session.user });
            }
        }
        
        // No user found
        res.json({ success: true, user: null });
    } catch (error) {
        console.error('Error in /api/me:', error);
        res.json({ success: false, user: null });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        database: db ? 'connected' : 'disconnected',
        postgres_url: process.env.POSTGRES_URL ? 'set' : 'missing',
        version: '2.0.1'
    });
});

// Configuration endpoint
app.get('/api/config', (req, res) => {
    res.json({
        showEvaluation: config.SHOW_EVALUATION,
        surveyType: config.SURVEY_TYPE
    });
});

// Test endpoint to verify code updates
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'This is the NEW VERSION 2.0.0',
        timestamp: new Date().toISOString(),
        postgres_url_status: process.env.POSTGRES_URL ? 'SET' : 'NOT SET'
    });
});

app.get('/api/stripe-config', (req, res) => {
    res.json({ 
        success: true, 
        publishableKey: config.STRIPE_PUBLISHABLE_KEY 
    });
});

// Set package type for user
app.post('/api/set-package', verifyJWT, async (req, res) => {
    try {
        const { packageType } = req.body;
        
        // Check for JWT user first, then session user
        let userEmail = null;
        if (req.user) {
            userEmail = req.user.email;
        } else if (req.session.user) {
            userEmail = req.session.user.email;
        }
        
        if (!userEmail) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        // Update user's package type in database
        await db.run('UPDATE users SET package_type = $1 WHERE email = $2', [packageType, userEmail]);
        
        // Update session if it exists
        if (req.session.user) {
            req.session.user.packageType = packageType;
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error setting package type:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Stripe checkout session creation
app.post('/api/create-checkout-session', async (req, res) => {
    console.log('Create checkout session request received');
    console.log('Request body:', req.body);
    console.log('Session user:', req.session.user);
    
    if (!stripe) {
        console.error('Stripe not configured');
        return res.status(500).json({ success: false, error: 'Stripe not configured' });
    }
    
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) {
            console.error('User not authenticated');
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const { packageType } = req.body;
        console.log('Package type received:', packageType);
        if (!packageType) {
            console.error('Package type missing');
            return res.status(400).json({ success: false, error: 'Package type required' });
        }
        
        // Determine pricing based on package type and current payment status
        let priceInCents, productName;
        
        if (packageType === 'form-filling') {
            if (sessionUser.paid) {
                // User is upgrading from form-filling to full package
                priceInCents = 130000; // $1,300 (difference)
                productName = 'Upgrade to Full Package';
            } else {
                priceInCents = 29900; // $299
                productName = 'Form Filling Package';
            }
        } else {
            priceInCents = 159900; // $1,599
            productName = 'Full Package';
        }
        
        console.log('Creating Stripe session with:', { packageType, priceInCents, productName });
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: productName,
                    },
                    unit_amount: priceInCents,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.headers.origin}/account?success=1&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin}/account?canceled=1`,
            client_reference_id: sessionUser.email,
            metadata: {
                email: sessionUser.email,
                package_type: packageType
            }
        });
        
        console.log('Stripe session created successfully:', session.id);
        console.log('Checkout URL:', session.url);
        
        res.json({ success: true, url: session.url, sessionId: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ success: false, error: 'Failed to create checkout session' });
    }
});

// Stripe checkout confirmation
app.get('/api/checkout/confirm', async (req, res) => {
    try {
        const { session_id } = req.query;
        if (!session_id || !stripe) {
            return res.json({ success: true, paid: false });
        }
        
        const checkout = await stripe.checkout.sessions.retrieve(session_id);
        if (checkout && checkout.payment_status === 'paid') {
            const paidEmail = (checkout.client_reference_id) || (checkout.metadata && checkout.metadata.email);
            if (paidEmail) {
                const amountPaid = checkout.amount_total; // Amount in cents
                const amountDollars = amountPaid / 100;
                let packageType = 'full';
                let paymentType = 'initial';
                
                if (amountPaid === 29900) { // $299.00
                    packageType = 'form-filling';
                    paymentType = 'initial';
                } else if (amountPaid === 130000) { // $1,300.00 (upgrade)
                    packageType = 'full';
                    paymentType = 'upgrade';
                } else if (amountPaid === 159900) { // $1,599.00
                    packageType = 'full';
                    paymentType = 'initial';
                }
                
                // Record payment in payments table
                await db.run(`
                    INSERT INTO payments (user_email, stripe_session_id, amount_cents, amount_dollars, package_type, payment_type, status)
                    VALUES ($1, $2, $3, $4, $5, $6, 'completed')
                `, [paidEmail, session_id, amountPaid, amountDollars, packageType, paymentType]);
                
                // Update user's current package type and paid status
                await db.run('UPDATE users SET paid = true, package_type = $1 WHERE email = $2', [packageType, paidEmail]);
                
                // Create JWT token for the paid user
                const token = jwt.sign(
                    { 
                        email: paidEmail, 
                        paid: true,
                        packageType: packageType
                    },
                    config.JWT_SECRET,
                    { expiresIn: '7d' }
                );
                
                // Also update session if user is logged in
                if (req.session.user && req.session.user.email === paidEmail) {
                    req.session.user.paid = true;
                    req.session.user.packageType = packageType;
                }
                
                return res.json({ success: true, paid: true, token, user: { email: paidEmail, paid: true, packageType } });
            }
            return res.json({ success: true, paid: true });
        }
        res.json({ success: true, paid: false });
    } catch (e) {
        console.error('Error confirming checkout session:', e);
        res.status(500).json({ success: false, error: 'Failed to confirm payment' });
    }
});

// Get user payments
app.get('/api/payments', async (req, res) => {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const payments = await db.all(`
            SELECT id, amount_cents, amount_dollars, package_type, payment_type, status, created_at
            FROM payments 
            WHERE user_email = $1 
            ORDER BY created_at DESC
        `, [sessionUser.email]);

        res.json({ success: true, payments: payments });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Evaluation submission endpoint
app.post('/api/submit-evaluation', async (req, res) => {
    try {
        const {
            email,
            name,
            education,
            publications,
            citations,
            research_field,
            work_experience,
            current_position,
            awards,
            grants,
            patents,
            research_description,
            timeline
        } = req.body;

        // Basic validation
        if (!email || !name || !education || !publications || !citations || !research_field || !work_experience || !current_position || !awards || !grants || !patents) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Calculate evaluation score (basic scoring algorithm)
        let score = 0;
        
        // Education scoring
        if (education === 'phd') score += 30;
        else if (education === 'masters') score += 20;
        else if (education === 'bachelors') score += 10;
        
        // Publications scoring
        const pubCount = parseInt(publications);
        if (pubCount >= 10) score += 25;
        else if (pubCount >= 5) score += 20;
        else if (pubCount >= 3) score += 15;
        else score += 5;
        
        // Citations scoring
        const citCount = parseInt(citations);
        if (citCount >= 100) score += 25;
        else if (citCount >= 50) score += 20;
        else if (citCount >= 15) score += 15;
        else score += 5;
        
        // Research field bonus
        if (research_field === 'yes') score += 10;
        
        // Awards and recognition
        if (awards === 'yes') score += 5;
        if (grants === 'yes') score += 5;
        if (patents === 'yes') score += 5;
        
        // Generate recommendations based on score
        let recommendations = [];
        if (score < 50) {
            recommendations.push("Consider pursuing additional publications to strengthen your case");
            recommendations.push("Focus on building citation count through high-impact research");
        } else if (score < 70) {
            recommendations.push("Your profile shows promise - consider highlighting specific achievements");
            recommendations.push("Focus on demonstrating national importance of your work");
        } else {
            recommendations.push("You have a strong NIW case - consider proceeding with application");
            recommendations.push("Highlight your research impact and national importance");
        }

        // Store evaluation response
        await db.run(`
            INSERT INTO evaluation_responses (
                email, name, education, publications, citations, research_field,
                work_experience, current_position, awards, grants, patents,
                research_description, timeline, evaluation_score, evaluation_recommendations
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
            email, name, education, parseInt(publications), parseInt(citations), research_field,
            parseInt(work_experience), current_position, awards, grants, patents,
            research_description || null, timeline || null, score, recommendations.join('; ')
        ]);

        res.json({
            success: true,
            message: 'Evaluation submitted successfully',
            score: score,
            recommendations: recommendations
        });
    } catch (error) {
        console.error('Error submitting evaluation:', error);
        res.status(500).json({ success: false, error: 'Failed to submit evaluation' });
    }
});

// Survey submission endpoints
app.post('/api/submit-survey', async (req, res) => {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser || !sessionUser.paid) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        
        const { responses } = req.body;
        const responseId = uuidv4();
        
        await db.run(`
            INSERT INTO survey_responses (id, user_email, responses) 
            VALUES ($1, $2, $3)
        `, [responseId, sessionUser.email, JSON.stringify(responses)]);
        
        res.json({ success: true, responseId });
    } catch (error) {
        console.error('Error submitting survey:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/submit-first-survey', async (req, res) => {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser || !sessionUser.paid) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        
        const { responses } = req.body;
        const responseId = uuidv4();
        
        await db.run(`
            INSERT INTO first_survey_responses (id, user_email, responses) 
            VALUES ($1, $2, $3)
        `, [responseId, sessionUser.email, JSON.stringify(responses)]);
        
        res.json({ success: true, responseId });
    } catch (error) {
        console.error('Error submitting first survey:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Page routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/account', (req, res) => {
    res.sendFile(path.join(__dirname, 'account.html'));
});

app.get('/evaluation', (req, res) => {
    res.sendFile(path.join(__dirname, 'evaluation.html'));
});

app.get('/survey', async (req, res) => {
    try {
        let userEmail = null;
        
        // Try to get email from session first
        if (req.session.user && req.session.user.email) {
            userEmail = req.session.user.email;
        }
        // If no session, try to get email from query parameter
        else if (req.query.email) {
            userEmail = req.query.email;
        }
        
        if (!userEmail) {
            return res.redirect('/account');
        }
        
        // Check user payment status in database
        const user = await db.get('SELECT email, paid, package_type FROM users WHERE email = $1', [userEmail]);
        
        if (!user || !user.paid) {
            return res.redirect('/account');
        }
        
        const surveyType = (config && config.SURVEY_TYPE) ? config.SURVEY_TYPE : 'full';
        const surveyFile = surveyType === 'simplified' ? 'second-survey-simplified.html' : 'second-survey.html';
        res.sendFile(path.join(__dirname, surveyFile));
    } catch (error) {
        console.error('Error checking user status:', error);
        res.redirect('/account');
    }
});

app.get('/first-survey', async (req, res) => {
    try {
        let userEmail = null;
        
        // Try to get email from session first
        if (req.session.user && req.session.user.email) {
            userEmail = req.session.user.email;
        }
        // If no session, try to get email from query parameter
        else if (req.query.email) {
            userEmail = req.query.email;
        }
        
        if (!userEmail) {
            return res.redirect('/account');
        }
        
        // Check user payment status in database
        const user = await db.get('SELECT email, paid, package_type FROM users WHERE email = $1', [userEmail]);
        
        if (!user || !user.paid) {
            return res.redirect('/account');
        }
        
        res.sendFile(path.join(__dirname, 'first-survey.html'));
    } catch (error) {
        console.error('Error checking user status:', error);
        res.redirect('/account');
    }
});


// Static file routes for Vercel
app.get('/styles.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'styles.css'));
});

app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'script.js'));
});

app.get('/TurboNIW-name-italic.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'TurboNIW-name-italic.png'));
});

app.get('/hero-image.jpg', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'hero-image.jpg'));
});

// Start server
if (process.env.NODE_ENV !== 'production') {
app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Database: PostgreSQL (via @vercel/postgres)`);
    });
}

module.exports = app;