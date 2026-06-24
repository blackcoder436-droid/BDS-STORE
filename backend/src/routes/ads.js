/**
 * ============================================
 * BDS STORE VPN Backend - Ads Routes
 * ကြော်ငြာ လမ်းကြောင်းများ - AdMob SSV Verification & Rewards
 * ============================================
 *
 * Handles AdMob reward ad verification:
 * GET  /verify        - AdMob SSV callback (server-to-server from Google)
 * POST /reward-status - Check if user recently earned a reward
 *
 * AdMob reward ကြော်ငြာ စစ်ဆေးခြင်းကို ကိုင်တွယ်သည်
 */

const express = require('express');
const { query, validationResult } = require('express-validator');
const router = express.Router();

const { User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { adsLimiter } = require('../middleware/rateLimiter');
const { verifySSVCallback } = require('../services/admobService');
const { addRewardTime } = require('../services/timeService');
const config = require('../config');
const logger = require('../utils/logger');
const { successResponse, formatTime } = require('../utils/helpers');

/**
 * GET /verify
 * AdMob SSV (Server-Side Verification) callback endpoint
 * AdMob SSV callback endpoint - Google ၏ server-to-server ခေါ်ဆိုမှု
 *
 * This endpoint is called DIRECTLY by Google's AdMob servers (not by the client app).
 * It verifies the cryptographic signature to confirm a user legitimately watched an ad,
 * then credits the user's time balance.
 *
 * ဤ endpoint ကို Google ၏ AdMob servers မှ တိုက်ရိုက် ခေါ်ဆိုသည် (client app မှ မဟုတ်)
 * ကြော်ငြာကို တကယ်ကြည့်ကြောင်း cryptographic signature ဖြင့် စစ်ဆေးပြီး
 * သုံးစွဲသူ၏ အချိန် လက်ကျန်ကို ဖြည့်ပေးသည်
 *
 * @query {string} ad_network - Ad network identifier
 * @query {string} ad_unit - Ad unit ID
 * @query {string} reward_amount - Reward amount
 * @query {string} reward_item - Reward item type
 * @query {string} user_id - Custom user ID (our app's user UUID)
 * @query {string} signature - Base64url-encoded ECDSA signature
 * @query {string} key_id - Google public key ID used for signing
 * @query {string} timestamp - Callback timestamp
 * @returns {number} 200 OK if valid, 400/403 if invalid
 */
router.get(
  '/verify',
  adsLimiter,
  [
    query('user_id')
      .notEmpty()
      .withMessage('user_id is required.'),
    query('signature')
      .notEmpty()
      .withMessage('signature is required.'),
    query('key_id')
      .notEmpty()
      .withMessage('key_id is required.'),
  ],
  async (req, res, next) => {
    try {
      // Validate required params | လိုအပ်သော params ကို စစ်ဆေးခြင်း
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('AdMob SSV: Missing required params', {
          errors: errors.array(),
          ip: req.ip,
        });
        return res.status(400).json({
          success: false,
          message: 'Missing required verification parameters.',
        });
      }

      const queryParams = req.query;
      const userId = queryParams.user_id;

      logger.info('AdMob SSV: Verification callback received', {
        userId,
        adNetwork: queryParams.ad_network,
        adUnit: queryParams.ad_unit,
        rewardAmount: queryParams.reward_amount,
        ip: req.ip,
      });

      // 1. Verify the cryptographic signature
      // Cryptographic signature ကို စစ်ဆေးခြင်း
      const isValid = await verifySSVCallback(queryParams);

      if (!isValid) {
        logger.warn('AdMob SSV: Invalid signature - rejecting callback', {
          userId,
          ip: req.ip,
        });
        return res.status(403).json({
          success: false,
          message: 'Invalid signature. Verification failed.',
        });
      }

      // 2. Find the user | သုံးစွဲသူကို ရှာဖွေခြင်း
      const user = await User.findByPk(userId);
      if (!user) {
        logger.warn('AdMob SSV: User not found', { userId });
        // Still return 200 to AdMob to prevent retries
        // Retry မပြုလုပ်စေရန် AdMob သို့ 200 ပြန်ပေးခြင်း
        return res.status(200).send('OK');
      }

      // 3. Credit reward time to user
      // သုံးစွဲသူသို့ ဆုလာဘ် အချိန် ဖြည့်ပေးခြင်း
      const rewardResult = await addRewardTime(userId);

      logger.info('AdMob SSV: Reward credited successfully', {
        userId,
        hoursAdded: rewardResult.hoursAdded,
        newBalance: rewardResult.formattedBalance,
        totalAdsWatched: rewardResult.totalAdsWatched,
      });

      // Return 200 OK to AdMob (Google expects this to confirm receipt)
      // AdMob သို့ 200 OK ပြန်ပေးခြင်း (Google မှ လက်ခံကြောင်း အတည်ပြုရန်)
      return res.status(200).send('OK');
    } catch (error) {
      logger.error('AdMob SSV: Verification error', {
        error: error.message,
        query: req.query,
      });
      // Still return 200 to prevent Google from retrying
      return res.status(200).send('OK');
    }
  }
);

/**
 * POST /reward-status
 * Check if the authenticated user recently earned a reward
 * Authenticate ပြုလုပ်ထားသော သုံးစွဲသူ ဆုလာဘ် မကြာသေးမီ ရရှိခဲ့လား စစ်ဆေးခြင်း
 *
 * Used by the Flutter client to check reward status after showing an ad.
 * Flutter client မှ ကြော်ငြာပြပြီးနောက် ဆုလာဘ် status ကို စစ်ဆေးရန် အသုံးပြုသည်
 *
 * @header {string} Authorization - Bearer <JWT token>
 * @returns {Object} Reward status and time balance info
 */
router.post('/reward-status', authenticate, async (req, res, next) => {
  try {
    const user = req.user;

    // Reload user to get latest data
    // နောက်ဆုံး data ကို ရယူရန် user ကို reload ပြုလုပ်ခြင်း
    await user.reload();

    // Check if a reward was given in the last 5 minutes
    // နောက်ဆုံး 5 မိနစ်အတွင်း ဆုလာဘ် ပေးခဲ့လား စစ်ဆေးခြင်း
    const recentReward = user.lastRewardAt
      ? Date.now() - new Date(user.lastRewardAt).getTime() < 5 * 60 * 1000
      : false;

    logger.debug(`Reward status check: ${user.username}`, {
      recentReward,
      lastRewardAt: user.lastRewardAt,
      timeBalance: user.timeBalance,
    });

    return res.status(200).json(
      successResponse(
        {
          recentReward,
          lastRewardAt: user.lastRewardAt,
          timeBalance: user.timeBalance,
          formattedBalance: formatTime(user.timeBalance),
          totalAdsWatched: user.totalAdsWatched,
          rewardDurationHours: config.admob.rewardDurationHours,
        },
        recentReward
          ? 'Reward received recently.'
          : 'No recent reward.'
      )
    );
  } catch (error) {
    logger.error('Reward status check error:', { error: error.message });
    next(error);
  }
});

module.exports = router;
