/// BDS STORE VPN - Add Time Button Widget
///
/// A beautiful gradient button that allows users to earn free VPN time
/// by watching a rewarded video ad. Features:
///   - Gradient background with ad/play icon
///   - Loading spinner while ad is being fetched
///   - Disabled state when no ad is available
///   - Success animation/feedback after earning reward
///   - Integrates with [AdService] and [TimeBalanceProvider]
///
/// Usage:
/// ```dart
/// const AddTimeButton()
/// ```
///
/// Integration with Hiddify-Next:
///   TODO: Place this widget on Hiddify's home screen or settings page.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../config/app_config.dart';
import '../services/ad_service.dart';
import '../services/time_balance_provider.dart';

/// A styled button that triggers a rewarded video ad to earn free VPN time.
///
/// The button shows contextual states:
/// - **Ready**: Gradient button with "Get Free 2 Hours" text
/// - **Loading**: Spinner while the ad loads
/// - **Showing**: Disabled while the ad plays
/// - **Success**: Brief checkmark animation after earning reward
/// - **Error**: "Try Again" state with retry functionality
class AddTimeButton extends StatefulWidget {
  /// Optional callback invoked after time is successfully added.
  final VoidCallback? onTimeAdded;

  /// Whether to use a compact layout (icon-only).
  final bool compact;

  /// Creates an [AddTimeButton].
  const AddTimeButton({
    super.key,
    this.onTimeAdded,
    this.compact = false,
  });

  @override
  State<AddTimeButton> createState() => _AddTimeButtonState();
}

