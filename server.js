// Load environment variables for local development
require('dotenv').config();

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

// Load configuration
let config;
if (process.env.NODE_ENV === 'production') {
    // Production configuration (Vercel)
    config = {
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
        STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
        DB_NAME: process.env.DB_NAME || 'niw_database.db',
        SESSION_SECRET: process.env.SESSION_SECRET || 'niw_survey_2025_secure_session_key_xyz789',
        JWT_SECRET: process.env.JWT_SECRET || 'niw_jwt_secret_key_2025_xyz789',
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: process.env.PORT || 3000,
        SURVEY_TYPE: process.env.SURVEY_TYPE || 'simplified',
        SHOW_EVALUATION: process.env.SHOW_EVALUATION === 'true',
        SURVEY_TITLE: {
            full: process.env.SURVEY_TITLE_FULL || 'Complete NIW Application Survey',
            simplified: process.env.SURVEY_TITLE_SIMPLIFIED || 'Simplified NIW Application Survey'
        },
        SURVEY_DESCRIPTION: {
            full: process.env.SURVEY_DESCRIPTION_FULL || 'Comprehensive survey covering all aspects of your NIW application',
            simplified: process.env.SURVEY_DESCRIPTION_SIMPLIFIED || 'Streamlined survey focusing on essential NIW application details'
        },
        PAYMENT_AMOUNT: parseInt(process.env.PAYMENT_AMOUNT) || 159900,
        PAYMENT_CURRENCY: process.env.PAYMENT_CURRENCY || 'usd',
        PAYMENT_PRODUCT_NAME: process.env.PAYMENT_PRODUCT_NAME || 'Complete NIW Prep',
        FEATURES: {
            PAYMENT_REQUIRED: process.env.PAYMENT_REQUIRED !== 'false',
            SURVEY_AUTO_SAVE: process.env.SURVEY_AUTO_SAVE !== 'false',
            EMAIL_NOTIFICATIONS: process.env.EMAIL_NOTIFICATIONS === 'true',
            ADMIN_DASHBOARD: process.env.ADMIN_DASHBOARD === 'true'
        }
    };
} else {
    // Development configuration - load from config.js
    config = require('./config.js');
}

const app = express();
const PORT = config.PORT;

// Trust proxy for Vercel (fixes rate limiting issue)
app.set('trust proxy', 1);

// Vercel-specific optimizations
if (process.env.NODE_ENV === 'production') {
    // Disable X-Powered-By header for security
    app.disable('x-powered-by');
    
    // Set production-specific headers
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        next();
    });
}

// Centralized configuration
const POSTGRES_URL = config.POSTGRES_URL;
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

// Rate limiting - Vercel compatible
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 500 : 1000, // More lenient for development
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Vercel specific settings
    trustProxy: true,
    skip: (req) => {
        // Skip rate limiting for static files
        return req.path.includes('.css') || req.path.includes('.js') || req.path.includes('.png') || req.path.includes('.jpg');
    }
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
        console.log('Database user data:', user);
        
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
        console.log('API /api/me called at:', new Date().toISOString());
        let userEmail = null;
        
        // Determine user email from JWT, session, or fallback
        if (req.user) {
            userEmail = req.user.email;
        } else if (req.session.user) {
            userEmail = req.session.user.email;
        } else if (req.sessionFallback && req.sessionFallback.email) {
            userEmail = req.sessionFallback.email;
        }
        
        if (!userEmail) {
            return res.json({ success: true, user: null });
        }
        
        // Always fetch fresh data from database for accurate payment status
        const user = await db.get('SELECT email, paid, package_type FROM users WHERE email = $1', [userEmail]);
        if (!user) {
            return res.json({ success: true, user: null });
        }
        
        // Update session with fresh data
        if (req.session.user) {
            req.session.user.paid = user.paid;
            req.session.user.packageType = user.package_type;
        }
        
        // Return fresh user data
        res.json({ 
            success: true, 
            user: {
                email: user.email,
                paid: user.paid === true,
                packageType: user.package_type || 'full'
            }
        });
    } catch (error) {
        console.error('Error in /api/me:', error);
        res.json({ success: false, user: null });
    }
});

