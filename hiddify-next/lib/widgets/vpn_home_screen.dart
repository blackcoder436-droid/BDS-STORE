/// BDS STORE VPN - Main VPN Home Screen
///
/// The primary screen of the BDS STORE VPN app featuring a "One-Tap Connect"
/// design. Layout:
///   - Top: Server location display & settings
///   - Center: Large circular connect/disconnect button with status
///   - Below center: Countdown timer display
///   - Bottom: "Get Free 2 Hours" button
///
/// Features:
///   - Animated connection state transitions
///   - Dark theme with gradient accents
///   - Material Design 3 styling
///   - Responsive layout
///
/// Integration with Hiddify-Next:
///   TODO: Replace the VPN connect/disconnect logic with Hiddify's
///   VPN core service calls. The UI can be used as-is or adapted
///   into Hiddify's existing navigation structure.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../config/app_config.dart';
import '../services/time_balance_provider.dart';
import 'add_time_button.dart';
import 'countdown_timer_widget.dart';

/// VPN connection state.
enum VpnConnectionState {
  /// Not connected to any VPN server.
  disconnected,

  /// Currently establishing a VPN connection.
  connecting,

  /// Connected to a VPN server.
  connected,

  /// Currently disconnecting from the VPN server.
  disconnecting,
}

/// Main VPN home screen with one-tap connect design.
///
/// This screen is designed to be the primary interface for users.
/// It provides a large, prominent connect button, real-time countdown,
/// and easy access to earning more time via rewarded ads.
class VpnHomeScreen extends StatefulWidget {
  const VpnHomeScreen({super.key});

  @override
  State<VpnHomeScreen> createState() => _VpnHomeScreenState();
}

