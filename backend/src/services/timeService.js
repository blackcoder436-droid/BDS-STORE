/**
 * ============================================
 * BDS STORE VPN Backend - Time Balance Service
 * အချိန်လက်ကျန် ဝန်ဆောင်မှု - VPN Time Balance Management
 * ============================================
 *
 * Manages user VPN time balance:
 * - Adding reward time from ads
 * - Deducting connection time from sessions
 * - Expiring users with zero balance
 * - Formatting remaining time for display
 *
 * သုံးစွဲသူ VPN အချိန် လက်ကျန်ကို စီမံခန့်ခွဲသည်
 */

const { User, Session } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { formatTime, hoursToSeconds } = require('../utils/helpers');
const config = require('../config');

/**
 * Add reward time to a user's balance (after watching an ad)
 * သုံးစွဲသူ၏ လက်ကျန်သို့ ဆုလာဘ် အချိန် ထည့်ခြင်း (ကြော်ငြာ ကြည့်ပြီးနောက်)
 *
 * @param {string} userId - The user's UUID
 * @param {number} hours - Number of hours to add (defaults to ADMOB_REWARD_DURATION_HOURS)
 * @returns {Promise<Object>} Updated balance info
 * @throws {Error} If user not found
 */
async function addRewardTime(userId, hours = null) {
  try {
    const rewardHours = hours || config.admob.rewardDurationHours;
    const rewardSeconds = hoursToSeconds(rewardHours);

    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Add time and update ad counter
    // အချိန် ထည့်ပြီး ကြော်ငြာ counter ကို update ပြုလုပ်ခြင်း
    const previousBalance = user.timeBalance;
    user.timeBalance += rewardSeconds;
    user.totalAdsWatched += 1;
    user.lastRewardAt = new Date();
    await user.save();

    const result = {
      userId,
      hoursAdded: rewardHours,
      secondsAdded: rewardSeconds,
      previousBalance,
      newBalance: user.timeBalance,
      totalAdsWatched: user.totalAdsWatched,
      formattedBalance: formatTime(user.timeBalance),
    };

    logger.info('TimeService: Reward time added', result);
    return result;
  } catch (error) {
    logger.error('TimeService: Failed to add reward time', {
      userId,
      hours,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Deduct connection time from user's balance based on session duration
 * Session ကြာချိန်ပေါ် အခြေခံ၍ သုံးစွဲသူ၏ လက်ကျန်မှ ချိတ်ဆက်ချိန် နုတ်ခြင်း
 *
 * @param {string} sessionId - The session UUID
 * @returns {Promise<Object>} Deduction info with new balance
 * @throws {Error} If session not found
 */
async function deductConnectionTime(sessionId) {
  try {
    const session = await Session.findByPk(sessionId, {
      include: [{ model: User, as: 'user' }],
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.user) {
      throw new Error(`User not found for session: ${sessionId}`);
    }

    // Calculate duration in seconds
    // ကြာချိန်ကို စက္ကန့်ဖြင့် တွက်ချက်ခြင်း
    const durationSeconds = session.getDurationSeconds();

    // Deduct time from user balance
    // User balance မှ အချိန် နုတ်ခြင်း
    const previousBalance = session.user.timeBalance;
    await session.user.deductTime(durationSeconds);

    const result = {
      sessionId,
      userId: session.userId,
      durationSeconds,
      formattedDuration: formatTime(durationSeconds),
      previousBalance,
      newBalance: session.user.timeBalance,
      formattedBalance: formatTime(session.user.timeBalance),
    };

    logger.info('TimeService: Connection time deducted', result);
    return result;
  } catch (error) {
    logger.error('TimeService: Failed to deduct connection time', {
      sessionId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Check and expire users who have zero time balance
 * အချိန် လက်ကျန် သုည ရှိသော သုံးစွဲသူများကို စစ်ဆေးပြီး expire ပြုလုပ်ခြင်း
 *
 * Also closes any active sessions for expired users.
 * Expire ဖြစ်သော သုံးစွဲသူများ၏ active sessions ကိုလည်း ပိတ်မည်
 *
 * @returns {Promise<Object>} Expiration summary
 */
async function checkAndExpireUsers() {
  try {
    logger.debug('TimeService: Checking for expired users...');

    // Find active sessions where user has no time remaining
    // အချိန် ကျန်မရှိသော user ၏ active sessions ကို ရှာဖွေခြင်း
    const expiredSessions = await Session.findAll({
      where: { status: 'active' },
      include: [
        {
          model: User,
          as: 'user',
          where: { timeBalance: { [Op.lte]: 0 } },
        },
      ],
    });

    let closedSessionCount = 0;
    const now = new Date();

    for (const session of expiredSessions) {
      // Close the session | Session ကို ပိတ်ခြင်း
      session.endTime = now;
      session.status = 'expired';
      await session.save();
      closedSessionCount++;

      logger.info(`TimeService: Expired session ${session.id} for user ${session.userId}`);
    }

    const result = {
      checkedAt: now.toISOString(),
      expiredSessionsClosed: closedSessionCount,
    };

    if (closedSessionCount > 0) {
      logger.info('TimeService: Expiration check completed', result);
    } else {
      logger.debug('TimeService: No expired sessions found');
    }

    return result;
  } catch (error) {
    logger.error('TimeService: Failed to check and expire users', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get the remaining VPN time for a user
 * သုံးစွဲသူ၏ ကျန်ရှိသော VPN အချိန်ကို ရယူခြင်း
 *
 * @param {string} userId - The user's UUID
 * @returns {Promise<Object>} Remaining time info
 */
async function getRemainingTime(userId) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Check if user has an active session
    // User တွင် active session ရှိ/မရှိ စစ်ဆေးခြင်း
    const activeSession = await Session.findOne({
      where: {
        userId,
        status: 'active',
      },
      order: [['startTime', 'DESC']],
    });

    let effectiveBalance = user.timeBalance;

    // If there's an active session, deduct elapsed time from display
    // Active session ရှိလျှင် ကုန်ဆုံးခဲ့သော အချိန်ကို display မှ နုတ်ခြင်း
    if (activeSession) {
      const elapsedSeconds = activeSession.getDurationSeconds();
      effectiveBalance = Math.max(0, user.timeBalance - elapsedSeconds);
    }

    return {
      userId,
      timeBalanceSeconds: user.timeBalance,
      effectiveBalanceSeconds: effectiveBalance,
      formattedBalance: formatTime(user.timeBalance),
      formattedEffective: formatTime(effectiveBalance),
      hasTimeRemaining: effectiveBalance > 0,
      isConnected: !!activeSession,
      activeSessionId: activeSession?.id || null,
      totalAdsWatched: user.totalAdsWatched,
      lastRewardAt: user.lastRewardAt,
    };
  } catch (error) {
    logger.error('TimeService: Failed to get remaining time', {
      userId,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  addRewardTime,
  deductConnectionTime,
  checkAndExpireUsers,
  getRemainingTime,
};
