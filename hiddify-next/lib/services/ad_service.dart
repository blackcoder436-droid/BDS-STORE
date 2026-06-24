/// BDS STORE VPN - AdMob Rewarded Video Integration Service
///
/// Manages the full lifecycle of rewarded video ads:
///   1. Loading ads with configurable retry logic
///   2. Showing ads to users
///   3. Handling reward callbacks
///   4. Verifying rewards with the backend API
///
/// Dependencies:
///   - `google_mobile_ads: ^5.1.0` (add to pubspec.yaml)
///   - `api_service.dart` for backend reward verification
///
/// Setup required:
///   - Android: Add AdMob App ID to AndroidManifest.xml
///   - iOS: Add AdMob App ID to Info.plist
///   - See: https://developers.google.com/admob/flutter/quick-start
///
/// Integration with Hiddify-Next:
///   TODO: Initialize this service in Hiddify's main app initialization.
///   TODO: Ensure google_mobile_ads is added to Hiddify's pubspec.yaml.
library;

import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../config/app_config.dart';
import 'api_service.dart';

/// Possible states of the ad service.
enum AdStatus {
  /// Initial state — no ad has been requested yet.
  initial,

  /// An ad is currently being loaded from the network.
  loading,

  /// An ad is loaded and ready to be shown.
  loaded,

  /// An ad is currently being displayed to the user.
  showing,

  /// The ad failed to load or show.
  error,

  /// The ad was shown and the user earned a reward.
  rewarded,
}

/// Callback signature for reward events.
///
/// [timeAdded] is the number of seconds added to the user's balance.
typedef OnRewardEarned = void Function(int timeAdded);

/// Callback signature for ad status changes.
typedef OnAdStatusChanged = void Function(AdStatus status);

/// Singleton service managing AdMob rewarded video ads.
///
/// Usage:
/// ```dart
/// final adService = AdService.instance;
///
/// // Initialize (call once at app startup)
/// await adService.initialize();
///
/// // Load an ad
/// await adService.loadAd();
///
/// // Show the ad when the user taps "Get Free 2 Hours"
/// adService.showAd(
///   onRewardEarned: (seconds) {
///     print('User earned $seconds seconds!');
///   },
/// );
/// ```
class AdService {
  // ── Singleton ──
  static final AdService _instance = AdService._internal();

  /// Global singleton instance.
  static AdService get instance => _instance;

  AdService._internal();

  // ── State ──

  /// Currently loaded rewarded ad (null if not loaded).
  RewardedAd? _rewardedAd;

  /// Current status of the ad service.
  AdStatus _status = AdStatus.initial;

  /// Number of consecutive load failures (for retry backoff).
  int _retryAttempt = 0;

  /// Whether the MobileAds SDK has been initialized.
  bool _isInitialized = false;

  /// Timer for retry delays.
  Timer? _retryTimer;

  /// Callback invoked when the ad status changes.
  OnAdStatusChanged? onStatusChanged;

  /// Last error message for debugging.
  String? _lastError;

  // ── Public Getters ──

  /// Current ad status.
  AdStatus get status => _status;

  /// Whether a rewarded ad is loaded and ready to show.
  bool get isAdReady => _status == AdStatus.loaded && _rewardedAd != null;

  /// Whether an ad is currently loading.
  bool get isLoading => _status == AdStatus.loading;

  /// Whether an ad is currently being shown.
  bool get isShowing => _status == AdStatus.showing;

  /// Last error message (null if no error).
  String? get lastError => _lastError;

  /// Returns the appropriate Ad Unit ID for the current platform.
  String get _adUnitId {
    if (Platform.isAndroid) {
      return AppConfig.admobAndroidRewardedId;
    } else if (Platform.isIOS) {
      return AppConfig.admobIosRewardedId;
    }
    // Fallback to Android test ID for unsupported platforms
    return AppConfig.admobAndroidRewardedId;
  }