class _VpnHomeScreenState extends State<VpnHomeScreen>
    with TickerProviderStateMixin {
  /// Current VPN connection state.
  VpnConnectionState _connectionState = VpnConnectionState.disconnected;

  /// Selected server name for display.
  String _selectedServer = 'Auto Select';

  /// Selected server country code.
  String _selectedCountry = '🌍';

  /// Animation controller for the connect button ring.
  late final AnimationController _ringController;
  late final Animation<double> _ringRotation;

  /// Animation controller for the connection pulse.
  late final AnimationController _connectPulseController;
  late final Animation<double> _connectPulseScale;

  @override
  void initState() {
    super.initState();

    // Ring rotation animation (spins while connecting)
    _ringController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    );
    _ringRotation =
        Tween<double>(begin: 0, end: 2 * math.pi).animate(_ringController);

    // Pulse animation for connected state
    _connectPulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _connectPulseScale = Tween<double>(begin: 1.0, end: 1.3).animate(
      CurvedAnimation(
          parent: _connectPulseController, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _ringController.dispose();
    _connectPulseController.dispose();
    super.dispose();
  }

  /// Returns the primary color based on connection state.
  Color get _stateColor {
    switch (_connectionState) {
      case VpnConnectionState.disconnected:
        return const Color(0xFF6B7280); // Gray
      case VpnConnectionState.connecting:
      case VpnConnectionState.disconnecting:
        return const Color(0xFFF59E0B); // Amber
      case VpnConnectionState.connected:
        return const Color(0xFF10B981); // Emerald
    }
  }

  /// Returns the status text for the current connection state.
  String get _statusText {
    switch (_connectionState) {
      case VpnConnectionState.disconnected:
        return 'Tap to Connect';
      case VpnConnectionState.connecting:
        return 'Connecting...';
      case VpnConnectionState.connected:
        return 'Connected';
      case VpnConnectionState.disconnecting:
        return 'Disconnecting...';
    }
  }

  /// Returns the icon for the connect button.
  IconData get _connectIcon {
    switch (_connectionState) {
      case VpnConnectionState.disconnected:
        return Icons.power_settings_new_rounded;
      case VpnConnectionState.connecting:
      case VpnConnectionState.disconnecting:
        return Icons.sync_rounded;
      case VpnConnectionState.connected:
        return Icons.shield_rounded;
    }
  }

  /// Handles the connect/disconnect button tap.
  Future<void> _onConnectTap() async {
    HapticFeedback.heavyImpact();

    final timeProvider = context.read<TimeBalanceProvider>();

    switch (_connectionState) {
      case VpnConnectionState.disconnected:
        if (!timeProvider.hasTimeRemaining) {
          _showNoTimeDialog();
          return;
        }
        await _connect(timeProvider);

      case VpnConnectionState.connected:
        await _disconnect(timeProvider);

      case VpnConnectionState.connecting:
      case VpnConnectionState.disconnecting:
        break; // Ignore taps during transition
    }
  }

  /// Initiates a VPN connection.
  Future<void> _connect(TimeBalanceProvider timeProvider) async {
    setState(() => _connectionState = VpnConnectionState.connecting);
    _ringController.repeat();

    // TODO: Replace with actual Hiddify VPN connect call:
    // await hiddifyVpnService.connect(configLink);

    // Simulate connection delay
    await Future.delayed(const Duration(seconds: 2));

    if (!mounted) return;

    setState(() => _connectionState = VpnConnectionState.connected);
    _ringController.stop();
    _ringController.reset();
    _connectPulseController.repeat(reverse: true);

    // Start the countdown timer
    timeProvider.startCountdown();
  }

  /// Disconnects the VPN.
  Future<void> _disconnect(TimeBalanceProvider timeProvider) async {
    setState(() => _connectionState = VpnConnectionState.disconnecting);
    _connectPulseController.stop();
    _connectPulseController.reset();
    _ringController.repeat();

    // TODO: Replace with actual Hiddify VPN disconnect call:
    // await hiddifyVpnService.disconnect();

    // Simulate disconnection delay
    await Future.delayed(const Duration(seconds: 1));

    if (!mounted) return;

    setState(() => _connectionState = VpnConnectionState.disconnected);
    _ringController.stop();
    _ringController.reset();

    // Stop the countdown timer
    timeProvider.stopCountdown();
  }

  /// Shows a dialog when user tries to connect with no time balance.
  void _showNoTimeDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1F2937),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.access_time_rounded, color: Color(0xFFF59E0B)),
            SizedBox(width: 8),
            Text('No Time Remaining',
                style: TextStyle(color: Colors.white, fontSize: 18)),
          ],
        ),
        content: const Text(
          'Watch a short video ad to get free VPN time and start connecting!',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Later', style: TextStyle(color: Colors.white54)),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              // Scroll to or focus the Add Time button
            },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF6366F1),
            ),
            child: const Text('Watch Ad'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Dark navy background
      body: SafeArea(
        child: Column(
          children: [
            // ── Top Bar ──
            _buildTopBar(),

            // ── Main Content ──
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(
                    children: [
                      const SizedBox(height: 20),

                      // Server selector
                      _buildServerSelector(),

                      const SizedBox(height: 40),

                      // Connect button
                      _buildConnectButton(),

                      const SizedBox(height: 16),

                      // Status text
                      _buildStatusText(),

                      const SizedBox(height: 40),

                      // Countdown timer
                      const CountdownTimerWidget(size: 180),

                      const SizedBox(height: 40),

                      // Add time button
                      const AddTimeButton(),

                      const SizedBox(height: 24),

                      // Connection stats
                      if (_connectionState == VpnConnectionState.connected)
                        _buildConnectionStats(),

                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Builds the top app bar with branding and settings.
  Widget _buildTopBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          // App logo / branding
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF6366F1).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.shield_rounded,
              color: Color(0xFF6366F1),
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                AppConfig.appName,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
              Text(
                'Secure & Free VPN',
                style: TextStyle(
                  color: Colors.white38,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const Spacer(),

          // Settings button
          // TODO: Navigate to Hiddify's settings or a custom settings page
          IconButton(
            onPressed: () {
              // TODO: Implement settings navigation
            },
            icon: const Icon(
              Icons.settings_rounded,
              color: Colors.white54,
            ),
          ),
        ],
      ),
    );
  }

  /// Builds the server location selector.
  Widget _buildServerSelector() {
    return GestureDetector(
      onTap: () {
        // TODO: Show server selection dialog/sheet
        // Consider integrating with Hiddify's server list
        HapticFeedback.lightImpact();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.08),
          ),
        ),
        child: Row(
          children: [
            Text(
              _selectedCountry,
              style: const TextStyle(fontSize: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'SERVER',
                    style: TextStyle(
                      color: Colors.white38,
                      fontSize: 10,
                      letterSpacing: 2,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _selectedServer,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: Colors.white.withValues(alpha: 0.4),
            ),
          ],
        ),
      ),
    );
  }

  /// Builds the large circular connect/disconnect button.
  Widget _buildConnectButton() {
    final size = MediaQuery.of(context).size.width * 0.42;

    return GestureDetector(
      onTap: _onConnectTap,
      child: SizedBox(
        width: size + 30,
        height: size + 30,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Pulse ring (connected state)
            if (_connectionState == VpnConnectionState.connected)
              AnimatedBuilder(
                animation: _connectPulseScale,
                builder: (context, _) {
                  return Container(
                    width: size * _connectPulseScale.value,
                    height: size * _connectPulseScale.value,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: _stateColor.withValues(
                            alpha: 0.3 * (1 - (_connectPulseScale.value - 1) / 0.3)),
                        width: 2,
                      ),
                    ),
                  );
                },
              ),

            // Rotating ring (connecting/disconnecting)
            if (_connectionState == VpnConnectionState.connecting ||
                _connectionState == VpnConnectionState.disconnecting)
              AnimatedBuilder(
                animation: _ringRotation,
                builder: (context, child) {
                  return Transform.rotate(
                    angle: _ringRotation.value,
                    child: Container(
                      width: size + 16,
                      height: size + 16,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.transparent,
                          width: 3,
                        ),
                      ),
                      child: CustomPaint(
                        painter: _DashedCirclePainter(
                          color: _stateColor,
                          strokeWidth: 3,
                          dashCount: 30,
                        ),
                      ),
                    ),
                  );
                },
              ),

            // Main button circle
            AnimatedContainer(
              duration: const Duration(milliseconds: 400),
              curve: Curves.easeInOut,
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    _stateColor.withValues(alpha: 0.25),
                    _stateColor.withValues(alpha: 0.08),
                  ],
                ),
                border: Border.all(
                  color: _stateColor.withValues(alpha: 0.5),
                  width: 3,
                ),
                boxShadow: [
                  BoxShadow(
                    color: _stateColor.withValues(alpha: 0.3),
                    blurRadius: 30,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    child: Icon(
                      _connectIcon,
                      key: ValueKey(_connectIcon),
                      color: _stateColor,
                      size: size * 0.3,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Builds the connection status text below the button.
  Widget _buildStatusText() {
    return Column(
      children: [
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: Text(
            _statusText,
            key: ValueKey(_statusText),
            style: TextStyle(
              color: _stateColor,
              fontSize: 18,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
        ),
        const SizedBox(height: 4),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: Text(
            _connectionState == VpnConnectionState.connected
                ? 'Your traffic is encrypted'
                : 'Your connection is not secure',
            key: ValueKey(_connectionState),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.4),
              fontSize: 13,
            ),
          ),
        ),
      ],
    );
  }

  /// Builds connection statistics shown when connected.
  Widget _buildConnectionStats() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.06),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildStatItem(
            icon: Icons.arrow_downward_rounded,
            label: 'Download',
            value: '0 KB/s',
            color: const Color(0xFF3B82F6),
          ),
          Container(
            width: 1,
            height: 40,
            color: Colors.white.withValues(alpha: 0.1),
          ),
          _buildStatItem(
            icon: Icons.arrow_upward_rounded,
            label: 'Upload',
            value: '0 KB/s',
            color: const Color(0xFF8B5CF6),
          ),
          Container(
            width: 1,
            height: 40,
            color: Colors.white.withValues(alpha: 0.1),
          ),
          _buildStatItem(
            icon: Icons.timer_outlined,
            label: 'Duration',
            value: '00:00',
            color: const Color(0xFF10B981),
          ),
        ],
      ),
    );
  }

  /// Builds a single connection stat item.
  Widget _buildStatItem({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Column(
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(height: 6),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.4),
            fontSize: 11,
          ),
        ),
      ],
    );
  }
}

/// Custom painter for a dashed circle (used during connecting state).
class _DashedCirclePainter extends CustomPainter {
  final Color color;
  final double strokeWidth;
  final int dashCount;

  _DashedCirclePainter({
    required this.color,
    required this.strokeWidth,
    required this.dashCount,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    final dashAngle = (2 * math.pi) / dashCount;
    final gapAngle = dashAngle * 0.4;

    for (int i = 0; i < dashCount; i++) {
      final startAngle = i * dashAngle;
      final sweepAngle = dashAngle - gapAngle;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        sweepAngle,
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _DashedCirclePainter oldDelegate) {
    return oldDelegate.color != color || oldDelegate.dashCount != dashCount;
  }
}
