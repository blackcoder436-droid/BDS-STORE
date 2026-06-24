/**
 * ============================================
 * BDS STORE VPN Backend - Main Server Entry Point
 * ပင်မ Server - Express Application Server
 * ============================================
 *
 * This is the main entry point for the BDS STORE VPN API server.
 * It initializes Express with security middleware, connects to PostgreSQL,
 * mounts all API routes, and handles graceful shutdown.
 *
 * BDS STORE VPN API server ၏ ပင်မ entry point ဖြစ်သည်
 * Express ကို security middleware ဖြင့် initialize ပြုလုပ်ပြီး
 * PostgreSQL သို့ ချိတ်ဆက်ကာ API routes အားလုံးကို mount ပြုလုပ်သည်
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

// Load config first (this also loads .env)
// Config ကို အရင် load ပြုလုပ်ခြင်း (.env ကိုလည်း load ပြုလုပ်မည်)
const config = require('./config');
const logger = require('./utils/logger');

// Database & Models
const { testConnection, syncDatabase } = require('./config/database');
require('./models'); // Initialize models & associations

// Middleware
const { generalLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const adsRoutes = require('./routes/ads');
const vpnRoutes = require('./routes/vpn');

// ============================================
// Express App Setup
// Express App ဖွဲ့စည်းခြင်း
// ============================================
const app = express();

// --- Security Middleware ---
// လုံခြုံရေး Middleware

/**
 * Helmet: Sets various HTTP security headers
 * HTTP လုံခြုံရေး headers အမျိုးမျိုးကို သတ်မှတ်ခြင်း
 */
app.use(helmet());

/**
 * CORS: Cross-Origin Resource Sharing
 * Allow requests from any origin in development, restrict in production
 */
app.use(
  cors({
    origin: config.isDev ? '*' : process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // Cache preflight for 24 hours
  })
);

// --- Body Parsers ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- General Rate Limiter ---
// ယေဘုယျ Rate Limiter - API requests အားလုံးအတွက်
app.use('/api/', generalLimiter);

// --- Request Logging Middleware ---
// Request Logging Middleware - ဝင်လာသော requests ကို log ပြုလုပ်ခြင်း
app.use((req, res, next) => {
  const start = Date.now();

  // Log after response is sent | Response ပေးပို့ပြီးနောက် log ပြုလုပ်ခြင်း
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'debug';

    logger[logLevel](
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      }
    );
  });

  next();
});

// ============================================
// API Routes
// API လမ်းကြောင်းများ
// ============================================

/**
 * Health check endpoint
 * ကျန်းမာရေး စစ်ဆေးခြင်း endpoint
 *
 * GET /api/v1/health
 * Returns server status, uptime, and environment info
 */
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'BDS STORE VPN API is running.',
    data: {
      status: 'healthy',
      environment: config.nodeEnv,
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

/**
 * Mount API route groups at versioned paths
 * API route groups ကို versioned paths တွင် mount ပြုလုပ်ခြင်း
 */
app.use('/api/v1/auth', authRoutes);  // Authentication routes
app.use('/api/v1/ads', adsRoutes);    // AdMob verification routes
app.use('/api/v1/vpn', vpnRoutes);    // VPN management routes

// --- Root endpoint ---
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to BDS STORE VPN API',
    docs: '/api/v1/health',
  });
});

// ============================================
// Error Handling
// Error ကိုင်တွယ်ခြင်း
// ============================================

// 404 handler for undefined routes
// သတ်မှတ်မထားသော routes အတွက် 404 handler
app.use(notFoundHandler);

// Global error handler (must be last middleware)
// Global error handler (နောက်ဆုံး middleware ဖြစ်ရမည်)
app.use(globalErrorHandler);

// ============================================
// Server Startup
// Server စတင်ခြင်း
// ============================================

/**
 * Initialize database connection and start the server
 * ဒေတာဘေ့စ် ချိတ်ဆက်မှုကို initialize ပြုလုပ်ပြီး server ကို စတင်ခြင်း
 */
async function startServer() {
  try {
    // 1. Test database connection
    // ဒေတာဘေ့စ် ချိတ်ဆက်မှုကို စမ်းသပ်ခြင်း
    logger.info('🚀 Starting BDS STORE VPN API Server...');
    await testConnection();

    // 2. Sync database models (runtimes table sync disabled, use npm run db:sync manually)
    // ဒေတာဘေ့စ် models ကို sync ပြုလုပ်ခြင်း (server run ချိန်တွင် disable ထားသည်၊ လက်動 syncDb.js သုံးရန်)
    if (process.env.DB_SYNC === 'true') {
      await syncDatabase({ alter: config.isDev });
    }

    // 3. Start Express server
    // Express server ကို စတင်ခြင်း
    const server = app.listen(config.port, () => {
      logger.info(`✅ BDS STORE VPN API Server is running!`);
      logger.info(`   📡 Port: ${config.port}`);
      logger.info(`   🌍 Environment: ${config.nodeEnv}`);
      logger.info(`   🔗 Health: http://localhost:${config.port}/api/v1/health`);
      logger.info(`   📋 Routes:`);
      logger.info(`      - /api/v1/auth   (Register, Login, Profile)`);
      logger.info(`      - /api/v1/ads    (AdMob SSV Verification)`);
      logger.info(`      - /api/v1/vpn    (Config, Connect, Disconnect, Status)`);
    });

    // ============================================
    // Graceful Shutdown
    // မွေးမြူစွာ ပိတ်ခြင်း
    // ============================================

    /**
     * Handle graceful shutdown on SIGTERM/SIGINT
     * SIGTERM/SIGINT signal ရရှိလျှင် server ကို မွေးမြူစွာ ပိတ်ခြင်း
     */
    const gracefulShutdown = async (signal) => {
      logger.info(`\n⏏️  ${signal} received. Starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('   ✅ HTTP server closed.');

        try {
          // Close database connection pool
          // ဒေတာဘေ့စ် ချိတ်ဆက်မှု pool ကို ပိတ်ခြင်း
          const { sequelize } = require('./config/database');
          await sequelize.close();
          logger.info('   ✅ Database connections closed.');
        } catch (err) {
          logger.error('   ❌ Error closing database:', err.message);
        }

        logger.info('🛑 BDS STORE VPN API Server shut down gracefully.');
        process.exit(0);
      });

      // Force shutdown after 10 seconds if graceful shutdown hangs
      // Graceful shutdown ပိတ်မှာ ရပ်နေလျှင် 10 စက္ကန့်နောက် အတင်း ပိတ်ခြင်း
      setTimeout(() => {
        logger.error('⚠️  Forced shutdown after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection:', {
        reason: reason?.message || reason,
        stack: reason?.stack,
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', {
        message: error.message,
        stack: error.stack,
      });
      // Exit on uncaught exceptions (let process manager restart)
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error('❌ Failed to start server:', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Start the server
// Server ကို စတင်ခြင်း
startServer();

// Export app for testing
module.exports = app;
