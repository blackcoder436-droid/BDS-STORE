/// BDS STORE VPN - Countdown Timer Widget
///
/// A beautiful circular countdown timer display that shows the remaining
/// VPN time balance. Features:
///   - Circular arc progress indicator
///   - Digital time display (HH:MM:SS) centered inside the arc
///   - Color-coded status: green (>30m), yellow (10-30m), red (<10m)
///   - Pulse animation when time is critically low (<5m)
///   - Responsive sizing
///
/// Consumes [TimeBalanceProvider] via Provider.
///
/// Usage:
/// ```dart
/// const CountdownTimerWidget(size: 200)
/// ```
///
/// Integration with Hiddify-Next:
///   TODO: Place this widget in Hiddify's home screen layout.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/app_config.dart';
import '../services/time_balance_provider.dart';

/// A circular countdown timer widget displaying remaining VPN time.
///
/// The timer visually represents the remaining time as a circular arc
/// with a digital readout in the center. Colors and animations adapt
/// based on the remaining time thresholds defined in [AppConfig].
class CountdownTimerWidget extends StatefulWidget {
  /// Diameter of the circular timer in logical pixels.
  final double size;

  /// Stroke width of the progress arc.
  final double strokeWidth;

  /// Whether to show the label text below the time.
  final bool showLabel;

  /// Creates a [CountdownTimerWidget].
  const CountdownTimerWidget({
    super.key,
    this.size = 200.0,
    this.strokeWidth = 10.0,
    this.showLabel = true,
  });

  @override
  State<CountdownTimerWidget> createState() => _CountdownTimerWidgetState();
}

class _CountdownTimerWidgetState extends State<CountdownTimerWidget>
    with SingleTickerProviderStateMixin {
  /// Animation controller for the pulse effect.
  late final AnimationController _pulseController;

  /// Scale animation for the pulsing effect.
  late final Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();

    // Pulse animation: subtle scale between 1.0 and 1.05
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  /// Returns the appropriate color based on remaining time.
  Color _getTimerColor(TimeBalanceProvider provider) {
    if (!provider.hasTimeRemaining) {
      return Colors.grey.shade600;
    }
    if (provider.isCritical) {
      return const Color(0xFFEF4444); // Red
    }
    if (provider.isWarning) {
      return const Color(0xFFF59E0B); // Amber/Yellow
    }
    return const Color(0xFF10B981); // Emerald Green
  }

  /// Returns a glow color matching the timer state.
  Color _getGlowColor(TimeBalanceProvider provider) {
    return _getTimerColor(provider).withValues(alpha: 0.3);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<TimeBalanceProvider>(
      builder: (context, provider, _) {
        // Manage pulse animation
        if (provider.shouldPulse && provider.isCountingDown) {
          if (!_pulseController.isAnimating) {
            _pulseController.repeat(reverse: true);
          }
        } else {
          if (_pulseController.isAnimating) {
            _pulseController.stop();
            _pulseController.reset();
          }
        }

        final timerColor = _getTimerColor(provider);
        final glowColor = _getGlowColor(provider);

        return AnimatedBuilder(
          animation: _pulseAnimation,
          builder: (context, child) {
            final scale =
                provider.shouldPulse ? _pulseAnimation.value : 1.0;

            return Transform.scale(
              scale: scale,
              child: SizedBox(
                width: widget.size,
                height: widget.size + (widget.showLabel ? 30 : 0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Circular timer
                    SizedBox(
                      width: widget.size,
                      height: widget.size,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          // Glow effect behind the arc
                          if (provider.hasTimeRemaining &&
                              provider.isCountingDown)
                            Container(
                              width: widget.size * 0.85,
                              height: widget.size * 0.85,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: glowColor,
                                    blurRadius: 20,
                                    spreadRadius: 2,
                                  ),
                                ],
                              ),
                            ),

                          // Background circle track
                          CustomPaint(
                            size: Size(widget.size, widget.size),
                            painter: _TimerArcPainter(
                              progress: 1.0,
                              color: Colors.white.withValues(alpha: 0.08),
                              strokeWidth: widget.strokeWidth,
                            ),
                          ),

                          // Progress arc
                          CustomPaint(
                            size: Size(widget.size, widget.size),
                            painter: _TimerArcPainter(
                              progress: provider.progress,
                              color: timerColor,
                              strokeWidth: widget.strokeWidth,
                              hasShadow: provider.isCountingDown,
                            ),
                          ),

                          // Center content
                          Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              // Time display
                              Text(
                                provider.formattedTime,
                                style: TextStyle(
                                  fontSize: widget.size * 0.16,
                                  fontWeight: FontWeight.w700,
                                  fontFamily: 'monospace',
                                  color: timerColor,
                                  letterSpacing: 2,
                                  shadows: provider.isCountingDown
                                      ? [
                                          Shadow(
                                            color:
                                                timerColor.withValues(alpha: 0.5),
                                            blurRadius: 10,
                                          ),
                                        ]
                                      : null,
                                ),
                              ),

                              const SizedBox(height: 4),

                              // Status text
                              Text(
                                provider.isCountingDown
                                    ? 'CONNECTED'
                                    : provider.hasTimeRemaining
                                        ? 'READY'
                                        : 'NO TIME',
                                style: TextStyle(
                                  fontSize: widget.size * 0.055,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.white.withValues(alpha: 0.6),
                                  letterSpacing: 3,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Label below timer
                    if (widget.showLabel) ...[
                      const SizedBox(height: 8),
                      Text(
                        provider.humanReadableTime,
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.white.withValues(alpha: 0.5),
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

/// Custom painter that draws an arc for the circular timer.
class _TimerArcPainter extends CustomPainter {
  /// Progress value from 0.0 (empty) to 1.0 (full).
  final double progress;

  /// Color of the arc.
  final Color color;

  /// Stroke width of the arc.
  final double strokeWidth;

  /// Whether to draw a shadow behind the arc.
  final bool hasShadow;

  _TimerArcPainter({
    required this.progress,
    required this.color,
    required this.strokeWidth,
    this.hasShadow = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    // Start from the top (-90 degrees)
    const startAngle = -math.pi / 2;
    final sweepAngle = 2 * math.pi * progress;

    // Shadow layer
    if (hasShadow && progress > 0) {
      final shadowPaint = Paint()
        ..color = color.withValues(alpha: 0.2)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth + 4
        ..strokeCap = StrokeCap.round
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        sweepAngle,
        false,
        shadowPaint,
      );
    }

    // Main arc
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweepAngle,
      false,
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant _TimerArcPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.color != color;
  }
}
