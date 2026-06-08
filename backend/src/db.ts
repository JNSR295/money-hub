import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
});

// Helper function to run query
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
}

export async function initializeDatabase() {
  console.log('🔄 Initializing database schema...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create session table for connect-pg-simple
    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `);
    
    // Create session index if it doesn't exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        two_factor_secret TEXT,
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migrations to support existing users tables
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);`);

    // Create credentials table (stores API keys, encrypted)
    await client.query(`
      CREATE TABLE IF NOT EXISTS credentials (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        truelayer_client_id TEXT,
        truelayer_client_secret TEXT,
        truelayer_access_token TEXT,
        truelayer_refresh_token TEXT,
        trading212_api_key TEXT,
        paypal_client_id TEXT,
        paypal_client_secret TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create user_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        baseline_income NUMERIC(12, 2) DEFAULT 0.00,
        current_age INTEGER DEFAULT 30,
        retirement_age INTEGER DEFAULT 65,
        pension_pot NUMERIC(12, 2) DEFAULT 0.00,
        pension_contribution NUMERIC(12, 2) DEFAULT 0.00,
        pension_growth_rate NUMERIC(4, 2) DEFAULT 5.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create debts_metadata table
    await client.query(`
      CREATE TABLE IF NOT EXISTS debts_metadata (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        provider_name VARCHAR(100) NOT NULL,
        account_type VARCHAR(50) NOT NULL,
        interest_rate_apr NUMERIC(5, 2) NOT NULL,
        monthly_payoff_amount NUMERIC(12, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create bills table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bills (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        duration_type VARCHAR(20) CHECK (duration_type IN ('forever', 'fixed')) NOT NULL,
        duration_months INTEGER,
        start_date DATE NOT NULL,
        category VARCHAR(50) DEFAULT 'bill',
        target_account_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration to support category and target_account_id in bills table
    await client.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'bill';`);
    await client.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS target_account_id VARCHAR(100);`);

    // Create budget_allocations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS budget_allocations (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        savings_allocation NUMERIC(12, 2) DEFAULT 0.00,
        treats_allocation NUMERIC(12, 2) DEFAULT 0.00,
        food_allocation NUMERIC(12, 2) DEFAULT 0.00,
        car_allocation NUMERIC(12, 2) DEFAULT 0.00
      );
    `);

    // Create manual_accounts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS manual_accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        provider VARCHAR(100) NOT NULL,
        balance NUMERIC(12, 2) DEFAULT 0.00,
        type VARCHAR(50) CHECK (type IN ('current', 'savings', 'investments', 'pension')) NOT NULL,
        interest_rate NUMERIC(5, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration to support interest_rate in manual_accounts
    await client.query(`ALTER TABLE manual_accounts ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5, 2) DEFAULT 0.00;`);

    await client.query('COMMIT');
    console.log('✅ Database schema initialized successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
}
