/**
 * ============================================
 * BDS STORE VPN Backend - Winston Logger
 * လော့ဂ်ဂါ - Winston logging utility
 * ============================================
 *
 * Configured with console + daily rotating file transports.
 * Development: colorized console output at 'debug' level
 * Production: JSON format, 'info' level, with file rotation
 *
 * ဖွံ့ဖြိုးရေးတွင် ရောင်စုံ console output၊ ထုတ်လုပ်ရေးတွင် JSON ဖော်မတ်
 */

const winston = require('winston');
const path = require('path');
const config = require('../config');

// Log directory path | လော့ဂ် ဖိုင်တွဲ လမ်းကြောင်း
const LOG_DIR = path.resolve(__dirname, '../../logs');

/**
 * Custom log format for console output
 * Console output အတွက် စိတ်ကြိုက် log format
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `[${timestamp}] ${level}: ${message} ${metaStr}`;
  })
);

/**
 * JSON format for file output (structured logging)
 * ဖိုင် output အတွက် JSON format (structured logging)
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Transport configurations
 * Console transport is always active; file transports for error + combined logs
 */
const transports = [
  // Console transport - always active
  new winston.transports.Console({
    format: consoleFormat,
    level: config.isDev ? 'debug' : 'info',
  }),
];

// File transports (only add if winston-daily-rotate-file is available)
// ဖိုင် transports (winston-daily-rotate-file ရှိမှသာ ထည့်မည်)
try {
  require('winston-daily-rotate-file');

  // Daily rotating combined log file
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(LOG_DIR, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat,
      level: config.isDev ? 'debug' : 'info',
    })
  );

  // Daily rotating error log file
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
      level: 'error',
    })
  );
} catch (err) {
  // Fallback to basic file transports if daily-rotate not available
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

/**
 * Winston Logger instance
 * Winston Logger instance - application-wide logger
 * @type {winston.Logger}
 */
const logger = winston.createLogger({
  level: config.logLevel || 'info',
  defaultMeta: { service: 'bds-store-vpn' },
  transports,
  // Do not exit on uncaught exceptions
  exitOnError: false,
});

module.exports = logger;
