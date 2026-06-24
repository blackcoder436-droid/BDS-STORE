/**
 * ============================================
 * BDS STORE VPN Backend - VPN Routes
 * VPN လမ်းကြောင်းများ - Config, Connect, Disconnect, Status
 * ============================================
 *
 * Handles VPN connection lifecycle:
 * GET  /config     - Get VPN configuration (VLESS/VMess link)
 * POST /connect    - Log VPN connection start
 * POST /disconnect - Log VPN connection end, deduct used time
 * GET  /status     - Get current connection status & remaining time
 *
 * VPN ချိတ်ဆက်မှု lifecycle ကို ကိုင်တွယ်သည်
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const { User, Session } = require('../models');
const { authenticate } = require('../middleware/auth');
const xrayService = require('../services/xrayService');
const timeService = require('../services/timeService');
const logger = require('../utils/logger');
const { successResponse, formatTime } = require('../utils/helpers');

/**
 * GET /config
 * Get VPN configuration for the authenticated user
 * Authenticate ပြုလုပ်ထားသော သုံးစွဲသူအတွက် VPN configuration ရယူခြင်း
 *
 * Checks if user has time remaining, then returns VLESS/VMess
 * subscription link or JSON config from the 3x-ui panel.
 *
 * @header {string} Authorization - Bearer <JWT token>
 * @returns {Object} VPN config link and server details
 */
router.get('/config', authenticate, async (req, res, next) => {
  try {
    const user = req.user;

    // Check if user has time remaining
    // သုံးစွဲသူတွင် အချိန် ကျန်ရှိမရှိ စစ်ဆေးခြင်း
    if (!user.hasTimeRemaining()) {
      logger.info(`VPN config denied: ${user.username} - no time remaining`);
      return res.status(403).json({
        success: false,
        message: 'No VPN time remaining. Please watch an ad to earn more time.',
        code: 'NO_TIME_REMAINING',
        data: {
          timeBalance: 0,
          formattedBalance: '0s',
        },
      });
    }

    // Get or create VPN config from 3x-ui panel
    // 3x-ui panel မှ VPN config ကို ရယူ သို့မဟုတ် ဖန်တီးခြင်း
    const vpnConfig = await xrayService.getAvailableConfig(user);

    if (!vpnConfig) {
      logger.error(`VPN config failed: could not get config for ${user.username}`);
      return res.status(503).json({
        success: false,
        message: 'Unable to generate VPN configuration. Please try again later.',
        code: 'CONFIG_UNAVAILABLE',
      });
    }

    logger.info(`VPN config retrieved: ${user.username}`, {
      protocol: vpnConfig.protocol,
      hasConfigLink: !!vpnConfig.configLink,
    });

    return res.status(200).json(
      successResponse(
        {
          config: vpnConfig,
          timeBalance: user.timeBalance,
          formattedBalance: formatTime(user.timeBalance),
        },
        'VPN configuration retrieved successfully.'
      )
    );
  } catch (error) {
    logger.error('VPN config error:', {
      userId: req.user?.id,
      error: error.message,
    });
    next(error);
  }
});

/**
 * POST /connect
 * Log VPN connection start and create a new session
 * VPN ချိတ်ဆက်မှု စတင်ခြင်းကို မှတ်တမ်းတင်ပြီး session အသစ် ဖန်တီးခြင်း
 *
 * @header {string} Authorization - Bearer <JWT token>
 * @body {string} [serverNode] - Server node identifier (default: 'default')
 * @body {string} [protocol] - VPN protocol (VLESS, VMess, Trojan, Shadowsocks)
 * @returns {Object} New session info
 */
