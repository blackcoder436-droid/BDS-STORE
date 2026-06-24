/**
 * ============================================
 * BDS STORE VPN Backend - Global Error Handler
 * Global Error Handler - ယေဘုယျ error ကိုင်တွယ်မှု middleware
 * ============================================
 *
 * Catches all unhandled errors in Express route handlers.
 * Returns different error detail levels based on NODE_ENV:
 * - Development: includes full error stack trace
 * - Production: generic error message only
 *
 * Express route handlers တွင် ကိုင်တွယ်မထားသော errors အားလုံးကို ဖမ်းယူသည်
 */

const config = require('../config');
const logger = require('../utils/logger');

/**
 * Custom application error class with HTTP status code
 * HTTP status code ပါဝင်သော စိတ်ကြိုက် application error class
 *
 * @class AppError
 * @extends Error
 */
class AppError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {string} [code] - Application-specific error code
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Distinguish operational vs programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 Not Found handler middleware
 * 404 Not Found handler - route မတွေ့သော requests အတွက်
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route not found: ${req.method} ${req.originalUrl}`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

/**
 * Global error handler middleware (must have 4 parameters for Express to recognize it)
 * Global error handler middleware (Express မှ မှတ်မိစေရန် parameter 4 ခု ရှိရမည်)
 *
 * @param {Error|AppError} err - The error object
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
const globalErrorHandler = (err, req, res, next) => {
  // Default values
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  // Log the error
  // Error ကို log ပြုလုပ်ခြင်း
  if (statusCode >= 500) {
    logger.error('Server Error:', {
      message: err.message,
      code,
      statusCode,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userId: req.userId || 'anonymous',
    });
  } else {
    logger.warn('Client Error:', {
      message: err.message,
      code,
      statusCode,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    });
  }

  // Build the response
  // Response ကို တည်ဆောက်ခြင်း
  const response = {
    success: false,
    message: err.message || 'An unexpected error occurred.',
    code,
  };

  // In development, include stack trace and additional details
  // Development တွင် stack trace နှင့် အသေးစိတ် အချက်အလက်များ ပါဝင်မည်
  if (config.isDev) {
    response.stack = err.stack;
    response.details = {
      method: req.method,
      url: req.originalUrl,
    };
  }

  // Handle specific Sequelize errors
  // Sequelize errors များကို သီးခြား ကိုင်တွယ်ခြင်း
  if (err.name === 'SequelizeValidationError') {
    response.message = 'Validation error.';
    response.code = 'VALIDATION_ERROR';
    response.errors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json(response);
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    response.message = 'A record with this value already exists.';
    response.code = 'DUPLICATE_ENTRY';
    response.errors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(409).json(response);
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    response.message = 'Referenced record does not exist.';
    response.code = 'FOREIGN_KEY_ERROR';
    return res.status(400).json(response);
  }

  // Send the response
  res.status(statusCode).json(response);
};

module.exports = {
  AppError,
  notFoundHandler,
  globalErrorHandler,
};
