/// BDS STORE VPN - Time Balance State Management Provider
///
/// Manages the user's VPN time balance using the Provider (ChangeNotifier)
/// pattern. Provides:
///   - Real-time countdown when VPN is connected
///   - Time formatting utilities
///   - Server synchronization
///   - Auto-disconnect when time expires
///
/// Dependencies:
///   - `provider: ^6.1.0` (add to pubspec.yaml)
///   - `api_service.dart` for server sync
///
/// Usage with Provider:
/// ```dart
/// ChangeNotifierProvider(
///   create: (_) => TimeBalanceProvider(),
///   child: MyApp(),
/// )
/// ```
///
/// Integration with Hiddify-Next:
///   TODO: Register this provider in Hiddify's dependency injection system.
///   TODO: Connect [onTimeExpired] to Hiddify's VPN disconnect mechanism.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import 'api_service.dart';

/// State management provider for VPN time balance.
///
/// This provider tracks the remaining VPN usage time, counts down
/// every second while the VPN is connected, and notifies the UI
/// of changes for real-time display.
///
/// Example:
/// ```dart
/// // In a widget
/// final timeProvider = context.watch<TimeBalanceProvider>();
/// Text(timeProvider.formattedTime); // "01:45:30"
///
/// // Start countdown when VPN connects
/// timeProvider.startCountdown();
///
/// // Stop when VPN disconnects
/// timeProvider.stopCountdown();
///
/// // Add time after watching an ad
/// timeProvider.addTime(7200); // +2 hours
/// ```
class TimeBalanceProvider extends ChangeNotifier {
  // ── State ──

  /// Remaining time balance in seconds.
  int _remainingSeconds = 0;

  /// Whether the countdown is currently active (VPN is connected).
  bool _isCountingDown = false;

  /// The periodic timer that decrements every second.
  Timer? _countdownTimer;

  /// Timer for periodic server sync.
  Timer? _syncTimer;

  /// Whether a server sync is in progress.
  bool _isSyncing = false;

  /// Last sync timestamp.
  DateTime? _lastSyncTime;

  /// Callback invoked when the time balance reaches zero.
  ///
  /// Use this to trigger VPN disconnection:
  /// ```dart
  /// timeProvider.onTimeExpired = () {
  ///   // TODO: Call Hiddify's disconnect method
  ///   vpnService.disconnect();
  /// };
  /// ```
  VoidCallback? onTimeExpired;

  // ── Public Getters ──

  /// Remaining time balance in seconds.
  int get remainingSeconds => _remainingSeconds;

  /// Whether the countdown is currently active.
  bool get isCountingDown => _isCountingDown;

  /// Whether a server sync is in progress.
  bool get isSyncing => _isSyncing;

  /// Whether the user has any remaining time.
  bool get hasTimeRemaining => _remainingSeconds > 0;

  /// Whether time is at the warning level (< 30 minutes).
  bool get isWarning =>
      _remainingSeconds > 0 &&
      _remainingSeconds <= AppConfig.warningThresholdSeconds;

  /// Whether time is at the critical level (< 10 minutes).
  bool get isCritical =>
      _remainingSeconds > 0 &&
      _remainingSeconds <= AppConfig.criticalThresholdSeconds;

  /// Whether the pulse animation should be active (< 5 minutes).
  bool get shouldPulse =>
      _remainingSeconds > 0 &&
      _remainingSeconds <= AppConfig.pulseThresholdSeconds;

  /// Progress value (0.0 to 1.0) for circular progress indicators.
  ///
  /// Based on [AppConfig.maxTimeBalanceSeconds] as the maximum.
  double get progress {
    if (_remainingSeconds <= 0) return 0.0;
    return (_remainingSeconds / AppConfig.maxTimeBalanceSeconds).clamp(0.0, 1.0);
  }

  /// Remaining hours component.
  int get hours => _remainingSeconds ~/ 3600;

  /// Remaining minutes component (0–59).
  int get minutes => (_remainingSeconds % 3600) ~/ 60;

  /// Remaining seconds component (0–59).
  int get seconds => _remainingSeconds % 60;

