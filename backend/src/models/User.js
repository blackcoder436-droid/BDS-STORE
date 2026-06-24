/**
 * ============================================
 * BDS STORE VPN Backend - User Model
 * သုံးစွဲသူ Model - User table definition
 * ============================================
 *
 * Represents a registered user of the BDS STORE VPN app.
 * Stores authentication credentials, VPN time balance,
 * ad-watch statistics, and 3x-ui client mapping.
 *
 * BDS STORE VPN အက်ပ်၏ မှတ်ပုံတင်ထားသော သုံးစွဲသူကို ကိုယ်စားပြုသည်
 */

const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

/**
 * User Model
 * @class User
 * @extends Model
 *
 * @property {string} id - UUID primary key
 * @property {string} email - Unique email address (validated)
 * @property {string} password - Bcrypt-hashed password
 * @property {string} username - Unique display name
 * @property {number} timeBalance - VPN time remaining in seconds | VPN ကျန်အချိန် (စက္ကန့်)
 * @property {number} totalAdsWatched - Total ads watched count | ကြည့်ပြီးသော ကြော်ငြာ အရေအတွက်
 * @property {Date|null} lastRewardAt - Timestamp of last ad reward | နောက်ဆုံး ဆုလာဘ် အချိန်
 * @property {boolean} isActive - Whether the account is active | အကောင့် active ဖြစ်/မဖြစ်
 * @property {string|null} vpnClientId - 3x-ui panel client UUID mapping
 * @property {Date} createdAt - Record creation timestamp
 * @property {Date} updatedAt - Record update timestamp
 */
class User extends Model {
  /**
   * Validate a password against the stored hash
   * သိမ်းထားသော hash နှင့် password ကို စစ်ဆေးခြင်း
   *
   * @param {string} password - Plain text password to check
   * @returns {Promise<boolean>} True if password matches
   */
  async validatePassword(password) {
    return bcrypt.compare(password, this.password);
  }

  /**
   * Check if user has VPN time remaining
   * သုံးစွဲသူတွင် VPN အချိန် ကျန်ရှိမရှိ စစ်ဆေးခြင်း
   *
   * @returns {boolean} True if timeBalance > 0
   */
  hasTimeRemaining() {
    return this.timeBalance > 0;
  }

  /**
   * Add VPN time to user's balance
   * သုံးစွဲသူ၏ လက်ကျန်သို့ VPN အချိန် ထည့်ခြင်း
   *
   * @param {number} seconds - Number of seconds to add
   * @returns {Promise<User>} Updated user instance
   */
  async addTime(seconds) {
    this.timeBalance += Math.abs(Math.floor(seconds));
    return this.save();
  }

  /**
   * Deduct VPN time from user's balance (will not go below 0)
   * သုံးစွဲသူ၏ လက်ကျန်မှ VPN အချိန် နုတ်ခြင်း (0 အောက် မကျစေ)
   *
   * @param {number} seconds - Number of seconds to deduct
   * @returns {Promise<User>} Updated user instance
   */
  async deductTime(seconds) {
    const deduction = Math.abs(Math.floor(seconds));
    this.timeBalance = Math.max(0, this.timeBalance - deduction);
    return this.save();
  }

  /**
   * Return user data without sensitive fields (for API responses)
   * API responses အတွက် sensitive fields မပါဘဲ user data ပြန်ပေးခြင်း
   *
   * @returns {Object} Safe user object (no password hash)
   */
  toSafeJSON() {
    const values = this.toJSON();
    delete values.password;
    return values;
  }
}

// Initialize User model schema
// User model schema ကို စတင်ခြင်း
User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique user identifier | သုံးစွဲသူ ID',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: {
        name: 'users_email_unique',
        msg: 'Email address is already registered.',
      },
      validate: {
        isEmail: { msg: 'Please provide a valid email address.' },
        notEmpty: { msg: 'Email is required.' },
      },
      comment: 'User email address (unique) | သုံးစွဲသူ အီးမေးလ်',
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Password is required.' },
        len: {
          args: [6, 255],
          msg: 'Password must be at least 6 characters long.',
        },
      },
      comment: 'Bcrypt-hashed password | Bcrypt hash ထားသော password',
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: {
        name: 'users_username_unique',
        msg: 'Username is already taken.',
      },
      validate: {
        notEmpty: { msg: 'Username is required.' },
        len: {
          args: [3, 50],
          msg: 'Username must be between 3 and 50 characters.',
        },
        is: {
          args: /^[a-zA-Z0-9_]+$/,
          msg: 'Username can only contain letters, numbers, and underscores.',
        },
      },
      comment: 'Unique display name | ပြသမည့် အမည်',
    },
    timeBalance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'Time balance cannot be negative.' },
      },
      comment: 'VPN time remaining in seconds | VPN ကျန်အချိန် (စက္ကန့်)',
    },
    totalAdsWatched: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Total number of ads watched | ကြည့်ပြီးသော ကြော်ငြာ စုစုပေါင်း',
    },
    lastRewardAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      comment: 'Timestamp of last ad reward | နောက်ဆုံး ဆုလာဘ်ရရှိချိန်',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether user account is active | အကောင့် active ဖြစ်/မဖြစ်',
    },
    vpnClientId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      comment: '3x-ui panel client UUID | 3x-ui panel client UUID',
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,

    // Hooks: automatically hash password before creating/updating
    // Hooks: ဖန်တီးခြင်း/ပြင်ဆင်ခြင်း မတိုင်မီ password ကို အလိုအလျောက် hash ပြုလုပ်ခြင်း
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },

    // Default scope: exclude password from queries
    // Default scope: queries မှ password ကို ဖယ်ထုတ်ခြင်း
    defaultScope: {
      attributes: { exclude: ['password'] },
    },
    scopes: {
      // Scope to include password (for authentication)
      // Password ပါဝင်သော scope (authentication အတွက်)
      withPassword: {
        attributes: {},
      },
    },
  }
);

module.exports = User;