router.post(
  '/connect',
  authenticate,
  [
    body('serverNode')
      .optional()
      .isString()
      .withMessage('serverNode must be a string.')
      .trim(),
    body('protocol')
      .optional()
      .isIn(['VLESS', 'VMess', 'Trojan', 'Shadowsocks'])
      .withMessage('Protocol must be one of: VLESS, VMess, Trojan, Shadowsocks'),
  ],
  async (req, res, next) => {
    try {
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

      const user = req.user;
      const { serverNode, protocol } = req.body;

      // Check if user has time remaining
      // သုံးစွဲသူတွင် အချိန် ကျန်ရှိမရှိ စစ်ဆေးခြင်း
      if (!user.hasTimeRemaining()) {
        return res.status(403).json({
          success: false,
          message: 'No VPN time remaining. Please watch an ad to earn more time.',
          code: 'NO_TIME_REMAINING',
        });
      }

      // Check for existing active session and close it
      // ရှိပြီးသား active session ကို စစ်ဆေးပြီး ပိတ်ခြင်း
      const existingSession = await Session.findOne({
        where: {
          userId: user.id,
          status: 'active',
        },
      });

      if (existingSession) {
        // Close the previous session before starting a new one
        // Session အသစ် မစမီ ယခင် session ကို ပိတ်ခြင်း
        existingSession.endTime = new Date();
        existingSession.status = 'completed';
        await existingSession.save();

        // Deduct time for the previous session
        // ယခင် session အတွက် အချိန် နုတ်ခြင်း
        await timeService.deductConnectionTime(existingSession.id);
        await user.reload();

        logger.info(`Previous session closed: ${existingSession.id}`, {
          userId: user.id,
        });

        // Re-check time after deduction
        if (!user.hasTimeRemaining()) {
          return res.status(403).json({
            success: false,
            message: 'No VPN time remaining after closing previous session.',
            code: 'NO_TIME_REMAINING',
          });
        }
      }

      // Create new VPN session
      // VPN session အသစ် ဖန်တီးခြင်း
      const session = await Session.create({
        userId: user.id,
        serverNode: serverNode || 'default',
        protocol: protocol || 'VLESS',
        startTime: new Date(),
        status: 'active',
      });

      logger.info(`VPN connected: ${user.username}`, {
        sessionId: session.id,
        serverNode: session.serverNode,
        protocol: session.protocol,
        timeBalance: user.timeBalance,
      });

      return res.status(201).json(
        successResponse(
          {
            sessionId: session.id,
            serverNode: session.serverNode,
            protocol: session.protocol,
            startTime: session.startTime,
            timeBalance: user.timeBalance,
            formattedBalance: formatTime(user.timeBalance),
          },
          'VPN connection started.'
        )
      );
    } catch (error) {
      logger.error('VPN connect error:', {
        userId: req.user?.id,
        error: error.message,
      });
      next(error);
    }
  }
);

/**
 * POST /disconnect
 * Log VPN connection end and deduct used time
 * VPN ချိတ်ဆက်မှု ပြီးဆုံးခြင်းကို မှတ်တမ်းတင်ပြီး အသုံးပြုခဲ့သော အချိန်ကို နုတ်ခြင်း
 *
 * @header {string} Authorization - Bearer <JWT token>
 * @body {string} sessionId - The session UUID to end
 * @body {number} [bytesUploaded] - Total bytes uploaded during session
 * @body {number} [bytesDownloaded] - Total bytes downloaded during session
 * @returns {Object} Session summary with time deduction
 */
