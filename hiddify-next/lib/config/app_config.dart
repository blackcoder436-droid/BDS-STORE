/// BDS STORE VPN - Application Configuration
///
/// Centralizes all app-level configuration constants including API endpoints,
/// AdMob ad unit IDs, reward durations, and app metadata.
///
/// Usage:
///   - For development, the default test Ad Unit IDs are used.
///   - For production, override via environment variables or build flags:
///     `flutter run --dart-define=API_BASE_URL=https://your-api.com`
///
/// Integration with Hiddify-Next:
///   Import this config wherever you need API URLs or ad unit IDs.
///   TODO: Merge with Hiddify's existing config system if applicable.
library;

/// Main application configuration.
///
/// All values can be overridden at build time using `--dart-define` flags.
/// This allows different configurations for dev, staging, and production
/// without code changes.
class AppConfig {
  AppConfig._();

  // ─────────────────────────────────────────────
  // App Metadata
  // ─────────────────────────────────────────────

  /// Application display name.
  static const String appName = 'BDS STORE VPN';

  /// Current application version (semver).
  static const String appVersion = '1.0.0';

  /// Build number for store submissions.
  static const int buildNumber = 1;

  /// Package identifier used for AdMob and store listings.
  static const String packageName = 'com.bdsstore.vpn';

  // ─────────────────────────────────────────────
  // Backend API Configuration
  // ─────────────────────────────────────────────

  /// Base URL for the BDS STORE backend API.
  ///
  /// Override at build time:
  /// ```
  /// flutter run --dart-define=API_BASE_URL=https://api.bdsstore.com
  /// ```
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:8000',
  );

  /// API version prefix appended to all endpoint paths.
  static const String apiVersion = '/api/v1';

  /// Full API base path combining [apiBaseUrl] and [apiVersion].
  static String get apiBasePath => '$apiBaseUrl$apiVersion';

  /// HTTP request timeout duration.
  static const Duration requestTimeout = Duration(seconds: 30);

  /// Connection timeout for establishing the TCP connection.
  static const Duration connectTimeout = Duration(seconds: 15);

  // ─────────────────────────────────────────────
  // API Endpoints
  // ─────────────────────────────────────────────

  /// Authentication endpoints.
  static const String registerEndpoint = '/auth/register';
  static const String loginEndpoint = '/auth/login';
  static const String refreshTokenEndpoint = '/auth/refresh';

  /// User profile endpoints.
  static const String profileEndpoint = '/users/profile';

  /// VPN configuration endpoints.
  static const String vpnConfigEndpoint = '/vpn/config';
  static const String vpnStatusEndpoint = '/vpn/status';
  static const String vpnConnectEndpoint = '/vpn/connect';
  static const String vpnDisconnectEndpoint = '/vpn/disconnect';

  /// Ad reward verification endpoint.
  static const String adVerifyEndpoint = '/ads/verify';

  /// Reward status endpoint.
  static const String rewardStatusEndpoint = '/ads/reward-status';

  // ─────────────────────────────────────────────
  // AdMob Configuration
  // ─────────────────────────────────────────────

  /// AdMob Rewarded Video Ad Unit ID for Android.
  ///
  /// Default is the official Google test ad unit ID.
  /// Override for production:
  /// ```
  /// flutter run --dart-define=ADMOB_ANDROID_REWARDED_ID=ca-app-pub-XXXXX/YYYYY
  /// ```
  static const String admobAndroidRewardedId = String.fromEnvironment(
    'ADMOB_ANDROID_REWARDED_ID',
    defaultValue: 'ca-app-pub-3940256099942544/5224354917', // Google test ID
  );

  /// AdMob Rewarded Video Ad Unit ID for iOS.
  ///
  /// Default is the official Google test ad unit ID.
  static const String admobIosRewardedId = String.fromEnvironment(
    'ADMOB_IOS_REWARDED_ID',
    defaultValue: 'ca-app-pub-3940256099942544/1712485313', // Google test ID
  );

  /// AdMob App ID for Android (used in AndroidManifest.xml).
  static const String admobAndroidAppId = String.fromEnvironment(
    'ADMOB_ANDROID_APP_ID',
    defaultValue: 'ca-app-pub-3940256099942544~3347511713', // Google test App ID
  );

  /// AdMob App ID for iOS (used in Info.plist).
  static const String admobIosAppId = String.fromEnvironment(
    'ADMOB_IOS_APP_ID',
    defaultValue: 'ca-app-pub-3940256099942544~1458002511', // Google test App ID
  );

  // ─────────────────────────────────────────────
  // VPN Reward Constants
  // ─────────────────────────────────────────────

  /// Time reward (in seconds) granted after watching a rewarded ad.
  ///
  /// Default: 2 hours = 7200 seconds.
  static const int rewardDurationSeconds = 7200;

  /// Human-readable reward duration string for UI display.
  static const String rewardDurationDisplay = '2 Hours';

  /// Maximum accumulated time balance allowed (in seconds).
  ///
  /// Default: 24 hours = 86400 seconds.
  static const int maxTimeBalanceSeconds = 86400;

  /// Warning threshold (in seconds) — UI turns yellow below this.
  static const int warningThresholdSeconds = 1800; // 30 minutes

  /// Critical threshold (in seconds) — UI turns red below this.
  static const int criticalThresholdSeconds = 600; // 10 minutes

  /// Pulse animation threshold (in seconds) — pulse starts below this.
  static const int pulseThresholdSeconds = 300; // 5 minutes

  /// Interval for syncing time balance with the server.
  static const Duration syncInterval = Duration(minutes: 5);

  // ─────────────────────────────────────────────
  // Ad Retry Configuration
  // ─────────────────────────────────────────────

  /// Maximum number of times to retry loading a failed ad.
  static const int maxAdRetryAttempts = 3;

  /// Base delay between ad retry attempts (uses exponential backoff).
  static const Duration adRetryBaseDelay = Duration(seconds: 2);

  // ─────────────────────────────────────────────
  // Feature Flags
  // ─────────────────────────────────────────────

  /// Whether to enable detailed logging for debugging.
  static const bool enableDebugLogging = bool.fromEnvironment(
    'ENABLE_DEBUG_LOGGING',
    defaultValue: true,
  );

  /// Whether ads are enabled (can be disabled for testing).
  static const bool enableAds = bool.fromEnvironment(
    'ENABLE_ADS',
    defaultValue: true,
  );
}
