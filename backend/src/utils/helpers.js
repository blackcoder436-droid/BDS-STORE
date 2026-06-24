/**
 * ============================================
 * BDS STORE VPN Backend - Utility Helpers
 * အထောက်အကူ လုပ်ဆောင်ချက်များ
 * ============================================
 *
 * General-purpose utility functions used across the application.
 * အက်ပ်တစ်ခုလုံးတွင် အသုံးပြုသော ယေဘုယျ utility functions များ
 */

const crypto = require('crypto');

/**
 * Format seconds into human-readable time string
 * စက္ကန့်ကို လူဖတ်နိုင်သော အချိန် string သို့ ပြောင်းလဲခြင်း
 *
 * @param {number} totalSeconds - Total seconds to format
 * @returns {string} Formatted time string (e.g., "2h 30m 15s")
 *
 * @example
 * formatTime(9015) // "2h 30m 15s"
 * formatTime(60)   // "1m 0s"
 * formatTime(0)    // "0s"
 */
function formatTime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0s';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * Generate a UUID v4
 * UUID v4 ဖန်တီးခြင်း
 *
 * @returns {string} A new UUID v4 string
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Safely parse an integer from a string value
 * String တန်ဖိုးမှ integer ကို ဘေးကင်းစွာ ပြောင်းလဲခြင်း
 *
 * @param {string|number} value - Value to parse
 * @param {number} defaultValue - Default if parsing fails
 * @returns {number}
 */
function safeParseInt(value, defaultValue = 0) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Convert hours to seconds
 * နာရီကို စက္ကန့်သို့ ပြောင်းလဲခြင်း
 *
 * @param {number} hours - Number of hours
 * @returns {number} Equivalent seconds
 */
function hoursToSeconds(hours) {
  return Math.floor(hours * 3600);
}

/**
 * Mask sensitive data for logging (e.g., email, tokens)
 * Logging အတွက် အရေးကြီးသော data ကို ဖုံးကွယ်ခြင်း
 *
 * @param {string} str - String to mask
 * @param {number} visibleStart - Characters to show at start (default: 3)
 * @param {number} visibleEnd - Characters to show at end (default: 3)
 * @returns {string} Masked string
 *
 * @example
 * maskString("user@example.com") // "use***com"
 */
function maskString(str, visibleStart = 3, visibleEnd = 3) {
  if (!str || str.length <= visibleStart + visibleEnd) return '***';
  return str.slice(0, visibleStart) + '***' + str.slice(-visibleEnd);
}

/**
 * Create a standard API success response object
 * စံ API အောင်မြင်မှု response object ဖန်တီးခြင်း
 *
 * @param {*} data - Response data payload
 * @param {string} message - Success message
 * @returns {Object} Standardized response object
 */
function successResponse(data, message = 'Success') {
  return {
    success: true,
    message,
    data,
  };
}

/**
 * Create a standard API error response object
 * စံ API error response object ဖန်တီးခြင်း
 *
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {*} [errors] - Additional error details
 * @returns {Object} Standardized error response object
 */
function errorResponse(message, statusCode = 500, errors = null) {
  const response = {
    success: false,
    message,
    statusCode,
  };
  if (errors) response.errors = errors;
  return response;
}

/**
 * Sleep for a specified duration (async/Promise-based)
 * သတ်မှတ်ထားသော ကြာချိန်အတွက် ခေတ္တရပ်နားခြင်း
 *
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate email format
 * အီးမေးလ် format ကို စစ်ဆေးခြင်း
 *
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = {
  formatTime,
  generateUUID,
  safeParseInt,
  hoursToSeconds,
  maskString,
  successResponse,
  errorResponse,
  sleep,
  isValidEmail,
};