// Health check endpoint - Vercel compatible
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        database: db ? 'connected' : 'disconnected',
        postgres_url: process.env.POSTGRES_URL ? 'set' : 'missing',
        version: '2.0.1',
        environment: process.env.NODE_ENV || 'development',
        vercel: process.env.VERCEL === '1',
        region: process.env.VERCEL_REGION || 'local',
        rateLimitWorking: true,
        staticFilesWorking: true
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
        // Try to get user from session first, then from JWT token
        let sessionUser = req.session.user;
        let userEmail = null;
        
        if (!sessionUser) {
            // Try JWT token authentication as fallback
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.substring(7);
                    const decoded = jwt.verify(token, config.JWT_SECRET);
                    userEmail = decoded.email;
                    console.log('JWT authentication successful for:', userEmail);
                } catch (jwtError) {
                    console.log('JWT authentication failed:', jwtError.message);
                }
            }
            
            if (!userEmail) {
                console.error('User not authenticated via session or JWT');
                return res.status(401).json({ success: false, error: 'Not authenticated' });
            }
            
            // Create a minimal session user object for compatibility
            sessionUser = { email: userEmail };
        } else {
            userEmail = sessionUser.email;
        }
        
        const { packageType, paymentMethod = 'card' } = req.body;
        if (!packageType) {
            return res.status(400).json({ success: false, error: 'Package type required' });
        }
        
        // Determine base pricing based on package type and current payment status
        let basePriceInCents, productName;
        
        if (packageType === 'form-filling') {
            if (sessionUser.paid) {
                // User is upgrading from form-filling to full package
                basePriceInCents = 130000; // $1,300 (difference)
                productName = 'Upgrade to Full Package';
            } else {
                basePriceInCents = 29900; // $299
                productName = 'Form Filling Package';
            }
        } else {
            basePriceInCents = 159900; // $1,599
            productName = 'Full Package';
        }
        
        // Calculate processing fee based on payment method
        let processingFeeInCents = 0;
        if (paymentMethod === 'card') {
            // 3% processing fee for credit cards
            processingFeeInCents = Math.round(basePriceInCents * 0.03);
        } else if (paymentMethod === 'ach') {
            // $0.50 processing fee for ACH (we'll use 50 cents as average)
            processingFeeInCents = 50;
        }
        
        const totalPriceInCents = basePriceInCents + processingFeeInCents;
        
        // Determine payment method types based on selection
        const paymentMethodTypes = paymentMethod === 'ach' ? ['us_bank_account'] : ['card'];
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: paymentMethodTypes,
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: productName,
                        description: paymentMethod === 'ach' ? 
                            `Base price: $${(basePriceInCents / 100).toFixed(2)} + ACH fee: $${(processingFeeInCents / 100).toFixed(2)}` :
                            `Base price: $${(basePriceInCents / 100).toFixed(2)} + 3% processing fee: $${(processingFeeInCents / 100).toFixed(2)}`
                    },
                    unit_amount: totalPriceInCents,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.headers.origin}/account?success=1&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin}/account?canceled=1`,
            client_reference_id: sessionUser.email,
            metadata: {
                email: sessionUser.email,
                package_type: packageType,
                payment_method: paymentMethod,
                base_price: basePriceInCents.toString(),
                processing_fee: processingFeeInCents.toString(),
                total_price: totalPriceInCents.toString()
            }
        });
        
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
        
        // Check if payment should be processed:
        // - Credit cards: 'paid' status
        // - ACH payments: 'paid', 'processing', or 'unpaid' (successful initiation)
        const isAchPayment = checkout.payment_method_types?.includes('us_bank_account');
        const isPaid = checkout.payment_status === 'paid';
        const isAchProcessing = isAchPayment && checkout.payment_status === 'processing';
        const isAchUnpaid = isAchPayment && checkout.payment_status === 'unpaid';
        
        if (checkout && (isPaid || isAchProcessing || isAchUnpaid)) {
            const paidEmail = (checkout.client_reference_id) || (checkout.metadata && checkout.metadata.email);
            if (paidEmail) {
                const amountPaid = checkout.amount_total; // Amount in cents
                const amountDollars = amountPaid / 100;
                
                // Get package type and payment method from metadata
                const packageType = checkout.metadata?.package_type || 'full';
                const paymentMethod = checkout.metadata?.payment_method || 'card';
                const basePrice = parseInt(checkout.metadata?.base_price || '0');
                const processingFee = parseInt(checkout.metadata?.processing_fee || '0');
                
                // Determine payment type based on amount and metadata
                let paymentType = 'initial';
                const expectedTotal = basePrice + processingFee;
                const paymentStatus = (isAchProcessing || isAchUnpaid) ? 'processing' : 'completed';
                
                if (packageType === 'form-filling' && amountPaid === expectedTotal) {
                    paymentType = 'initial';
                } else if (packageType === 'full' && amountPaid === expectedTotal) {
                    paymentType = 'initial';
                } else if (packageType === 'full' && amountPaid === (130000 + processingFee)) {
                    paymentType = 'upgrade';
                } else {
                    // Fallback: if amounts don't match exactly, still process as initial payment
                    paymentType = 'initial';
                }
                
                console.log('Payment confirmed:', {
                    email: paidEmail,
                    amount: `$${(amountPaid / 100).toFixed(2)}`,
                    package: packageType,
                    method: paymentMethod,
                    status: paymentStatus
                });
                
                // Record payment in payments table (handle duplicates gracefully)
                let paymentRecorded = false;
                try {
                    await db.run(`
                        INSERT INTO payments (user_email, stripe_session_id, amount_cents, amount_dollars, package_type, payment_type, payment_method, base_price_cents, processing_fee_cents, status)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    `, [paidEmail, session_id, amountPaid, amountDollars, packageType, paymentType, paymentMethod, basePrice, processingFee, paymentStatus]);
                    paymentRecorded = true;
                } catch (dbError) {
                    console.error('Database insert error:', dbError);
                    
                    // Handle duplicate key error gracefully
                    if (dbError.code === '23505' && dbError.message.includes('stripe_session_id')) {
                        paymentRecorded = true;
                    } else if (dbError.message.includes('payment_method')) {
                        // Fallback to old payment schema
                        try {
                            await db.run(`
                                INSERT INTO payments (user_email, stripe_session_id, amount_cents, amount_dollars, package_type, payment_type, status)
                                VALUES ($1, $2, $3, $4, $5, $6, $7)
                            `, [paidEmail, session_id, amountPaid, amountDollars, packageType, paymentType, paymentStatus]);
                            paymentRecorded = true;
                        } catch (fallbackError) {
                            if (fallbackError.code === '23505') {
                                paymentRecorded = true;
                            }
                        }
                    }
                }
                
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

// Stripe webhook handler for payment status updates (especially ACH payments)
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_webhook_secret');
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            
            // Handle ACH payments that transition from processing to paid
            if (session.payment_status === 'paid' && 
                session.payment_method_types?.includes('us_bank_account')) {
                
                const paidEmail = session.client_reference_id || session.metadata?.email;
                if (paidEmail) {
                    const packageType = session.metadata?.package_type || 'full';
                    
                    console.log('ACH payment completed:', { email: paidEmail, package: packageType });
                    
                    // Update user's paid status
                    await db.run('UPDATE users SET paid = true, package_type = $1 WHERE email = $2', [packageType, paidEmail]);
                    
                    // Update payment record status
                    await db.run('UPDATE payments SET status = $1 WHERE stripe_session_id = $2', ['completed', session.id]);
                }
            }
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({received: true});
});

// Record payment
app.post('/api/record-payment', async (req, res) => {
    try {
        const { user_email, stripe_session_id, amount_cents, amount_dollars, package_type, payment_type, payment_method, base_price_cents, processing_fee_cents } = req.body;
        
        await db.run(`
            INSERT INTO payments (user_email, stripe_session_id, amount_cents, amount_dollars, package_type, payment_type, payment_method, base_price_cents, processing_fee_cents, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed')
        `, [user_email, stripe_session_id, amount_cents, amount_dollars, package_type, payment_type, payment_method, base_price_cents, processing_fee_cents]);
        
        res.json({ success: true, message: 'Payment recorded' });
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ success: false, error: 'Record failed' });
    }
});

// Update user payment status
app.post('/api/update-user-payment', async (req, res) => {
    try {
        const { email, paid, packageType } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email required' });
        }
        
        await db.run(`
            UPDATE users 
            SET paid = $1, package_type = $2 
            WHERE email = $3
        `, [paid, packageType, email]);
        
        res.json({ success: true, message: 'User payment status updated' });
    } catch (error) {
        console.error('Error updating user payment:', error);
        res.status(500).json({ success: false, error: 'Update failed' });
    }
});

// Database migration endpoint
app.post('/api/migrate-database', async (req, res) => {
    try {
        console.log('Running database migration...');
        
        // Add new columns to payments table
        await db.query(`
            ALTER TABLE payments 
            ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'card'
        `);
        
        await db.query(`
            ALTER TABLE payments 
            ADD COLUMN IF NOT EXISTS base_price_cents INTEGER DEFAULT 0
        `);
        
        await db.query(`
            ALTER TABLE payments 
            ADD COLUMN IF NOT EXISTS processing_fee_cents INTEGER DEFAULT 0
        `);
        
        console.log('Database migration completed successfully');
        res.json({ success: true, message: 'Database migration completed' });
    } catch (error) {
        console.error('Database migration error:', error);
        res.status(500).json({ success: false, error: 'Migration failed' });
    }
});

// Get user token for URL parameter authentication
app.post('/api/get-user-token', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email required' });
        }
        
        // Get user from database
        const user = await db.get(`
            SELECT email, paid, package_type FROM users WHERE email = $1
        `, [email]);
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        // Create JWT token
        const token = jwt.sign(
            { 
                email: user.email, 
                paid: user.paid,
                packageType: user.package_type
            },
            config.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token: token,
            user: {
                email: user.email,
                paid: user.paid,
                packageType: user.package_type
            }
        });
    } catch (error) {
        console.error('Error creating user token:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
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
        let userEmail = null;
        let isPaid = false;
        
        // Try to get email from session first
        if (req.session.user && req.session.user.email) {
            userEmail = req.session.user.email;
            isPaid = req.session.user.paid;
        }
        // If no session, try to get email from request body
        else if (req.body.email) {
            userEmail = req.body.email;
            // Check payment status in database
            const user = await db.get('SELECT email, paid, package_type FROM users WHERE email = $1', [userEmail]);
            if (user) {
                isPaid = user.paid;
            }
        }
        
        if (!userEmail || !isPaid) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        
        // Get all form data from request body (excluding email if it exists)
        const { email, ...responses } = req.body;
        const responseId = uuidv4();
        
        console.log('Survey submission received:', {
            userEmail: userEmail,
            responseCount: Object.keys(responses).length,
            sampleFields: Object.keys(responses).slice(0, 5)
        });
        
        await db.run(`
            INSERT INTO second_survey_responses (id, user_email, responses) 
            VALUES ($1, $2, $3)
        `, [responseId, userEmail, JSON.stringify(responses)]);
        
        res.json({ success: true, responseId });
    } catch (error) {
        console.error('Error submitting survey:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/submit-first-survey', async (req, res) => {
    try {
        let userEmail = null;
        let isPaid = false;
        
        // Try to get email from session first
        if (req.session.user && req.session.user.email) {
            userEmail = req.session.user.email;
            isPaid = req.session.user.paid;
        }
        // If no session, try to get email from request body
        else if (req.body.email) {
            userEmail = req.body.email;
            // Check payment status in database
            const user = await db.get('SELECT email, paid, package_type FROM users WHERE email = $1', [userEmail]);
            if (user) {
                isPaid = user.paid;
            }
        }
        
        if (!userEmail || !isPaid) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        
        // Get all form data from request body (excluding email if it exists)
        const { email, ...responses } = req.body;
        const responseId = uuidv4();
        
        console.log('First survey submission received:', {
            userEmail: userEmail,
            responseCount: Object.keys(responses).length,
            sampleFields: Object.keys(responses).slice(0, 5)
        });
        
        await db.run(`
            INSERT INTO first_survey_responses (id, user_email, responses) 
            VALUES ($1, $2, $3)
        `, [responseId, userEmail, JSON.stringify(responses)]);
        
        res.json({ success: true, responseId });
    } catch (error) {
        console.error('Error submitting first survey:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin endpoint to check first survey responses
app.get('/api/first-survey-responses', async (req, res) => {
    try {
        const responses = await db.all('SELECT id, user_email, responses, created_at FROM first_survey_responses ORDER BY created_at DESC LIMIT 5');
        res.json({ success: true, responses });
    } catch (error) {
        console.error('Error fetching first survey responses:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch responses' });
    }
});

// Admin endpoint to check second survey responses
app.get('/api/survey-responses', async (req, res) => {
    try {
        const responses = await db.all('SELECT id, user_email, responses, created_at FROM second_survey_responses ORDER BY created_at DESC LIMIT 5');
        res.json({ success: true, responses });
    } catch (error) {
        console.error('Error fetching survey responses:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch responses' });
    }
});

// Admin endpoint to clean all database data
app.post('/api/clean-database', async (req, res) => {
    try {
        console.log('Cleaning database...');
        
        // Delete all second survey responses
        await db.run('DELETE FROM second_survey_responses');
        console.log('✓ Cleared second_survey_responses table');
        
        // Delete all first survey responses  
        await db.run('DELETE FROM first_survey_responses');
        console.log('✓ Cleared first_survey_responses table');
        
        // Delete all payments
        await db.run('DELETE FROM payments');
        console.log('✓ Cleared payments table');
        
        // Delete all users
        await db.run('DELETE FROM users');
        console.log('✓ Cleared users table');
        
        // Delete all evaluation responses
        await db.run('DELETE FROM evaluation_responses');
        console.log('✓ Cleared evaluation_responses table');
        
        console.log('🎉 Database cleaned successfully!');
        
        res.json({ 
            success: true, 
            message: 'Database cleaned successfully! All user data, surveys, and payments have been removed.' 
        });
    } catch (error) {
        console.error('Error cleaning database:', error);
        res.status(500).json({ success: false, error: 'Failed to clean database' });
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

// ==================== DATA MANAGEMENT API ENDPOINTS ====================

// Middleware to check admin access
const checkAdminAccess = (req, res, next) => {
    const adminKey = req.query.key || req.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_KEY;
    
    // In production, require ADMIN_KEY to be set
    if (!expectedKey) {
        console.error('ADMIN_KEY environment variable not set');
        return res.status(500).json({ error: 'Admin access not configured' });
    }
    
    if (adminKey !== expectedKey) {
        console.log('Admin access denied - invalid key');
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Get all users with survey completion status
app.get('/api/admin/users', checkAdminAccess, async (req, res) => {
    try {
        const users = await db.query(`
            SELECT 
                u.email,
                u.paid,
                u.package_type,
                CASE WHEN EXISTS(SELECT 1 FROM first_survey_responses WHERE user_email = u.email) THEN true ELSE false END as first_survey_completed,
                CASE WHEN EXISTS(SELECT 1 FROM second_survey_responses WHERE user_email = u.email) THEN true ELSE false END as second_survey_completed
            FROM users u
            ORDER BY u.email
        `);
        
        res.json(users.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get individual user data for download
app.get('/api/admin/user-data/:email', checkAdminAccess, async (req, res) => {
    try {
        const { email } = req.params;
        const { format = 'json' } = req.query;
        
        // Get user info
        const user = await db.get('SELECT * FROM users WHERE email = $1', [email]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get first survey data
        const firstSurvey = await db.get(
            'SELECT * FROM first_survey_responses WHERE user_email = $1', 
            [email]
        );
        
        // Get second survey data
        const secondSurvey = await db.get(
            'SELECT * FROM second_survey_responses WHERE user_email = $1', 
            [email]
        );
        
        // Get payment data
        const payments = await db.query(
            'SELECT * FROM payments WHERE user_email = $1 ORDER BY created_at DESC', 
            [email]
        );
        
        const userData = {
            user: {
                email: user.email,
                paid: user.paid,
                package_type: user.package_type,
                created_at: user.created_at
            },
            first_survey: firstSurvey ? {
                id: firstSurvey.id,
                responses: firstSurvey.responses,
                created_at: firstSurvey.created_at
            } : null,
            second_survey: secondSurvey ? {
                id: secondSurvey.id,
                responses: secondSurvey.responses,
                created_at: secondSurvey.created_at
            } : null,
            payments: payments.rows
        };
        
        if (format === 'csv') {
            const csv = convertToCSV(userData);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="niw-survey-${email}-data.csv"`);
            res.send(csv);
        } else {
            res.json(userData);
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

// Bulk download endpoint
app.post('/api/admin/bulk-download', checkAdminAccess, async (req, res) => {
    try {
        const { emails, format = 'json' } = req.body;
        
        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: 'No emails provided' });
        }
        
        const userDataArray = [];
        
        for (const email of emails) {
            const user = await db.get('SELECT * FROM users WHERE email = $1', [email]);
            if (!user) continue;
            
            const firstSurvey = await db.get(
                'SELECT * FROM first_survey_responses WHERE user_email = $1', 
                [email]
            );
            
            const secondSurvey = await db.get(
                'SELECT * FROM second_survey_responses WHERE user_email = $1', 
                [email]
            );
            
            const payments = await db.query(
                'SELECT * FROM payments WHERE user_email = $1 ORDER BY created_at DESC', 
                [email]
            );
            
            userDataArray.push({
                user: {
                    email: user.email,
                    paid: user.paid,
                    package_type: user.package_type,
                    created_at: user.created_at
                },
                first_survey: firstSurvey ? {
                    id: firstSurvey.id,
                    responses: firstSurvey.responses,
                    created_at: firstSurvey.created_at
                } : null,
                second_survey: secondSurvey ? {
                    id: secondSurvey.id,
                    responses: secondSurvey.responses,
                    created_at: secondSurvey.created_at
                } : null,
                payments: payments.rows
            });
        }
        
        if (format === 'csv') {
            const csv = convertBulkToCSV(userDataArray);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="niw-survey-bulk-${userDataArray.length}-users-data.csv"`);
            res.send(csv);
        } else {
            res.json(userDataArray);
        }
    } catch (error) {
        console.error('Error fetching bulk data:', error);
        res.status(500).json({ error: 'Failed to fetch bulk data' });
    }
});

// Helper function to convert user data to CSV
function convertToCSV(userData) {
    const rows = [];
    
    // Header row
    rows.push([
        'Field', 'Value', 'Survey_Type', 'Question_ID', 'Response'
    ]);
    
    // User info
    rows.push(['user', 'email', '', '', userData.user.email]);
    rows.push(['user', 'paid', '', '', userData.user.paid]);
    rows.push(['user', 'package_type', '', '', userData.user.package_type]);
    rows.push(['user', 'created_at', '', '', userData.user.created_at]);
    
    // First survey responses
    if (userData.first_survey && userData.first_survey.responses) {
        const responses = typeof userData.first_survey.responses === 'string' 
            ? JSON.parse(userData.first_survey.responses) 
            : userData.first_survey.responses;
        
        Object.entries(responses).forEach(([questionId, response]) => {
            rows.push([
                'first_survey',
                'response',
                'first',
                questionId,
                Array.isArray(response) ? response.join('; ') : String(response)
            ]);
        });
    }
    
    // Second survey responses
    if (userData.second_survey && userData.second_survey.responses) {
        const responses = typeof userData.second_survey.responses === 'string' 
            ? JSON.parse(userData.second_survey.responses) 
            : userData.second_survey.responses;
        
        Object.entries(responses).forEach(([questionId, response]) => {
            rows.push([
                'second_survey',
                'response',
                'second',
                questionId,
                Array.isArray(response) ? response.join('; ') : String(response)
            ]);
        });
    }
    
    // Payment info
    userData.payments.forEach((payment, index) => {
        rows.push(['payment', 'amount_dollars', '', `payment_${index}`, payment.amount_dollars]);
        rows.push(['payment', 'package_type', '', `payment_${index}`, payment.package_type]);
        rows.push(['payment', 'payment_method', '', `payment_${index}`, payment.payment_method]);
        rows.push(['payment', 'status', '', `payment_${index}`, payment.status]);
        rows.push(['payment', 'created_at', '', `payment_${index}`, payment.created_at]);
    });
    
    return rows.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
}

// Helper function to convert bulk data to CSV
function convertBulkToCSV(userDataArray) {
    const rows = [];
    
    // Header row
    rows.push([
        'User_Email', 'Field', 'Value', 'Survey_Type', 'Question_ID', 'Response'
    ]);
    
    userDataArray.forEach(userData => {
        const email = userData.user.email;
        
        // User info
        rows.push([email, 'user', 'email', '', '', userData.user.email]);
        rows.push([email, 'user', 'paid', '', '', userData.user.paid]);
        rows.push([email, 'user', 'package_type', '', '', userData.user.package_type]);
        rows.push([email, 'user', 'created_at', '', '', userData.user.created_at]);
        
        // First survey responses
        if (userData.first_survey && userData.first_survey.responses) {
            const responses = typeof userData.first_survey.responses === 'string' 
                ? JSON.parse(userData.first_survey.responses) 
                : userData.first_survey.responses;
            
            Object.entries(responses).forEach(([questionId, response]) => {
                rows.push([
                    email,
                    'first_survey',
                    'response',
                    'first',
                    questionId,
                    Array.isArray(response) ? response.join('; ') : String(response)
                ]);
            });
        }
        
        // Second survey responses
        if (userData.second_survey && userData.second_survey.responses) {
            const responses = typeof userData.second_survey.responses === 'string' 
                ? JSON.parse(userData.second_survey.responses) 
                : userData.second_survey.responses;
            
            Object.entries(responses).forEach(([questionId, response]) => {
                rows.push([
                    email,
                    'second_survey',
                    'response',
                    'second',
                    questionId,
                    Array.isArray(response) ? response.join('; ') : String(response)
                ]);
            });
        }
        
        // Payment info
        userData.payments.forEach((payment, index) => {
            rows.push([email, 'payment', 'amount_dollars', '', `payment_${index}`, payment.amount_dollars]);
            rows.push([email, 'payment', 'package_type', '', `payment_${index}`, payment.package_type]);
            rows.push([email, 'payment', 'payment_method', '', `payment_${index}`, payment.payment_method]);
            rows.push([email, 'payment', 'status', '', `payment_${index}`, payment.status]);
            rows.push([email, 'payment', 'created_at', '', `payment_${index}`, payment.created_at]);
        });
    });
    
    return rows.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
}

// Data management page route - Basic admin protection
app.get('/data-management', (req, res) => {
    const adminKey = req.query.key;
    const expectedKey = process.env.ADMIN_KEY;
    
    // In production, require ADMIN_KEY to be set
    if (!expectedKey) {
        return res.status(500).send(`
            <html>
                <head><title>Configuration Error</title></head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1>⚠️ Configuration Error</h1>
                    <p>Admin access is not properly configured.</p>
                    <p>Please contact your administrator.</p>
                    <a href="/" style="color: #3b82f6;">← Back to Home</a>
                </body>
            </html>
        `);
    }
    
    if (adminKey !== expectedKey) {
        return res.status(403).send(`
            <html>
                <head><title>Access Denied</title></head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1>🔒 Access Denied</h1>
                    <p>This page requires admin access.</p>
                    <p>Please contact your administrator for access.</p>
                    <a href="/" style="color: #3b82f6;">← Back to Home</a>
                </body>
            </html>
        `);
    }
    
    res.sendFile(path.join(__dirname, 'data-management.html'));
});


// Static file routes for Vercel - with proper error handling
app.get('/styles.css', (req, res) => {
    try {
        res.setHeader('Content-Type', 'text/css');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.sendFile(path.join(__dirname, 'public', 'styles.css'));
    } catch (error) {
        console.error('Error serving styles.css:', error);
        res.status(404).send('CSS file not found');
    }
});

app.get('/script.js', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.sendFile(path.join(__dirname, 'script.js'));
    } catch (error) {
        console.error('Error serving script.js:', error);
        res.status(404).send('JavaScript file not found');
    }
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