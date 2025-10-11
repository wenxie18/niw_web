// Database configuration for Vercel + Neon PostgreSQL
const { sql } = require('@vercel/postgres');

// Database helper functions
class Database {
    constructor() {
        this.isProduction = process.env.NODE_ENV === 'production';
    }

    // Execute SQL query
    async query(text, params = []) {
        try {
            console.log('Executing query:', text.substring(0, 100) + '...');
            const result = await sql.query(text, params);
            console.log('Query executed successfully');
            return result;
        } catch (error) {
            console.error('Database query error:', error);
            console.error('Query was:', text);
            console.error('Params were:', params);
            throw error;
        }
    }

    // Get single row
    async get(text, params = []) {
        const result = await this.query(text, params);
        return result.rows[0] || null;
    }

    // Get all rows
    async all(text, params = []) {
        const result = await this.query(text, params);
        return result.rows;
    }

    // Run query (for INSERT, UPDATE, DELETE)
    async run(text, params = []) {
        const result = await this.query(text, params);
        return {
            lastID: result.rows[0]?.id || null,
            changes: result.rowCount || 0
        };
    }

    // Initialize database tables
    async initDatabase() {
        console.log('Initializing database tables...');
        
        try {
            // Create users table
            await this.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    paid BOOLEAN DEFAULT FALSE,
                    package_type TEXT DEFAULT 'full',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create survey_responses table
            await this.query(`
                CREATE TABLE IF NOT EXISTS survey_responses (
                    id TEXT PRIMARY KEY,
                    user_email TEXT NOT NULL,
                    responses JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_email) REFERENCES users (email)
                )
            `);

            // Create first_survey_responses table
            await this.query(`
                CREATE TABLE IF NOT EXISTS first_survey_responses (
                    id TEXT PRIMARY KEY,
                    user_email TEXT NOT NULL,
                    responses JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_email) REFERENCES users (email)
                )
            `);

            // Create first_survey_fields table
            await this.query(`
                CREATE TABLE IF NOT EXISTS first_survey_fields (
                    id SERIAL PRIMARY KEY,
                    field_name TEXT NOT NULL,
                    field_type TEXT NOT NULL,
                    field_label TEXT NOT NULL,
                    is_required BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create payments table
            await this.query(`
                CREATE TABLE IF NOT EXISTS payments (
                    id SERIAL PRIMARY KEY,
                    user_email TEXT NOT NULL,
                    stripe_session_id TEXT UNIQUE NOT NULL,
                    amount_cents INTEGER NOT NULL,
                    amount_dollars REAL NOT NULL,
                    package_type TEXT NOT NULL,
                    payment_type TEXT NOT NULL,
                    payment_method TEXT DEFAULT 'card',
                    base_price_cents INTEGER DEFAULT 0,
                    processing_fee_cents INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'completed',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_email) REFERENCES users (email)
                )
            `);

            // Create evaluation_responses table
            await this.query(`
                CREATE TABLE IF NOT EXISTS evaluation_responses (
                    id SERIAL PRIMARY KEY,
                    email TEXT NOT NULL,
                    name TEXT NOT NULL,
                    education TEXT NOT NULL,
                    publications INTEGER NOT NULL,
                    citations INTEGER NOT NULL,
                    research_field TEXT NOT NULL,
                    work_experience INTEGER NOT NULL,
                    current_position TEXT NOT NULL,
                    awards TEXT NOT NULL,
                    grants TEXT NOT NULL,
                    patents TEXT NOT NULL,
                    research_description TEXT,
                    timeline TEXT,
                    evaluation_score INTEGER,
                    evaluation_recommendations TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            console.log('Database tables initialized successfully');
        } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }
}

// Export singleton instance
const db = new Database();
module.exports = db;
