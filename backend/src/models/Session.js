/**
 * ============================================
 * BDS STORE VPN Backend - Session Model
 * VPN Session Model - VPN ချိတ်ဆက်မှု session table definition
 * ============================================
 *
 * Tracks each VPN connection session for a user.
 * Records connection time, data usage, protocol used, and session status.
 *
 * သုံးစွဲသူတစ်ဦးစီ၏ VPN ချိတ်ဆက်မှု session ကို ခြေရာခံသည်
 */

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Session Model
 * @class Session
 * @extends Model
 *
 * @property {string} id - UUID primary key
 * @property {string} userId - Foreign key to User | User သို့ foreign key
 * @property {string} serverNode - VPN server node identifier | VPN server node အမည်
 * @property {string} protocol - VPN protocol used (VLESS, VMess, Trojan, Shadowsocks)
 * @property {Date} startTime - Connection start timestamp | ချိတ်ဆက်မှု စတင်ချိန်
 * @property {Date|null} endTime - Connection end timestamp | ချိတ်ဆက်မှု ပြီးဆုံးချိန်
 * @property {number} bytesUploaded - Total bytes uploaded | Upload ပြုလုပ်ခဲ့သော bytes
 * @property {number} bytesDownloaded - Total bytes downloaded | Download ပြုလုပ်ခဲ့သော bytes
 * @property {string} status - Session status: active, completed, expired
 */
class Session extends Model {
  /**
   * Calculate session duration in seconds
   * Session ကြာချိန်ကို စက္ကန့်ဖြင့် တွက်ချက်ခြင်း
   *
   * @returns {number} Duration in seconds (0 if still active)
   */
  getDurationSeconds() {
    if (!this.endTime) {
      // Session is still active - calculate from now
      // Session သည် active ဖြစ်နေသည် - ယခုအချိန်မှ တွက်ချက်မည်
      return Math.floor((Date.now() - new Date(this.startTime).getTime()) / 1000);
    }
    return Math.floor(
      (new Date(this.endTime).getTime() - new Date(this.startTime).getTime()) / 1000
    );
  }

  /**
   * Get total data usage in bytes
   * စုစုပေါင်း data အသုံးပြုမှုကို bytes ဖြင့် ပြန်ပေးခြင်း
   *
   * @returns {number} Total bytes (uploaded + downloaded)
   */
  getTotalBytes() {
    return (Number(this.bytesUploaded) || 0) + (Number(this.bytesDownloaded) || 0);
  }
}

// Initialize Session model schema
// Session model schema ကို စတင်ခြင်း
Session.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: 'Unique session identifier | Session ID',
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'Foreign key to User | သုံးစွဲသူ ID (foreign key)',
    },
    serverNode: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: 'default',
      comment: 'VPN server node identifier | VPN server node အမည်',
    },
    protocol: {
      type: DataTypes.ENUM('VLESS', 'VMess', 'Trojan', 'Shadowsocks'),
      allowNull: false,
      defaultValue: 'VLESS',
      comment: 'VPN protocol used | အသုံးပြုသော VPN protocol',
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Connection start time | ချိတ်ဆက်မှု စတင်ချိန်',
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      comment: 'Connection end time (null if still active) | ချိတ်ဆက်မှု ပြီးဆုံးချိန်',
    },
    bytesUploaded: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      comment: 'Total bytes uploaded | Upload ပြုလုပ်ခဲ့သော bytes',
    },
    bytesDownloaded: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      comment: 'Total bytes downloaded | Download ပြုလုပ်ခဲ့သော bytes',
    },
    status: {
      type: DataTypes.ENUM('active', 'completed', 'expired'),
      allowNull: false,
      defaultValue: 'active',
      comment: 'Session status | Session အခြေအနေ',
    },
  },
  {
    sequelize,
    modelName: 'Session',
    tableName: 'sessions',
    timestamps: true,
    indexes: [
      // Index for finding active sessions by user
      // သုံးစွဲသူအလိုက် active sessions ရှာဖွေရန် index
      {
        name: 'idx_sessions_user_status',
        fields: ['userId', 'status'],
      },
      // Index for querying sessions by start time
      {
        name: 'idx_sessions_start_time',
        fields: ['startTime'],
      },
    ],
  }
);

module.exports = Session;
