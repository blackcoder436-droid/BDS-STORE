/**
 * ============================================
 * BDS STORE VPN Backend - Models Index
 * Model များ စုစည်းခြင်း - Associations & Initialization
 * ============================================
 *
 * Central module that initializes all Sequelize models and
 * defines their associations (relationships).
 *
 * Sequelize model အားလုံးကို initialize ပြုလုပ်ပြီး
 * ၎င်းတို့၏ ဆက်နွယ်မှုများကို သတ်မှတ်သည်
 */

const { sequelize } = require('../config/database');
const User = require('./User');
const Session = require('./Session');
const logger = require('../utils/logger');

/**
 * Define model associations / relationships
 * Model ဆက်နွယ်မှုများ သတ်မှတ်ခြင်း
 *
 * User hasMany Sessions - A user can have multiple VPN sessions
 * Session belongsTo User - Each session belongs to one user
 */

// User -> Sessions (One-to-Many)
// သုံးစွဲသူ တစ်ဦးတွင် VPN session များစွာ ရှိနိုင်သည်
User.hasMany(Session, {
  foreignKey: 'userId',
  as: 'sessions',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

// Session -> User (Many-to-One)
// Session တစ်ခုစီသည် သုံးစွဲသူ တစ်ဦးတည်းနှင့် သက်ဆိုင်သည်
Session.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

logger.info('✅ Model associations defined successfully.');

module.exports = {
  sequelize,
  User,
  Session,
};
