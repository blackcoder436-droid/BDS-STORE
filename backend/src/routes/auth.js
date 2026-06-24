/**
 * ============================================
 * BDS STORE VPN Backend - Auth Routes
 * Auth လမ်းကြောင်းများ - Register, Login, Profile
 * ============================================
 *
 * Handles user authentication and profile management:
 * POST /register  - Create new user account
 * POST /login     - Authenticate and get JWT token
 * GET  /profile   - Get authenticated user's profile
 * PUT  /profile   - Update authenticated user's username
 *
 * သုံးစွဲသူ authentication နှင့် profile စီမံခန့်ခွဲမှုကို ကိုင်တွယ်သည်
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const router = express.Router();

const { User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const config = require('../config');
const logger = require('../utils/logger');
const { successResponse, formatTime } = require('../utils/helpers');

/**
 * Generate a JWT token for a user
 * သုံးစွဲသူအတွက် JWT token ဖန်တီးခြင်း
 *
 * @param {Object} user - User model instance
 * @returns {string} Signed JWT token
 */
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      username: user.username,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/**
 * POST /register
 * Register a new user account
 * သုံးစွဲသူ အကောင့်အသစ် မှတ်ပုံတင်ခြင်း
 *
 * @body {string} email - Valid email address
 * @body {string} password - Minimum 6 characters
 * @body {string} username - 3-50 chars, alphanumeric + underscores
 * @returns {Object} JWT token and user profile
 */
router.post(
  '/register',
  authLimiter,
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address.')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long.')
      .trim(),
    body('username')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters.')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores.')
      .trim(),
  ],
  async (req, res, next) => {
    try {
      // Validate input | Input ကို စစ်ဆေးခြင်း
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed.',
          errors: errors.array().map((e) => ({
            field: e.path,
            message: e.msg,
          })),
        });
      }

      const { email, password, username } = req.body;

      // Check if email already exists
      // Email ရှိပြီးသားလား စစ်ဆေးခြင်း
      const existingEmail = await User.scope('withPassword').findOne({
        where: { email },
      });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: 'Email address is already registered.',
          code: 'EMAIL_EXISTS',
        });
      }

      // Check if username already exists
      // Username ရှိပြီးသားလား စစ်ဆေးခြင်း
      const existingUsername = await User.findOne({ where: { username } });
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message: 'Username is already taken.',
          code: 'USERNAME_EXISTS',
        });
      }

      // Create the user (password is auto-hashed in User model hook)
      // User ဖန်တီးခြင်း (password ကို User model hook တွင် auto-hash ပြုလုပ်မည်)
      const user = await User.create({
        email,
        password,
        username,
      });

      // Generate JWT token | JWT token ဖန်တီးခြင်း
      const token = generateToken(user);

      logger.info(`New user registered: ${username} (${email})`);

      return res.status(201).json(
        successResponse(
          {
            token,
            tokenType: 'Bearer',
            expiresIn: config.jwt.expiresIn,
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              timeBalance: user.timeBalance,
              formattedBalance: formatTime(user.timeBalance),
              totalAdsWatched: user.totalAdsWatched,
              isActive: user.isActive,
              createdAt: user.createdAt,
            },
          },
          'Registration successful.'
        )
      );
    } catch (error) {
      logger.error('Registration error:', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /login
 * Authenticate user and return JWT token
 * သုံးစွဲသူကို authenticate ပြုလုပ်ပြီး JWT token ပြန်ပေးခြင်း
 *
 * @body {string} email - Registered email address
 * @body {string} password - Account password
 * @returns {Object} JWT token and user profile
 */
router.post(
  '/login',
  authLimiter,
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address.')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required.')
      .trim(),
  ],
  async (req, res, next) => {
    try {
      // Validate input | Input ကို စစ်ဆေးခြင်း
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed.',
          errors: errors.array().map((e) => ({
            field: e.path,
            message: e.msg,
          })),
        });
      }

      const { email, password } = req.body;

      // Find user WITH password (using scope)
      // Password ပါဝင်သော user ကို ရှာဖွေခြင်း (scope အသုံးပြု)
      const user = await User.scope('withPassword').findOne({
        where: { email },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Check if account is active
      // အကောင့် active ဖြစ်/မဖြစ် စစ်ဆေးခြင်း
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.',
          code: 'ACCOUNT_DEACTIVATED',
        });
      }

      // Validate password | Password ကို စစ်ဆေးခြင်း
      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Generate JWT token | JWT token ဖန်တီးခြင်း
      const token = generateToken(user);

      logger.info(`User logged in: ${user.username} (${user.email})`);

      return res.status(200).json(
        successResponse(
          {
            token,
            tokenType: 'Bearer',
            expiresIn: config.jwt.expiresIn,
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              timeBalance: user.timeBalance,
              formattedBalance: formatTime(user.timeBalance),
              totalAdsWatched: user.totalAdsWatched,
              isActive: user.isActive,
              lastRewardAt: user.lastRewardAt,
              createdAt: user.createdAt,
            },
          },
          'Login successful.'
        )
      );
    } catch (error) {
      logger.error('Login error:', { error: error.message });
      next(error);
    }
  }
);

