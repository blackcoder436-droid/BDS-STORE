/**
 * ============================================
 * BDS STORE VPN Backend - Database Sync Script
 * ဒေတာဘေ့စ် Sync Script - npm run db:sync
 * ============================================
 *
 * Standalone script to synchronize Sequelize models with PostgreSQL.
 * Use --force flag to drop and recreate tables (WARNING: destroys data).
 * Use --alter flag to alter existing tables to match models.
 *
 * Sequelize models ကို PostgreSQL နှင့် sync ပြုလုပ်သော standalone script
 */

const { testConnection, syncDatabase, sequelize } = require('../config/database');

// Import models to register them with Sequelize
// Sequelize နှင့် မှတ်ပုံတင်ရန် models ကို import ပြုလုပ်ခြင်း
require('../models');

const logger = require('../utils/logger');

/**
 * Parse command line arguments for sync options
 * Sync options အတွက် command line arguments ကို ခွဲခြမ်းစိတ်ဖြာခြင်း
 */
const args = process.argv.slice(2);
const useForce = args.includes('--force');
const useAlter = args.includes('--alter');

async function run() {
  try {
    logger.info('=== BDS STORE VPN Database Sync ===');

    if (useForce) {
      logger.warn('⚠️  --force flag detected: All tables will be DROPPED and RECREATED!');
      logger.warn('   This will DESTROY all existing data!');
    }

    // Test connection first | အရင် ချိတ်ဆက်မှုကို စမ်းသပ်ခြင်း
    await testConnection();

    // Sync models | Models ကို sync ပြုလုပ်ခြင်း
    const syncOptions = {};
    if (useForce) syncOptions.force = true;
    else if (useAlter) syncOptions.alter = true;
    else syncOptions.alter = true; // Default to alter

    await syncDatabase(syncOptions);

    logger.info('✅ Database sync completed successfully!');
    logger.info('   Tables synced: users, sessions');
  } catch (error) {
    logger.error('❌ Database sync failed:', { error: error.message });
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

run();
