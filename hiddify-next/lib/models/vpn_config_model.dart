/// BDS STORE VPN - VPN Configuration Data Model
///
/// Represents a VPN server configuration received from the backend.
/// Supports multiple protocols: VLESS, VMess, Trojan, and Shadowsocks.
///
/// Integration with Hiddify-Next:
///   TODO: Map this model's [configLink] to Hiddify's subscription/profile
///   import mechanism. Hiddify uses subscription links to parse configs.
library;

/// Supported VPN protocols.
///
/// Each protocol has different characteristics:
/// - [vless] — Lightweight, modern protocol with minimal overhead.
/// - [vmess] — V2Ray's original protocol with built-in encryption.
/// - [trojan] — Mimics HTTPS traffic for stealth.
/// - [shadowsocks] — Lightweight encrypted proxy protocol.
enum VpnProtocol {
  vless('VLESS'),
  vmess('VMess'),
  trojan('Trojan'),
  shadowsocks('Shadowsocks');

  /// Human-readable display name for the protocol.
  final String displayName;

  const VpnProtocol(this.displayName);

  /// Parses a protocol string (case-insensitive) into a [VpnProtocol].
  ///
  /// Returns [VpnProtocol.vless] as default if the string is unrecognized.
  static VpnProtocol fromString(String? value) {
    if (value == null) return VpnProtocol.vless;
    switch (value.toLowerCase()) {
      case 'vless':
        return VpnProtocol.vless;
      case 'vmess':
        return VpnProtocol.vmess;
      case 'trojan':
        return VpnProtocol.trojan;
      case 'shadowsocks':
      case 'ss':
        return VpnProtocol.shadowsocks;
      default:
        return VpnProtocol.vless;
    }
  }
}

/// Immutable data model representing a VPN server configuration.
///
/// Example JSON from backend:
/// ```json
/// {
///   "id": "cfg_abc123",
///   "protocol": "vless",
///   "config_link": "vless://uuid@server:443?security=tls...",
///   "subscription_url": "https://sub.bdsstore.com/user/abc123",
///   "server_address": "us1.bdsstore.com",
///   "port": 443,
///   "server_name": "US East 1",
///   "country_code": "US",
///   "is_premium": false,
///   "load_percentage": 45
/// }
/// ```
class VpnConfigModel {
  /// Unique configuration identifier.
  final String id;

  /// VPN protocol type.
  final VpnProtocol protocol;

  /// Full configuration link (e.g., `vless://...`, `vmess://...`).
  ///
  /// This link can be imported directly into Hiddify-Next as a profile.
  /// TODO: Use Hiddify's profile import API to add this config.
  final String configLink;

  /// Subscription URL for auto-updating configurations.
  ///
  /// Hiddify-Next supports subscription URLs natively.
  /// TODO: Register this URL as a Hiddify subscription source.
  final String? subscriptionUrl;

  /// Server hostname or IP address.
  final String serverAddress;

  /// Server port number.
  final int port;

  /// Human-readable server name for display.
  final String serverName;

  /// ISO 3166-1 alpha-2 country code (e.g., "US", "DE", "JP").
  final String countryCode;

  /// Whether this is a premium server (may require higher tier).
  final bool isPremium;

  /// Current server load as a percentage (0–100).
  ///
  /// Used to display server health and recommend optimal servers.
  final int loadPercentage;

  /// Creates a new [VpnConfigModel] instance.
  const VpnConfigModel({
    required this.id,
    required this.protocol,
    required this.configLink,
    this.subscriptionUrl,
    required this.serverAddress,
    required this.port,
    this.serverName = 'Unknown Server',
    this.countryCode = 'UN',
    this.isPremium = false,
    this.loadPercentage = 0,
  });

  /// Creates a [VpnConfigModel] from a JSON map.
  ///
  /// Handles both snake_case (backend) and camelCase field names.
  factory VpnConfigModel.fromJson(Map<String, dynamic> json) {
    return VpnConfigModel(
      id: json['id']?.toString() ?? '',
      protocol: VpnProtocol.fromString(json['protocol'] as String?),
      configLink:
          json['config_link'] as String? ?? json['configLink'] as String? ?? '',
      subscriptionUrl: json['subscription_url'] as String? ??
          json['subscriptionUrl'] as String?,
      serverAddress: json['server_address'] as String? ??
          json['serverAddress'] as String? ??
          '',
      port: _parseInt(json['port']),
      serverName: json['server_name'] as String? ??
          json['serverName'] as String? ??
          'Unknown Server',
      countryCode: json['country_code'] as String? ??
          json['countryCode'] as String? ??
          'UN',
      isPremium: json['is_premium'] as bool? ??
          json['isPremium'] as bool? ??
          false,
      loadPercentage:
          _parseInt(json['load_percentage'] ?? json['loadPercentage']),
    );
  }

  /// Converts this model to a JSON map using snake_case keys.
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'protocol': protocol.name,
      'config_link': configLink,
      if (subscriptionUrl != null) 'subscription_url': subscriptionUrl,
      'server_address': serverAddress,
      'port': port,
      'server_name': serverName,
      'country_code': countryCode,
      'is_premium': isPremium,
      'load_percentage': loadPercentage,
    };
  }

  /// Creates a copy of this model with the given fields replaced.
  VpnConfigModel copyWith({
    String? id,
    VpnProtocol? protocol,
    String? configLink,
    String? subscriptionUrl,
    String? serverAddress,
    int? port,
    String? serverName,
    String? countryCode,
    bool? isPremium,
    int? loadPercentage,
  }) {
    return VpnConfigModel(
      id: id ?? this.id,
      protocol: protocol ?? this.protocol,
      configLink: configLink ?? this.configLink,
      subscriptionUrl: subscriptionUrl ?? this.subscriptionUrl,
      serverAddress: serverAddress ?? this.serverAddress,
      port: port ?? this.port,
      serverName: serverName ?? this.serverName,
      countryCode: countryCode ?? this.countryCode,
      isPremium: isPremium ?? this.isPremium,
      loadPercentage: loadPercentage ?? this.loadPercentage,
    );
  }

  /// Returns the full server address with port (e.g., "us1.bdsstore.com:443").
  String get fullAddress => '$serverAddress:$port';

  /// Whether the server has low load (< 50%).
  bool get isLowLoad => loadPercentage < 50;

  /// Whether the server has medium load (50–80%).
  bool get isMediumLoad => loadPercentage >= 50 && loadPercentage < 80;

  /// Whether the server has high load (≥ 80%).
  bool get isHighLoad => loadPercentage >= 80;

  /// Returns a color-coded load status string.
  String get loadStatus {
    if (isLowLoad) return 'Low';
    if (isMediumLoad) return 'Medium';
    return 'High';
  }

  /// Creates an empty/placeholder config.
  factory VpnConfigModel.empty() {
    return const VpnConfigModel(
      id: '',
      protocol: VpnProtocol.vless,
      configLink: '',
      serverAddress: '',
      port: 0,
    );
  }

  /// Whether this config is valid and usable.
  bool get isValid => id.isNotEmpty && configLink.isNotEmpty && port > 0;

  /// Whether this is an empty placeholder.
  bool get isEmpty => id.isEmpty;

  /// Safely parses an integer from a dynamic value.
  static int _parseInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is double) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  @override
  String toString() {
    return 'VpnConfigModel(id: $id, protocol: ${protocol.displayName}, '
        'server: $fullAddress, name: $serverName, load: $loadPercentage%)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is VpnConfigModel &&
        other.id == id &&
        other.configLink == configLink;
  }

  @override
  int get hashCode => Object.hash(id, configLink);
}