class _AddTimeButtonState extends State<AddTimeButton>
    with SingleTickerProviderStateMixin {
  /// Animation controller for the success checkmark.
  late final AnimationController _successController;
  late final Animation<double> _successScale;

  /// Local state tracking the ad lifecycle for this button.
  _ButtonState _buttonState = _ButtonState.ready;

  /// The ad service instance.
  final AdService _adService = AdService.instance;

  @override
  void initState() {
    super.initState();

    _successController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _successScale = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _successController, curve: Curves.elasticOut),
    );

    // Listen to ad status changes
    _adService.onStatusChanged = _onAdStatusChanged;

    // Set initial state based on current ad status
    _updateButtonStateFromAdStatus();
  }

  @override
  void dispose() {
    _successController.dispose();
    super.dispose();
  }

  /// Updates button state based on ad service status changes.
  void _onAdStatusChanged(AdStatus status) {
    if (!mounted) return;
    _updateButtonStateFromAdStatus();
  }

  /// Maps [AdStatus] to [_ButtonState].
  void _updateButtonStateFromAdStatus() {
    setState(() {
      switch (_adService.status) {
        case AdStatus.initial:
        case AdStatus.error:
          _buttonState = _ButtonState.ready; // Will reload when tapped
        case AdStatus.loading:
          _buttonState = _ButtonState.loading;
        case AdStatus.loaded:
          _buttonState = _ButtonState.ready;
        case AdStatus.showing:
          _buttonState = _ButtonState.showing;
        case AdStatus.rewarded:
          _buttonState = _ButtonState.success;
      }
    });
  }

  /// Handles the button tap — loads or shows the ad.
  Future<void> _onPressed() async {
    if (_buttonState == _ButtonState.loading ||
        _buttonState == _ButtonState.showing) {
      return; // Ignore taps while busy
    }

    // Haptic feedback
    HapticFeedback.mediumImpact();

    if (!_adService.isAdReady) {
      // Need to load the ad first
      setState(() => _buttonState = _ButtonState.loading);
      await _adService.retryLoadAd();

      // Wait a moment for the ad to load
      if (!_adService.isAdReady) {
        if (mounted) {
          _showSnackBar('Loading ad... Please try again in a moment.');
        }
        return;
      }
    }

    // Show the ad
    final timeProvider = context.read<TimeBalanceProvider>();

    _adService.showAd(
      onRewardEarned: (secondsAdded) {
        // Add time to the balance
        timeProvider.addTime(secondsAdded);

        // Show success state
        if (mounted) {
          setState(() => _buttonState = _ButtonState.success);
          _successController.forward(from: 0);

          _showSnackBar(
            '🎉 +${AppConfig.rewardDurationDisplay} added!',
            isSuccess: true,
          );

          // Reset to ready state after animation
          Future.delayed(const Duration(seconds: 2), () {
            if (mounted) {
              setState(() => _buttonState = _ButtonState.ready);
            }
          });
        }

        widget.onTimeAdded?.call();
      },
      onAdDismissed: () {
        if (mounted) {
          setState(() => _buttonState = _ButtonState.ready);
        }
      },
      onError: (error) {
        if (mounted) {
          _showSnackBar(error);
          setState(() => _buttonState = _ButtonState.ready);
        }
      },
    );
  }

  /// Shows a themed snack bar message.
  void _showSnackBar(String message, {bool isSuccess = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor:
            isSuccess ? const Color(0xFF10B981) : const Color(0xFF374151),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
        duration: Duration(seconds: isSuccess ? 3 : 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.compact) {
      return _buildCompactButton();
    }
    return _buildFullButton();
  }

  /// Builds the full-width gradient button.
  Widget _buildFullButton() {
    final isDisabled = _buttonState == _ButtonState.loading ||
        _buttonState == _ButtonState.showing;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      width: double.infinity,
      height: 56,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: isDisabled
            ? LinearGradient(
                colors: [
                  Colors.grey.shade700,
                  Colors.grey.shade800,
                ],
              )
            : _buttonState == _ButtonState.success
                ? const LinearGradient(
                    colors: [Color(0xFF10B981), Color(0xFF059669)],
                  )
                : const LinearGradient(
                    colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
        boxShadow: isDisabled
            ? null
            : [
                BoxShadow(
                  color: _buttonState == _ButtonState.success
                      ? const Color(0xFF10B981).withValues(alpha: 0.4)
                      : const Color(0xFF6366F1).withValues(alpha: 0.4),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isDisabled ? null : _onPressed,
          borderRadius: BorderRadius.circular(16),
          child: Center(
            child: _buildButtonContent(),
          ),
        ),
      ),
    );
  }

  /// Builds the compact icon button variant.
  Widget _buildCompactButton() {
    return IconButton.filled(
      onPressed: _buttonState == _ButtonState.loading ||
              _buttonState == _ButtonState.showing
          ? null
          : _onPressed,
      icon: _buttonState == _ButtonState.loading
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : const Icon(Icons.play_circle_outline),
      tooltip: 'Get Free ${AppConfig.rewardDurationDisplay}',
      style: IconButton.styleFrom(
        backgroundColor: const Color(0xFF6366F1),
      ),
    );
  }

  /// Builds the inner content of the full button based on state.
  Widget _buildButtonContent() {
    switch (_buttonState) {
      case _ButtonState.loading:
        return const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: Colors.white,
              ),
            ),
            SizedBox(width: 12),
            Text(
              'Loading Ad...',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        );

      case _ButtonState.showing:
        return const Text(
          'Watching Ad...',
          style: TextStyle(
            color: Colors.white70,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        );

      case _ButtonState.success:
        return AnimatedBuilder(
          animation: _successScale,
          builder: (context, _) {
            return Transform.scale(
              scale: _successScale.value,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle, color: Colors.white, size: 24),
                  const SizedBox(width: 8),
                  Text(
                    '+${AppConfig.rewardDurationDisplay} Added!',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            );
          },
        );

      case _ButtonState.ready:
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child:
                  const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 12),
            Text(
              'Get Free ${AppConfig.rewardDurationDisplay}',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(width: 8),
            Icon(
              Icons.arrow_forward_rounded,
              color: Colors.white.withValues(alpha: 0.7),
              size: 18,
            ),
          ],
        );
    }
  }
}

/// Internal button state enum.
enum _ButtonState {
  ready,
  loading,
  showing,
  success,
}
