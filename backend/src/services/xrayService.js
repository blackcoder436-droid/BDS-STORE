/**
 * ============================================
 * BDS STORE VPN Backend - 3x-ui (Xray) Service
 * 3x-ui Panel ဝန်ဆောင်မှု - Xray Core Panel API Integration
 * ============================================
 *
 * Communicates with the 3x-ui panel API to manage VPN clients:
 * - Login and session management (auto-refresh on cookie expiry)
 * - Add/remove/get clients on inbounds
 * - Generate VLESS/VMess config links for Flutter client
 *
 * 3x-ui panel API နှင့် ဆက်သွယ်ပြီး VPN clients များကို စီမံခန့်ခွဲသည်
 */

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Session state for 3x-ui panel authentication
 * 3x-ui panel authentication အတွက် session state
 */
let sessionCookie = null;
let cookieExpiry = null;

/**
 * Create an axios instance configured for the 3x-ui panel
 * 3x-ui panel အတွက် ဖွဲ့စည်းထားသော axios instance ဖန်တီးခြင်း
 */
const panelApi = axios.create({
  baseURL: config.xui.panelUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  // Accept self-signed certs (common for VPN panels)
  // VPN panels တွင် self-signed certs ကို လက်ခံခြင်း
  httpsAgent: new (require('https').Agent)({
    rejectUnauthorized: false,
  }),
});

/**
 * Login to the 3x-ui panel and store session cookie
 * 3x-ui panel သို့ login ပြုလုပ်ပြီး session cookie ကို သိမ်းဆည်းခြင်း
 *
 * @returns {Promise<boolean>} True if login successful
 * @throws {Error} If login fails
 */
async function login() {
  try {
    logger.info('XrayService: Logging in to 3x-ui panel...');

    const response = await panelApi.post('/login', {
      username: config.xui.username,
      password: config.xui.password,
    });

    if (response.data && response.data.success) {
      // Extract session cookie from response headers
      // Response headers မှ session cookie ကို ထုတ်ယူခြင်း
      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader && setCookieHeader.length > 0) {
        sessionCookie = setCookieHeader
          .map((cookie) => cookie.split(';')[0])
          .join('; ');
      }

      // Set cookie expiry to 1 hour from now (refresh before it expires)
      // Cookie expiry ကို ယခုမှ 1 နာရီ အဖြစ် သတ်မှတ်ခြင်း
      cookieExpiry = Date.now() + 55 * 60 * 1000; // 55 minutes

      logger.info('XrayService: Successfully logged in to 3x-ui panel');
      return true;
    }

    throw new Error(response.data?.msg || 'Login failed - invalid response');
  } catch (error) {
    logger.error('XrayService: Login failed', {
      error: error.message,
      panelUrl: config.xui.panelUrl,
    });
    sessionCookie = null;
    cookieExpiry = null;
    throw new Error(`3x-ui panel login failed: ${error.message}`);
  }
}

/**
 * Ensure we have a valid session (auto-refresh if expired)
 * Valid session ရှိကြောင်း သေချာစေခြင်း (expired ဖြစ်လျှင် auto-refresh)
 *
 * @returns {Promise<void>}
 */
async function ensureSession() {
  if (!sessionCookie || !cookieExpiry || Date.now() >= cookieExpiry) {
    logger.debug('XrayService: Session expired or missing, re-authenticating...');
    await login();
  }
}

/**
 * Make an authenticated request to the 3x-ui panel API
 * 3x-ui panel API သို့ authenticated request ပြုလုပ်ခြင်း
 *
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - API endpoint path
 * @param {Object} [data] - Request body data
 * @returns {Promise<Object>} Response data
 */
async function makeRequest(method, path, data = null) {
  await ensureSession();

  try {
    const response = await panelApi({
      method,
      url: path,
      data,
      headers: {
        Cookie: sessionCookie,
      },
    });

    return response.data;
  } catch (error) {
    // If unauthorized, try re-login once
    // Unauthorized ဖြစ်လျှင် တစ်ကြိမ် re-login ကြိုးစားမည်
    if (error.response && error.response.status === 401) {
      logger.warn('XrayService: Session expired, re-authenticating...');
      await login();

      const retryResponse = await panelApi({
        method,
        url: path,
        data,
        headers: {
          Cookie: sessionCookie,
        },
      });
      return retryResponse.data;
    }
    throw error;
  }
}

/**
 * Get all inbounds from the 3x-ui panel
 * 3x-ui panel မှ inbounds အားလုံးကို ရယူခြင်း
 *
 * @returns {Promise<Array>} Array of inbound objects
 */