router.post(
  '/disconnect',
  authenticate,
  [
    body('sessionId')
      .notEmpty()
      .withMessage('sessionId is required.')
      .isUUID()
      .withMessage('sessionId must be a valid UUID.'),
    body('bytesUploaded')
      .optional()
      .isInt({ min: 0 })
      .withMessage('bytesUploaded must be a non-negative integer.'),
    body('bytesDownloaded')
      .optional()
      .isInt({ min: 0 })
      .withMessage('bytesDownloaded must be a non-negative integer.'),
  ],
  async (req, res, next) => {
    try {
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

      const user = req.user;
      const { sessionId, bytesUploaded, bytesDownloaded } = req.body;

      // Find the session | Session ကို ရှာဖွေခြင်း
      const session = await Session.findOne({
        where: {
          id: sessionId,
          userId: user.id,
        },
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found.',
          code: 'SESSION_NOT_FOUND',
        });
      }

      if (session.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: `Session is already ${session.status}.`,
          code: 'SESSION_NOT_ACTIVE',
        });
      }

      // Update session | Session ကို update ပြုလုပ်ခြင်း
      session.endTime = new Date();
      session.status = 'completed';
      if (bytesUploaded !== undefined) session.bytesUploaded = bytesUploaded;
      if (bytesDownloaded !== undefined) session.bytesDownloaded = bytesDownloaded;
      await session.save();

      // Deduct used time from user's balance
      // သုံးစွဲသူ၏ လက်ကျန်မှ အသုံးပြုခဲ့သော အချိန်ကို နုတ်ခြင်း
      const deductionResult = await timeService.deductConnectionTime(sessionId);

      logger.info(`VPN disconnected: ${user.username}`, {
        sessionId,
        duration: deductionResult.formattedDuration,
        newBalance: deductionResult.formattedBalance,
      });

      return res.status(200).json(
        successResponse(
          {
            sessionId: session.id,
            startTime: session.startTime,
            endTime: session.endTime,
            durationSeconds: deductionResult.durationSeconds,
            formattedDuration: deductionResult.formattedDuration,
            bytesUploaded: session.bytesUploaded,
            bytesDownloaded: session.bytesDownloaded,
            timeDeducted: deductionResult.durationSeconds,
            previousBalance: deductionResult.previousBalance,
            newBalance: deductionResult.newBalance,
            formattedBalance: deductionResult.formattedBalance,
          },
          'VPN disconnected successfully.'
        )
      );
    } catch (error) {
      logger.error('VPN disconnect error:', {
        userId: req.user?.id,
        error: error.message,
      });
      next(error);
    }
  }
);

/**
 * GET /status
 * Get current VPN connection status and remaining time
 * လက်ရှိ VPN ချိတ်ဆက်မှု status နှင့် ကျန်ရှိသော အချိန်ကို ရယူခြင်း
 *
 * @header {string} Authorization - Bearer <JWT token>
 * @returns {Object} Connection status, remaining time, active session info
 */
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const user = req.user;

    // Get remaining time info (includes active session check)
    // ကျန်ရှိသော အချိန် info ရယူခြင်း (active session စစ်ဆေးမှု ပါဝင်)
    const timeInfo = await timeService.getRemainingTime(user.id);

    // Get active session details if connected
    // ချိတ်ဆက်ထားလျှင် active session details ကို ရယူခြင်း
    let activeSession = null;
    if (timeInfo.activeSessionId) {
      const session = await Session.findByPk(timeInfo.activeSessionId);
      if (session) {
        activeSession = {
          sessionId: session.id,
          serverNode: session.serverNode,
          protocol: session.protocol,
          startTime: session.startTime,
          durationSeconds: session.getDurationSeconds(),
          formattedDuration: formatTime(session.getDurationSeconds()),
          bytesUploaded: session.bytesUploaded,
          bytesDownloaded: session.bytesDownloaded,
        };
      }
    }

    logger.debug(`VPN status check: ${user.username}`, {
      isConnected: timeInfo.isConnected,
      remainingTime: timeInfo.formattedEffective,
    });

    return res.status(200).json(
      successResponse(
        {
          isConnected: timeInfo.isConnected,
          hasTimeRemaining: timeInfo.hasTimeRemaining,
          timeBalance: timeInfo.timeBalanceSeconds,
          effectiveBalance: timeInfo.effectiveBalanceSeconds,
          formattedBalance: timeInfo.formattedBalance,
          formattedEffective: timeInfo.formattedEffective,
          totalAdsWatched: timeInfo.totalAdsWatched,
          lastRewardAt: timeInfo.lastRewardAt,
          activeSession,
        },
        'VPN status retrieved successfully.'
      )
    );
  } catch (error) {
    logger.error('VPN status error:', {
      userId: req.user?.id,
      error: error.message,
    });
    next(error);
  }
});

module.exports = router;
