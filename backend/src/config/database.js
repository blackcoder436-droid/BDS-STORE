/**
 * ============================================
 * BDS STORE VPN Backend - Database Configuration
 * ဒေတာဘေ့စ် ဖွဲ့စည်းမှု - PostgreSQL + Sequelize
 * ============================================
 *
 * Sequelize ORM instance configured for PostgreSQL.
 * Includes connection pool settings and winston-based logging.
 *
 * PostgreSQL အတွက် Sequelize ORM instance ဖွဲ့စည်းထားသည်
 */

const { Sequelize } = require('sequelize');
const config = require('./index');
const logger = require('../utils/logger');

/**
 * Sequelize instance connected to PostgreSQL
 * PostgreSQL သို့ ချိတ်ဆက်ထားသော Sequelize instance
 *
 * @type {Sequelize}
 */
const sequelize = new Sequelize(
  config.db.name,
  config.db.user,
  config.db.password,
  {
    host: config.db.host,
    port: config.db.port,
    dialect: 'postgres',

    // Logging: pipe SQL queries through winston
    // SQL queries များကို winston မှတဆင့် log ပြုလုပ်ခြင်း
    logging: (msg) => logger.debug(`[Sequelize] ${msg}`),

    // Connection pool configuration
    // ချိတ်ဆက်မှု pool ဖွဲ့စည်းမှု
    pool: {
      max: 10,        // Maximum number of connections in pool
      min: 2,         // Minimum number of connections in pool
      acquire: 30000, // Max time (ms) to acquire a connection before throwing error
      idle: 10000,    // Max time (ms) a connection can be idle before being released
    },

    // Additional Sequelize options
    define: {
      timestamps: true,  // Auto-add createdAt & updatedAt
      underscored: false, // Use camelCase column names
      freezeTableName: true, // Use model name as table name directly
    },

    // Timezone configuration
    timezone: '+00:00', // Store all dates in UTC
  }
);

/**
 * Test the database connection
 * ဒေတာဘေ့စ် ချိတ်ဆက်မှုကို စမ်းသပ်ခြင်း
 *
 * @returns {Promise<boolean>} True if connection is successful
 */
async function testConnection() {
  try {
    await sequelize.authenticate();
    logger.info('✅ PostgreSQL database connection established successfully.');
    return true;
  } catch (error) {
    logger.error('❌ Unable to connect to PostgreSQL database:', error.message);
    throw error;
  }
}

/**
 * Sync all models with the database
 * Model အားလုံးကို ဒေတာဘေ့စ်နှင့် sync ပြုလုပ်ခြင်း
 *
 * @param {Object} options - Sequelize sync options
 * @param {boolean} [options.force=false] - Drop tables before recreating
 * @param {boolean} [options.alter=false] - Alter existing tables to match models
 * @returns {Promise<void>}
 */
async function syncDatabase(options = {}) {
  try {
    await sequelize.sync(options);
    logger.info('✅ Database models synced successfully.');
  } catch (error) {
    logger.error('❌ Database sync failed:', error.message);
    throw error;
  }
}

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
};