  /// Formatted time string as `HH:MM:SS`.
  String get formattedTime {
    return '${hours.toString().padLeft(2, '0')}:'
        '${minutes.toString().padLeft(2, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }

  /// Human-readable time remaining (e.g., "1h 45m", "5m 30s").
  String get humanReadableTime {
    if (_remainingSeconds <= 0) return 'No time remaining';
    if (hours > 0) return '${hours}h ${minutes}m';
    if (minutes > 0) return '${minutes}m ${seconds}s';
    return '${seconds}s';
  }

  // ─────────────────────────────────────────────
  // Time Balance Management
  // ─────────────────────────────────────────────

  /// Sets the time balance to an absolute value.
  ///
  /// Used when receiving the balance from the server.
  void setTimeBalance(int seconds) {
    _remainingSeconds = seconds.clamp(0, AppConfig.maxTimeBalanceSeconds);
    _log('Time balance set to $_remainingSeconds seconds ($formattedTime)');
    notifyListeners();
  }

  /// Adds time to the current balance.
  ///
  /// Typically called after the user watches a rewarded ad.
  /// Capped at [AppConfig.maxTimeBalanceSeconds].
  ///
  /// Returns the actual seconds added (may be less if capped).
  int addTime(int seconds) {
    final before = _remainingSeconds;
    _remainingSeconds =
        (_remainingSeconds + seconds).clamp(0, AppConfig.maxTimeBalanceSeconds);
    final actuallyAdded = _remainingSeconds - before;

    _log('Added $actuallyAdded seconds (requested $seconds). '
        'Balance: $formattedTime');
    notifyListeners();
    return actuallyAdded;
  }

  /// Subtracts time from the current balance.
  ///
  /// Used internally by the countdown timer. Clamps at zero.
  void _subtractTime(int seconds) {
    _remainingSeconds = (_remainingSeconds - seconds).clamp(0, 999999);
    notifyListeners();

    if (_remainingSeconds <= 0) {
      _log('Time expired!');
      stopCountdown();
      onTimeExpired?.call();
    }
  }

  // ─────────────────────────────────────────────
  // Countdown Timer
  // ─────────────────────────────────────────────

  /// Starts the countdown timer.
  ///
  /// Decrements [remainingSeconds] by 1 every second.
  /// Also starts periodic server sync.
  ///
  /// Does nothing if:
  ///   - Already counting down
  ///   - No time remaining
  ///
  /// TODO: Call this when Hiddify reports VPN connected state.
  void startCountdown() {
    if (_isCountingDown) {
      _log('Countdown already running');
      return;
    }

    if (_remainingSeconds <= 0) {
      _log('Cannot start countdown: no time remaining');
      return;
    }

    _isCountingDown = true;
    _log('Countdown started. Time remaining: $formattedTime');

    // Decrement every second
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _subtractTime(1);
    });

    // Sync with server periodically
    _startSyncTimer();

    notifyListeners();
  }

  /// Stops the countdown timer.
  ///
  /// Preserves the current time balance. Also stops server sync.
  ///
  /// TODO: Call this when Hiddify reports VPN disconnected state.
  void stopCountdown() {
    if (!_isCountingDown) return;

    _countdownTimer?.cancel();
    _countdownTimer = null;
    _syncTimer?.cancel();
    _syncTimer = null;
    _isCountingDown = false;

    _log('Countdown stopped. Time remaining: $formattedTime');
    notifyListeners();
  }

  /// Pauses the countdown temporarily (e.g., app goes to background).
  ///
  /// The countdown can be resumed by calling [startCountdown] again.
  void pauseCountdown() {
    if (!_isCountingDown) return;
    _countdownTimer?.cancel();
    _countdownTimer = null;
    _log('Countdown paused at $formattedTime');
    // Don't change _isCountingDown — let startCountdown handle resume
    _isCountingDown = false;
    notifyListeners();
  }

  // ─────────────────────────────────────────────
  // Server Synchronization
  // ─────────────────────────────────────────────

  /// Syncs the time balance with the server.
  ///
  /// Fetches the latest balance from the backend and updates locally.
  /// This corrects any drift between local countdown and server-side tracking.
  Future<void> syncWithServer() async {
    if (_isSyncing) return;

    _isSyncing = true;
    notifyListeners();

    try {
      _log('Syncing time balance with server...');

      final status = await ApiService.instance.getVpnStatus();
      final serverBalance =
          status['time_balance'] as int? ?? status['timeBalance'] as int?;

      if (serverBalance != null) {
        final drift = (_remainingSeconds - serverBalance).abs();

        if (drift > 10) {
          // Only update if drift is significant (> 10 seconds)
          _log('Correcting drift of ${drift}s. '
              'Local: $_remainingSeconds, Server: $serverBalance');
          _remainingSeconds =
              serverBalance.clamp(0, AppConfig.maxTimeBalanceSeconds);
        } else {
          _log('Time balance in sync (drift: ${drift}s)');
        }
      }

      _lastSyncTime = DateTime.now();
    } catch (e) {
      _log('Server sync failed: $e');
      // Don't disrupt the local countdown on sync failure
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  /// Starts the periodic server sync timer.
  void _startSyncTimer() {
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(AppConfig.syncInterval, (_) {
      syncWithServer();
    });
  }

  /// Last time the balance was synced with the server.
  DateTime? get lastSyncTime => _lastSyncTime;

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────

  /// Initializes the provider by fetching the latest balance from the server.
  Future<void> initialize() async {
    try {
      final profile = await ApiService.instance.getProfile();
      setTimeBalance(profile.timeBalance);
      _log('Initialized with ${profile.timeBalance}s from server');
    } catch (e) {
      _log('Failed to initialize time balance: $e');
    }
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _syncTimer?.cancel();
    _countdownTimer = null;
    _syncTimer = null;
    _log('TimeBalanceProvider disposed');
    super.dispose();
  }

  // ─────────────────────────────────────────────
  // Logging
  // ─────────────────────────────────────────────

  /// Logs a message in debug mode.
  void _log(String message) {
    if (AppConfig.enableDebugLogging) {
      debugPrint('[TimeBalance] $message');
    }
  }
}