/**
 * GET /profile
 * Get authenticated user's profile
 * Authenticate ပြုလုပ်ထားသော သုံးစွဲသူ၏ profile ကို ရယူခြင်း
 *
 * @header {string} Authorization - Bearer <JWT token>
 * @returns {Object} Full user profile with time balance
 */
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const user = req.user;

    logger.debug(`Profile viewed: ${user.username} (${user.id})`);

    return res.status(200).json(
      successResponse(
        {
          id: user.id,
          email: user.email,
          username: user.username,
          timeBalance: user.timeBalance,
          formattedBalance: formatTime(user.timeBalance),
          totalAdsWatched: user.totalAdsWatched,
          lastRewardAt: user.lastRewardAt,
          isActive: user.isActive,
          vpnClientId: user.vpnClientId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        'Profile retrieved successfully.'
      )
    );
  } catch (error) {
    logger.error('Profile retrieval error:', { error: error.message });
    next(error);
  }
});

/**
 * PUT /profile
 * Update authenticated user's username
 * Authenticate ပြုလုပ်ထားသော သုံးစွဲသူ၏ username ကို ပြင်ဆင်ခြင်း
 *
 * @header {string} Authorization - Bearer <JWT token>
 * @body {string} username - New username (3-50 chars, alphanumeric + underscores)
 * @returns {Object} Updated user profile
 */
router.put(
  '/profile',
  authenticate,
  [
    body('username')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters.')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores.')
      .trim(),
  ],
  async (req, res, next) => {
    try {
      // Validate input | Input ကို စစ်ဆေးခြင်း
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed.',
          errors: errors.array().map((e) => ({
            field: e.path,
            message: e.msg,
          })),
        });
      }

      const { username } = req.body;
      const user = req.user;

      // Check if new username is already taken by another user
      // Username ကို အခြား user ယူထားပြီးလား စစ်ဆေးခြင်း
      if (username !== user.username) {
        const existingUsername = await User.findOne({
          where: { username },
        });
        if (existingUsername) {
          return res.status(409).json({
            success: false,
            message: 'Username is already taken.',
            code: 'USERNAME_EXISTS',
          });
        }
      }

      // Update username
      user.username = username;
      await user.save();

      logger.info(`Profile updated: ${user.username} (${user.id})`);

      return res.status(200).json(
        successResponse(
          {
            id: user.id,
            email: user.email,
            username: user.username,
            timeBalance: user.timeBalance,
            formattedBalance: formatTime(user.timeBalance),
            updatedAt: user.updatedAt,
          },
          'Profile updated successfully.'
        )
      );
    } catch (error) {
      logger.error('Profile update error:', { error: error.message });
      next(error);
    }
  }
);

module.exports = router;
