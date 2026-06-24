/**
 * ============================================
 * BDS STORE VPN Backend - Auto Database Creation Script
 * ဒေတာဘေ့စ် အလိုအလျောက် တည်ဆောက်ခြင်း Script
 * ============================================
 */

const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
};

const targetDbName = process.env.DB_NAME || 'bds_store_vpn';

async function createDatabase() {
  // Connect to the default 'postgres' database
  const client = new Client({
    ...dbConfig,
    database: 'postgres',
  });

  try {
    console.log(`Connecting to PostgreSQL at ${dbConfig.host}:${dbConfig.port} as ${dbConfig.user}...`);
    await client.connect();
    console.log('✅ Connected to default PostgreSQL database.');

    // Check if the database already exists
    const res = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDbName]
    );

    if (res.rows.length === 0) {
      console.log(`Database '${targetDbName}' does not exist. Creating it...`);
      // CREATE DATABASE cannot be executed inside a transaction block
      await client.query(`CREATE DATABASE ${targetDbName}`);
      console.log(`✅ Database '${targetDbName}' created successfully.`);
    } else {
      console.log(`ℹ️ Database '${targetDbName}' already exists. No creation needed.`);
    }
  } catch (error) {
    console.error('❌ Error checking/creating database:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createDatabase();
