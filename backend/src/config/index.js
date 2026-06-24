/**
 * ============================================
 * BDS STORE VPN Backend - App Configuration
 * အက်ပ် ဖွဲ့စည်းမှု - Environment variables မှ ဖတ်ယူခြင်း
 * ============================================
 * 
 * Centralized configuration object that reads from environment variables.
 * All config values should be accessed through this module.
 * ပတ်ဝန်းကျင် ကိန်းရှင်များမှ ဖတ်ယူသော ဗဟိုချုပ်ကိုင်မှု ဖွဲ့စည်းမှု object
 */

const dotenv = require('dotenv');
const path = require('path');

// Load .env file from project root
// ပရောဂျက် root မှ .env ဖိုင်ကို ဖတ်ယူခြင်း
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Application configuration object
 * All environment variables are centralized here
 * @type {Object}
 */
const config = {
  // --- Server ---
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',

  // --- Database (PostgreSQL) ---
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'bds_store_vpn',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  },

  // --- JWT Authentication ---
  jwt: {
    secret: process.env.JWT_SECRET || 'default_jwt_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // --- AdMob Configuration ---
  admob: {
    /** Hours of VPN time per ad reward | ကြော်ငြာ ဆုလာဘ်အတွက် VPN အချိန် (နာရီ) */
    rewardDurationHours: parseInt(process.env.ADMOB_REWARD_DURATION_HOURS, 10) || 2,
    /** Google's public key server for SSV verification */
    keyServerUrl: process.env.GOOGLE_ADMOB_KEY_SERVER_URL || 'https://www.gstatic.com/admob/reward/verifier-keys.json',
  },

  // --- 3x-ui (Xray Core) Panel ---
  xui: {
    panelUrl: process.env.XUI_PANEL_URL || 'http://localhost:2053',
    username: process.env.XUI_USERNAME || 'admin',
    password: process.env.XUI_PASSWORD || 'admin',
    defaultInboundId: parseInt(process.env.XUI_DEFAULT_INBOUND_ID, 10) || 1,
  },

  // --- Rate Limiting ---
  rateLimit: {
    general: parseInt(process.env.RATE_LIMIT_GENERAL, 10) || 100,
    auth: parseInt(process.env.RATE_LIMIT_AUTH, 10) || 5,
    ads: parseInt(process.env.RATE_LIMIT_ADS, 10) || 10,
    windowMinutes: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 10) || 15,
  },

  // --- Logging ---
  logLevel: process.env.LOG_LEVEL || 'debug',
};

module.exports = config;
