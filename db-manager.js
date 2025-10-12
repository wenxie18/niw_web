#!/usr/bin/env node

const { Pool } = require('pg');

// Your PostgreSQL connection string
const connectionString = 'postgresql://neondb_owner:npg_o2WP3jeFUZEc@ep-rapid-frost-ad3gjqzc-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
    connectionString: connectionString
});

async function queryDatabase(sql, params = []) {
    const client = await pool.connect();
    try {
        const result = await client.query(sql, params);
        return result;
    } finally {
        client.release();
    }
}

async function getTableCounts() {
    console.log('📊 Database Table Counts:');
    console.log('========================');
    
    const tables = ['users', 'payments', 'first_survey_responses', 'second_survey_responses', 'evaluation_responses'];
    
    for (const table of tables) {
        try {
            const result = await queryDatabase(`SELECT COUNT(*) as count FROM ${table}`);
            console.log(`${table.padEnd(25)}: ${result.rows[0].count} records`);
        } catch (error) {
            console.log(`${table.padEnd(25)}: Error - ${error.message}`);
        }
    }
    console.log('');
}

async function cleanDatabase() {
    console.log('🧹 Cleaning Database...');
    console.log('======================');
    
    const tables = ['second_survey_responses', 'first_survey_responses', 'payments', 'users', 'evaluation_responses'];
    
    for (const table of tables) {
        try {
            const result = await queryDatabase(`DELETE FROM ${table}`);
            console.log(`✓ Cleared ${table} (${result.rowCount} records deleted)`);
        } catch (error) {
            console.log(`✗ Error clearing ${table}: ${error.message}`);
        }
    }
    console.log('\n🎉 Database cleaned successfully!\n');
}

async function showRecentData() {
    console.log('📋 Recent Data:');
    console.log('===============');
    
    // Show recent users
    try {
        const users = await queryDatabase('SELECT email, paid, package_type, created_at FROM users ORDER BY created_at DESC LIMIT 5');
        if (users.rows.length > 0) {
            console.log('\n👥 Recent Users:');
            users.rows.forEach(user => {
                console.log(`  ${user.email} | Paid: ${user.paid} | Package: ${user.package_type} | ${user.created_at}`);
            });
        }
    } catch (error) {
        console.log('No users found or error:', error.message);
    }
    
    // Show recent payments
    try {
        const payments = await queryDatabase('SELECT user_email, amount_cents, payment_method, status, created_at FROM payments ORDER BY created_at DESC LIMIT 5');
        if (payments.rows.length > 0) {
            console.log('\n💳 Recent Payments:');
            payments.rows.forEach(payment => {
                console.log(`  ${payment.user_email} | $${(payment.amount_cents/100).toFixed(2)} | ${payment.payment_method} | ${payment.status} | ${payment.created_at}`);
            });
        }
    } catch (error) {
        console.log('No payments found or error:', error.message);
    }
    
    // Show recent first surveys
    try {
        const firstSurveys = await queryDatabase('SELECT user_email, created_at FROM first_survey_responses ORDER BY created_at DESC LIMIT 3');
        if (firstSurveys.rows.length > 0) {
            console.log('\n📝 Recent First Surveys:');
            firstSurveys.rows.forEach(survey => {
                console.log(`  ${survey.user_email} | ${survey.created_at}`);
            });
        }
    } catch (error) {
        console.log('No first surveys found or error:', error.message);
    }
    
    // Show recent second surveys
    try {
        const secondSurveys = await queryDatabase('SELECT user_email, created_at FROM second_survey_responses ORDER BY created_at DESC LIMIT 3');
        if (secondSurveys.rows.length > 0) {
            console.log('\n📋 Recent Second Surveys:');
            secondSurveys.rows.forEach(survey => {
                console.log(`  ${survey.user_email} | ${survey.created_at}`);
            });
        }
    } catch (error) {
        console.log('No second surveys found or error:', error.message);
    }
    
    console.log('');
}

async function runCustomQuery(query) {
    try {
        console.log(`🔍 Running Query: ${query}`);
        console.log('================');
        const result = await queryDatabase(query);
        
        if (result.rows.length === 0) {
            console.log('No results found.');
        } else {
            console.log(`Found ${result.rows.length} rows:`);
            console.table(result.rows);
        }
    } catch (error) {
        console.log(`❌ Query Error: ${error.message}`);
    }
    console.log('');
}

// Main function
async function main() {
    const command = process.argv[2];
    const query = process.argv.slice(3).join(' ');
    
    try {
        switch (command) {
            case 'status':
            case 'count':
                await getTableCounts();
                break;
                
            case 'clean':
            case 'clear':
                await cleanDatabase();
                await getTableCounts();
                break;
                
            case 'recent':
            case 'data':
                await getTableCounts();
                await showRecentData();
                break;
                
            case 'query':
            case 'sql':
                if (!query) {
                    console.log('Usage: node db-manager.js query "SELECT * FROM users"');
                    break;
                }
                await runCustomQuery(query);
                break;
                
            default:
                console.log('🗄️  Database Manager');
                console.log('==================');
                console.log('');
                console.log('Usage:');
                console.log('  node db-manager.js status     - Show table counts');
                console.log('  node db-manager.js clean      - Clean all data');
                console.log('  node db-manager.js recent     - Show recent data');
                console.log('  node db-manager.js query "SQL" - Run custom query');
                console.log('');
                console.log('Examples:');
                console.log('  node db-manager.js status');
                console.log('  node db-manager.js clean');
                console.log('  node db-manager.js query "SELECT email, paid FROM users"');
                console.log('  node db-manager.js query "SELECT * FROM payments WHERE payment_method = \'ach\'"');
                console.log('  node db-manager.js query "SELECT * FROM first_survey_responses"');
                console.log('  node db-manager.js query "SELECT * FROM second_survey_responses"');
                break;
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

main();