async function getInbounds() {
  try {
    const result = await makeRequest('GET', '/panel/api/inbounds/list');

    if (result && result.success) {
      logger.debug(`XrayService: Found ${result.obj?.length || 0} inbounds`);
      return result.obj || [];
    }

    throw new Error(result?.msg || 'Failed to fetch inbounds');
  } catch (error) {
    logger.error('XrayService: Failed to get inbounds', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Add a new client to an inbound in the 3x-ui panel
 * 3x-ui panel ရှိ inbound တစ်ခုသို့ client အသစ် ထည့်ခြင်း
 *
 * @param {string} userId - Application user ID
 * @param {string} email - Client email/identifier for 3x-ui
 * @returns {Promise<Object>} Created client info including UUID
 */
async function addClient(userId, email) {
  try {
    const clientUUID = crypto.randomUUID();
    const inboundId = config.xui.defaultInboundId;

    logger.info(`XrayService: Adding client for user ${userId}`, {
      email,
      inboundId,
      clientUUID,
    });

    // Client settings for VLESS protocol (most common for 3x-ui)
    // VLESS protocol အတွက် client settings (3x-ui တွင် အသုံးအများဆုံး)
    const clientData = {
      id: inboundId,
      settings: JSON.stringify({
        clients: [
          {
            id: clientUUID,
            flow: '',
            email: email || `bds_${userId.substring(0, 8)}`,
            limitIp: 2, // Max 2 simultaneous connections | တစ်ပြိုင်နက် ချိတ်ဆက်မှု 2 ခု
            totalGB: 0, // 0 = unlimited data | 0 = data ကန့်သတ်မှု မရှိ
            expiryTime: 0, // 0 = no expiry (managed by our time system)
            enable: true,
            tgId: '',
            subId: '',
          },
        ],
      }),
    };

    const result = await makeRequest(
      'POST',
      '/panel/api/inbounds/addClient',
      clientData
    );

    if (result && result.success) {
      logger.info(`XrayService: Client added successfully`, {
        userId,
        clientUUID,
      });
      return {
        clientUUID,
        email: email || `bds_${userId.substring(0, 8)}`,
        inboundId,
      };
    }

    throw new Error(result?.msg || 'Failed to add client to 3x-ui panel');
  } catch (error) {
    logger.error('XrayService: Failed to add client', {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get the existing configuration for a client by searching inbounds
 * Inbounds ကို ရှာဖွေပြီး client ၏ ရှိပြီးသား configuration ကို ရယူခြင်း
 *
 * @param {string} vpnClientId - The client UUID in 3x-ui
 * @returns {Promise<Object|null>} Client config or null if not found
 */
async function getClientConfig(vpnClientId) {
  try {
    if (!vpnClientId) return null;

    const inbounds = await getInbounds();

    for (const inbound of inbounds) {
      let settings;
      try {
        settings = JSON.parse(inbound.settings);
      } catch {
        continue;
      }

      const client = (settings.clients || []).find(
        (c) => c.id === vpnClientId
      );

      if (client) {
        logger.debug(`XrayService: Found client config for ${vpnClientId}`);
        return {
          client,
          inbound: {
            id: inbound.id,
            port: inbound.port,
            protocol: inbound.protocol,
            tag: inbound.tag,
            streamSettings: inbound.streamSettings,
            remark: inbound.remark,
          },
        };
      }
    }

    logger.debug(`XrayService: No client config found for ${vpnClientId}`);
    return null;
  } catch (error) {
    logger.error('XrayService: Failed to get client config', {
      vpnClientId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Remove (disable) a client from the 3x-ui panel
 * 3x-ui panel မှ client ကို ဖယ်ရှားခြင်း (disable)
 *
 * @param {string} vpnClientId - The client UUID in 3x-ui
 * @returns {Promise<boolean>} True if removal successful
 */
async function removeClient(vpnClientId) {
  try {
    if (!vpnClientId) return false;

    const inboundId = config.xui.defaultInboundId;

    logger.info(`XrayService: Removing client ${vpnClientId}`);

    const result = await makeRequest(
      'POST',
      `/panel/api/inbounds/${inboundId}/delClient/${vpnClientId}`
    );

    if (result && result.success) {
      logger.info(`XrayService: Client ${vpnClientId} removed successfully`);
      return true;
    }

    logger.warn(`XrayService: Failed to remove client`, {
      vpnClientId,
      msg: result?.msg,
    });
    return false;
  } catch (error) {
    logger.error('XrayService: Failed to remove client', {
      vpnClientId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Enable or disable a client on the 3x-ui panel
 * 3x-ui panel တွင် client ကို enable/disable ပြုလုပ်ခြင်း
 *
 * @param {string} vpnClientId - The client UUID
 * @param {boolean} enable - True to enable, false to disable
 * @returns {Promise<boolean>} Success status
 */
async function toggleClient(vpnClientId, enable) {
  try {
    const clientConfig = await getClientConfig(vpnClientId);
    if (!clientConfig) {
      logger.warn(`XrayService: Cannot toggle - client not found: ${vpnClientId}`);
      return false;
    }

    const inboundId = clientConfig.inbound.id;

    const updateData = {
      id: inboundId,
      settings: JSON.stringify({
        clients: [
          {
            ...clientConfig.client,
            enable,
          },
        ],
      }),
    };

    const result = await makeRequest(
      'POST',
      `/panel/api/inbounds/updateClient/${vpnClientId}`,
      updateData
    );

    if (result && result.success) {
      logger.info(`XrayService: Client ${vpnClientId} ${enable ? 'enabled' : 'disabled'}`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error('XrayService: Failed to toggle client', {
      vpnClientId,
      enable,
      error: error.message,
    });
    return false;
  }
}

/**
 * Main function: Get or create VPN config for a user
 * အဓိက function: သုံးစွဲသူအတွက် VPN config ရယူ သို့မဟုတ် ဖန်တီးခြင်း
 *
 * Flow:
 * 1. If user has vpnClientId, try to get existing config
 * 2. If no config exists, create a new client
 * 3. If user has no time remaining, disable access
 * 4. Return config link or null
 *
 * @param {Object} user - User model instance
 * @returns {Promise<Object|null>} VPN config object or null
 */
async function getAvailableConfig(user) {
  try {
    // If user has no time remaining, disable their access
    // သုံးစွဲသူတွင် အချိန် ကျန်မရှိလျှင် ၎င်းတို့၏ access ကို disable ပြုလုပ်မည်
    if (!user.hasTimeRemaining()) {
      if (user.vpnClientId) {
        await toggleClient(user.vpnClientId, false);
      }
      logger.info(`XrayService: User ${user.id} has no time remaining - access disabled`);
      return null;
    }

    // Try to get existing config
    // ရှိပြီးသား config ကို ရယူကြိုးစားခြင်း
    if (user.vpnClientId) {
      const existingConfig = await getClientConfig(user.vpnClientId);
      if (existingConfig) {
        // Ensure client is enabled
        if (!existingConfig.client.enable) {
          await toggleClient(user.vpnClientId, true);
        }
        return buildConfigResponse(existingConfig, user.vpnClientId);
      }
    }

    // Create new client config
    // Client config အသစ် ဖန်တီးခြင်း
    logger.info(`XrayService: Creating new VPN config for user ${user.id}`);
    const newClient = await addClient(user.id, user.email);

    // Save the vpnClientId to the user record
    user.vpnClientId = newClient.clientUUID;
    await user.save();

    // Fetch the full config for the new client
    const newConfig = await getClientConfig(newClient.clientUUID);
    if (newConfig) {
      return buildConfigResponse(newConfig, newClient.clientUUID);
    }

    return {
      clientId: newClient.clientUUID,
      protocol: 'VLESS',
      message: 'Config created. Fetching full details...',
    };
  } catch (error) {
    logger.error('XrayService: Failed to get available config', {
      userId: user.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Build a standardized config response from raw 3x-ui data
 * Raw 3x-ui data မှ standardized config response တည်ဆောက်ခြင်း
 *
 * @param {Object} configData - Raw config data from getClientConfig
 * @param {string} clientUUID - The client UUID
 * @returns {Object} Formatted config response
 */
function buildConfigResponse(configData, clientUUID) {
  const { inbound } = configData;
  const protocol = (inbound.protocol || 'vless').toUpperCase();

  let streamSettings;
  try {
    streamSettings = typeof inbound.streamSettings === 'string'
      ? JSON.parse(inbound.streamSettings)
      : inbound.streamSettings;
  } catch {
    streamSettings = {};
  }

  const network = streamSettings?.network || 'tcp';
  const security = streamSettings?.security || 'none';

  // Build the subscription/config link
  // Subscription/config link ကို တည်ဆောက်ခြင်း
  const panelHost = new URL(config.xui.panelUrl).hostname;

  let configLink = '';
  if (protocol === 'VLESS') {
    configLink = `vless://${clientUUID}@${panelHost}:${inbound.port}?type=${network}&security=${security}#BDS-STORE-VPN`;
  } else if (protocol === 'VMESS') {
    const vmessConfig = {
      v: '2',
      ps: 'BDS-STORE-VPN',
      add: panelHost,
      port: String(inbound.port),
      id: clientUUID,
      aid: '0',
      net: network,
      type: 'none',
      tls: security === 'tls' ? 'tls' : '',
    };
    configLink = `vmess://${Buffer.from(JSON.stringify(vmessConfig)).toString('base64')}`;
  }

  return {
    clientId: clientUUID,
    protocol,
    port: inbound.port,
    network,
    security,
    configLink,
    serverAddress: panelHost,
    remark: inbound.remark || 'BDS STORE VPN',
  };
}

module.exports = {
  login,
  getInbounds,
  addClient,
  getClientConfig,
  removeClient,
  toggleClient,
  getAvailableConfig,
};
