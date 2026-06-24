/**
 * ============================================
 * BDS STORE VPN Backend - Rate Limiter Middleware
 * Rate Limiter Middleware - တောင်းဆိုမှု နှုန်း ကန့်သတ်ခြင်း
 * ============================================
 *
 * Configures rate limiting for different endpoint groups:
 * - General: 100 requests per 15 minutes (default)
 * - Auth: 5 requests per 15 minutes (brute-force protection)
 * - Ads: 10 requests per 15 minutes (ad verification abuse prevention)
 *
 * Endpoint အုပ်စုအလိုက် rate limiting ဖွဲ့စည်းခြင်း
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * General API rate limiter
 * ယေဘုယျ API rate limiter - ပုံမှန် endpoints အားလုံးအတွက်
 *
 * Default: 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMinutes * 60 * 1000,
  max: config.rateLimit.general,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded (general): IP ${req.ip}, Path: ${req.path}`);
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Auth endpoints rate limiter (stricter)
 * Auth endpoints rate limiter (ပိုတင်းကျပ်သော) - brute-force ကာကွယ်ခြင်း
 *
 * Default: 5 requests per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMinutes * 60 * 1000,
  max: config.rateLimit.auth,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded (auth): IP ${req.ip}, Path: ${req.path}`);
    res.status(options.statusCode).json(options.message);
  },
  // Skip successful requests to only count failed attempts
  skipSuccessfulRequests: false,
});

/**
 * Ads verification rate limiter
 * ကြော်ငြာ စစ်ဆေးခြင်း rate limiter - abuse ကာကွယ်ခြင်း
 *
 * Default: 10 requests per 15 minutes per IP
 */
const adsLimiter = rateLimit({
  windowMs: config.rateLimit.windowMinutes * 60 * 1000,
  max: config.rateLimit.ads,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many ad verification requests. Please try again later.',
    code: 'ADS_RATE_LIMIT_EXCEEDED',
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded (ads): IP ${req.ip}, Path: ${req.path}`);
    res.status(options.statusCode).json(options.message);
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  adsLimiter,
};