  // ─────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────

  /// Initializes the Mobile Ads SDK.
  ///
  /// Must be called once before any ad operations, typically in `main()`:
  /// ```dart
  /// void main() async {
  ///   WidgetsFlutterBinding.ensureInitialized();
  ///   await AdService.instance.initialize();
  ///   runApp(MyApp());
  /// }
  /// ```
  ///
  /// TODO: Call this during Hiddify-Next's app initialization sequence.
  Future<void> initialize() async {
    if (_isInitialized) return;

    if (!AppConfig.enableAds) {
      _log('Ads are disabled via config');
      return;
    }

    try {
      _log('Initializing Mobile Ads SDK...');
      await MobileAds.instance.initialize();
      _isInitialized = true;
      _log('Mobile Ads SDK initialized successfully');

      // Pre-load the first ad
      await loadAd();
    } catch (e) {
      _log('Failed to initialize Mobile Ads SDK: $e');
      _updateStatus(AdStatus.error);
      _lastError = 'SDK initialization failed: $e';
    }
  }

  // ─────────────────────────────────────────────
  // Ad Loading
  // ─────────────────────────────────────────────

  /// Loads a rewarded video ad.
  ///
  /// If loading fails, automatically retries with exponential backoff
  /// up to [AppConfig.maxAdRetryAttempts] times.
  ///
  /// Does nothing if:
  ///   - Ads are disabled
  ///   - SDK is not initialized
  ///   - An ad is already loaded or loading
  Future<void> loadAd() async {
    if (!AppConfig.enableAds || !_isInitialized) return;
    if (_status == AdStatus.loading || _status == AdStatus.loaded) return;

    _updateStatus(AdStatus.loading);
    _lastError = null;

    _log('Loading rewarded ad (attempt ${_retryAttempt + 1})...');

    await RewardedAd.load(
      adUnitId: _adUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: _onAdLoaded,
        onAdFailedToLoad: _onAdFailedToLoad,
      ),
    );
  }

  /// Called when the ad loads successfully.
  void _onAdLoaded(RewardedAd ad) {
    _log('Rewarded ad loaded successfully');
    _rewardedAd = ad;
    _retryAttempt = 0; // Reset retry counter on success
    _updateStatus(AdStatus.loaded);
  }

  /// Called when the ad fails to load.
  void _onAdFailedToLoad(LoadAdError error) {
    _log('Rewarded ad failed to load: ${error.message} '
        '(code: ${error.code}, domain: ${error.domain})');

    _rewardedAd = null;
    _lastError = error.message;

    _retryAttempt++;

    if (_retryAttempt <= AppConfig.maxAdRetryAttempts) {
      // Exponential backoff: 2s, 4s, 8s...
      final delay = AppConfig.adRetryBaseDelay * (1 << (_retryAttempt - 1));
      _log('Retrying in ${delay.inSeconds}s (attempt $_retryAttempt/'
          '${AppConfig.maxAdRetryAttempts})');

      _updateStatus(AdStatus.error);
      _retryTimer?.cancel();
      _retryTimer = Timer(delay, loadAd);
    } else {
      _log('Max retry attempts reached. Ad loading failed.');
      _updateStatus(AdStatus.error);
      _retryAttempt = 0; // Reset for next manual attempt
    }
  }

  // ─────────────────────────────────────────────
  // Ad Display
  // ─────────────────────────────────────────────

  /// Shows the loaded rewarded video ad.
  ///
  /// [onRewardEarned] is called when the user earns a reward
  /// (watches the full ad). The callback receives the number of seconds
  /// added to their time balance.
  ///
  /// [onAdDismissed] is called when the ad is closed (whether or not
  /// the reward was earned).
  ///
  /// [onError] is called if the ad cannot be shown.
  ///
  /// Returns `true` if the ad was shown, `false` if no ad was available.
  bool showAd({
    OnRewardEarned? onRewardEarned,
    VoidCallback? onAdDismissed,
    void Function(String error)? onError,
  }) {
    if (_rewardedAd == null) {
      _log('Cannot show ad: no ad loaded');
      onError?.call('No ad available. Please try again.');

      // Auto-reload for next attempt
      loadAd();
      return false;
    }

    _updateStatus(AdStatus.showing);
    _log('Showing rewarded ad...');

    // Set up full-screen content callbacks
    _rewardedAd!.fullScreenContentCallback = FullScreenContentCallback(
      onAdShowedFullScreenContent: (ad) {
        _log('Ad displayed in full screen');
      },
      onAdDismissedFullScreenContent: (ad) {
        _log('Ad dismissed');
        ad.dispose();
        _rewardedAd = null;
        _updateStatus(AdStatus.initial);

        onAdDismissed?.call();

        // Pre-load next ad
        loadAd();
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        _log('Ad failed to show: ${error.message}');
        ad.dispose();
        _rewardedAd = null;
        _lastError = error.message;
        _updateStatus(AdStatus.error);

        onError?.call('Failed to show ad: ${error.message}');

        // Try to load another ad
        loadAd();
      },
    );

    // Show the ad with reward callback
    _rewardedAd!.show(
      onUserEarnedReward: (ad, reward) {
        _log('User earned reward: ${reward.amount} ${reward.type}');
        _updateStatus(AdStatus.rewarded);

        // Verify reward with backend and notify caller
        _verifyAndNotifyReward(
          rewardType: reward.type,
          rewardAmount: reward.amount.toInt(),
          onRewardEarned: onRewardEarned,
        );
      },
    );

    return true;
  }

  /// Verifies the earned reward with the backend API.
  ///
  /// On success, calls [onRewardEarned] with the credited time.
  /// On failure, still calls [onRewardEarned] with the default reward
  /// duration (optimistic) and logs the error.
  Future<void> _verifyAndNotifyReward({
    required String rewardType,
    required int rewardAmount,
    OnRewardEarned? onRewardEarned,
  }) async {
    try {
      final updatedBalance = await ApiService.instance.verifyAdReward(
        rewardType: rewardType,
        rewardAmount: rewardAmount,
      );

      _log('Reward verified. New balance: $updatedBalance seconds');
      onRewardEarned?.call(AppConfig.rewardDurationSeconds);
    } catch (e) {
      _log('Reward verification failed: $e');
      // Optimistically grant the reward even if verification fails.
      // The server will reconcile on next sync.
      // TODO: Queue failed verifications for retry.
      onRewardEarned?.call(AppConfig.rewardDurationSeconds);
    }
  }

  // ─────────────────────────────────────────────
  // Manual Retry
  // ─────────────────────────────────────────────

  /// Manually triggers an ad reload.
  ///
  /// Resets the retry counter and attempts to load a new ad.
  /// Useful for "Try Again" buttons in the UI.
  Future<void> retryLoadAd() async {
    _retryAttempt = 0;
    _retryTimer?.cancel();
    _rewardedAd?.dispose();
    _rewardedAd = null;
    _updateStatus(AdStatus.initial);
    await loadAd();
  }

  // ─────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────

  /// Disposes all resources held by the ad service.
  ///
  /// Call this when the app is shutting down or ad functionality
  /// is no longer needed.
  void dispose() {
    _retryTimer?.cancel();
    _rewardedAd?.dispose();
    _rewardedAd = null;
    _updateStatus(AdStatus.initial);
    _log('AdService disposed');
  }

  // ─────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────

  /// Updates the ad status and notifies listeners.
  void _updateStatus(AdStatus newStatus) {
    _status = newStatus;
    onStatusChanged?.call(newStatus);
  }

  /// Logs a message in debug mode.
  void _log(String message) {
    if (AppConfig.enableDebugLogging) {
      debugPrint('[AdService] $message');
    }
  }
}
