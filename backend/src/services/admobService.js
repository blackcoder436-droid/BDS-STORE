/**
 * ============================================
 * BDS STORE VPN Backend - AdMob SSV Service
 * AdMob SSV ဝန်ဆောင်မှု - Google AdMob Server-Side Verification
 * ============================================
 *
 * Handles verification of AdMob reward callbacks using ECDSA/SHA256.
 * Fetches and caches Google's public keys, then verifies the cryptographic
 * signature sent by AdMob to confirm a user legitimately watched an ad.
 *
 * AdMob reward callbacks ကို ECDSA/SHA256 ဖြင့် စစ်ဆေးခြင်းကို ကိုင်တွယ်သည်
 * Google ၏ public keys ကို ရယူ+cache ပြုလုပ်ပြီး ကြော်ငြာကို တကယ်ကြည့်ကြောင်း စစ်ဆေးသည်
 */

const crypto = require('crypto');
const axios = require('axios');
const NodeCache = require('node-cache');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Cache for Google's AdMob public keys
 * Google ၏ AdMob public keys အတွက် cache
 * TTL: 24 hours (keys rarely change)
 */
const keyCache = new NodeCache({
  stdTTL: 86400, // 24 hours in seconds
  checkperiod: 3600, // Check for expired keys every hour
  useClones: false,
});

const CACHE_KEY = 'admob_public_keys';

/**
 * Fetch Google's AdMob reward verification public keys
 * Google ၏ AdMob reward verification public keys ကို ရယူခြင်း
 *
 * Keys are cached for 24 hours to avoid excessive HTTP requests.
 * Keys ကို HTTP request များ လျှော့ချရန် 24 နာရီ cache ပြုလုပ်ထားသည်
 *
 * @returns {Promise<Object>} Object mapping key_id -> { pem, base64 }
 * @throws {Error} If keys cannot be fetched
 */
async function fetchPublicKeys() {
  // Check cache first | Cache ကို အရင် စစ်ဆေးခြင်း
  const cachedKeys = keyCache.get(CACHE_KEY);
  if (cachedKeys) {
    logger.debug('AdMob SSV: Using cached public keys');
    return cachedKeys;
  }

  try {
    logger.info('AdMob SSV: Fetching public keys from Google...');
    const response = await axios.get(config.admob.keyServerUrl, {
      timeout: 10000, // 10 second timeout
    });

    const { keys } = response.data;

    if (!keys || !Array.isArray(keys)) {
      throw new Error('Invalid key response format from Google');
    }

    // Build a map of keyId -> key data
    // keyId -> key data map ကို တည်ဆောက်ခြင်း
    const keyMap = {};
    for (const key of keys) {
      keyMap[String(key.keyId)] = {
        pem: key.pem,
        base64: key.base64,
      };
    }

    // Cache the keys | Keys ကို cache ပြုလုပ်ခြင်း
    keyCache.set(CACHE_KEY, keyMap);
    logger.info(`AdMob SSV: Cached ${Object.keys(keyMap).length} public keys`);

    return keyMap;
  } catch (error) {
    logger.error('AdMob SSV: Failed to fetch public keys', {
      error: error.message,
    });
    throw new Error('Failed to fetch AdMob verification keys from Google.');
  }
}

/**
 * Verify an AdMob SSV (Server-Side Verification) callback
 * AdMob SSV callback ကို စစ်ဆေးခြင်း
 *
 * This function:
 * 1. Extracts the signature and key_id from query params
 * 2. Constructs the verification message from the remaining params
 * 3. Fetches the public key matching key_id
 * 4. Verifies the ECDSA/SHA256 signature
 *
 * @param {Object} queryParams - The full query parameters from AdMob callback
 * @param {string} queryParams.signature - Base64url-encoded signature
 * @param {string} queryParams.key_id - ID of the key used to sign
 * @param {string} queryParams.ad_network - Ad network identifier
 * @param {string} queryParams.ad_unit - Ad unit ID
 * @param {string} queryParams.reward_amount - Reward amount
 * @param {string} queryParams.reward_item - Reward item type
 * @param {string} queryParams.user_id - User ID (custom data from app)
 * @param {string} queryParams.timestamp - Timestamp of the callback
 * @returns {Promise<boolean>} True if signature is valid
 */
async function verifySSVCallback(queryParams) {
  try {
    const { signature, key_id } = queryParams;

    if (!signature || !key_id) {
      logger.warn('AdMob SSV: Missing signature or key_id in callback');
      return false;
    }

    // 1. Fetch public keys | Public keys ကို ရယူခြင်း
    const keys = await fetchPublicKeys();
    const keyData = keys[String(key_id)];

    if (!keyData) {
      logger.warn(`AdMob SSV: No public key found for key_id: ${key_id}`);
      return false;
    }

    // 2. Construct the message to verify
    // စစ်ဆေးရမည့် message ကို တည်ဆောက်ခြင်း
    // The message is the full query string WITHOUT signature and key_id
    // Message သည် signature နှင့် key_id မပါဘဲ query string အပြည့် ဖြစ်သည်
    const queryString = buildVerificationMessage(queryParams);

    // 3. Decode the base64url signature
    // Base64url signature ကို decode ပြုလုပ်ခြင်း
    const signatureBuffer = Buffer.from(
      signature.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    );

    // 4. Verify the ECDSA/SHA256 signature
    // ECDSA/SHA256 signature ကို စစ်ဆေးခြင်း
    const verifier = crypto.createVerify('SHA256');
    verifier.update(queryString);
    verifier.end();

    const isValid = verifier.verify(keyData.pem, signatureBuffer);

    if (isValid) {
      logger.info('AdMob SSV: Signature verified successfully', {
        userId: queryParams.user_id,
        rewardAmount: queryParams.reward_amount,
      });
    } else {
      logger.warn('AdMob SSV: Signature verification FAILED', {
        userId: queryParams.user_id,
        keyId: key_id,
      });
    }

    return isValid;
  } catch (error) {
    logger.error('AdMob SSV: Verification error', { error: error.message });
    return false;
  }
}

/**
 * Build the verification message string from query parameters
 * Query parameters မှ verification message string ကို တည်ဆောက်ခြင်း
 *
 * AdMob SSV uses specific query param ordering for signature verification.
 * The message includes all params except 'signature' and 'key_id', in the
 * exact order they appear in the query string.
 *
 * @param {Object} queryParams - The full query parameters
 * @returns {string} The constructed message for verification
 */
function buildVerificationMessage(queryParams) {
  // Build the message from query params (excluding signature and key_id)
  // Query params မှ message ကို တည်ဆောက်ခြင်း (signature နှင့် key_id မပါ)
  const paramKeys = Object.keys(queryParams)
    .filter((key) => key !== 'signature' && key !== 'key_id')
    .sort(); // Sort alphabetically as per Google's specification

  const messageParts = paramKeys.map(
    (key) => `${key}=${queryParams[key]}`
  );

  return messageParts.join('&');
}

/**
 * Clear the cached keys (useful for testing or key rotation)
 * Cache ထားသော keys ကို ရှင်းလင်းခြင်း (testing သို့မဟုတ် key rotation အတွက်)
 */
function clearKeyCache() {
  keyCache.flushAll();
  logger.info('AdMob SSV: Key cache cleared');
}

module.exports = {
  verifySSVCallback,
  fetchPublicKeys,
  clearKeyCache,
};
