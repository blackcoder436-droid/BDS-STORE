/**
 * ============================================
 * BDS STORE VPN Backend - JWT Auth Middleware
 * JWT အထောက်အထား စစ်ဆေးခြင်း Middleware
 * ============================================
 *
 * Extracts Bearer token from Authorization header,
 * verifies it using JWT secret, and attaches the user object to req.user.
 *
 * Authorization header မှ Bearer token ကို ထုတ်ယူပြီး
 * JWT secret ဖြင့် စစ်ဆေးကာ user object ကို req.user သို့ ထည့်သည်
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Authentication middleware - Verifies JWT token and loads user
 * Authentication middleware - JWT token စစ်ဆေးပြီး user ကို load ပြုလုပ်ခြင်း
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
const authenticate = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    // Authorization header မှ token ကို ထုတ်ယူခြင်း
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Auth middleware: No Bearer token provided', {
        ip: req.ip,
        path: req.path,
      });
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authentication token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.',
      });
    }

    // 2. Verify the JWT token
    // JWT token ကို စစ်ဆေးခြင်း
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        logger.warn('Auth middleware: Token expired', { ip: req.ip });
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please login again.',
          code: 'TOKEN_EXPIRED',
        });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        logger.warn('Auth middleware: Invalid token', { ip: req.ip });
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication token.',
          code: 'TOKEN_INVALID',
        });
      }
      throw jwtError;
    }

    // 3. Find the user in the database
    // ဒေတာဘေ့စ်တွင် user ကို ရှာဖွေခြင်း
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      logger.warn('Auth middleware: User not found for valid token', {
        userId: decoded.userId,
      });
      return res.status(401).json({
        success: false,
        message: 'User account not found. Token is invalid.',
        code: 'USER_NOT_FOUND',
      });
    }

    // 4. Check if user account is active
    // User account active ဖြစ်/မဖြစ် စစ်ဆေးခြင်း
    if (!user.isActive) {
      logger.warn('Auth middleware: Inactive user attempted access', {
        userId: user.id,
      });
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // 5. Attach user to request object
    // User ကို request object သို့ ထည့်ခြင်း
    req.user = user;
    req.userId = user.id;

    logger.debug(`Auth middleware: Authenticated user ${user.username} (${user.id})`);
    next();
  } catch (error) {
    logger.error('Auth middleware: Unexpected error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Authentication failed due to server error.',
    });
  }
};

module.exports = { authenticate };
