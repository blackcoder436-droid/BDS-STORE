/// BDS STORE VPN - User Data Model
///
/// Represents a user account in the BDS STORE VPN system.
/// Includes time balance tracking, ad watch history, and account status.
///
/// This model is used throughout the app for:
///   - Storing authenticated user data
///   - Displaying profile information
///   - Tracking time balance and reward history
library;

/// Immutable data model representing a BDS STORE VPN user.
///
/// Example JSON from backend:
/// ```json
/// {
///   "id": "usr_abc123",
///   "email": "user@example.com",
///   "username": "player1",
///   "time_balance": 7200,
///   "total_ads_watched": 15,
///   "is_active": true,
///   "created_at": "2026-01-15T10:30:00Z",
///   "last_login": "2026-06-24T14:00:00Z"
/// }
/// ```
class UserModel {
  /// Unique user identifier from the backend.
  final String id;

  /// User's email address (used for login).
  final String email;

  /// Display username.
  final String username;

  /// Remaining VPN time balance in seconds.
  ///
  /// This value is decremented locally every second while connected
  /// and periodically synced with the server.
  final int timeBalance;

  /// Total number of rewarded ads the user has watched.
  final int totalAdsWatched;

  /// Whether the user's account is active and permitted to connect.
  final bool isActive;

  /// Account creation timestamp (ISO 8601).
  final DateTime? createdAt;

  /// Last login timestamp (ISO 8601).
  final DateTime? lastLogin;

  /// Creates a new [UserModel] instance.
  const UserModel({
    required this.id,
    required this.email,
    required this.username,
    this.timeBalance = 0,
    this.totalAdsWatched = 0,
    this.isActive = true,
    this.createdAt,
    this.lastLogin,
  });

  /// Creates a [UserModel] from a JSON map.
  ///
  /// Handles both snake_case (backend) and camelCase field names.
  /// Returns a fully populated model with sensible defaults for missing fields.
  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      email: json['email'] as String? ?? '',
      username: json['username'] as String? ?? '',
      timeBalance: _parseInt(json['time_balance'] ?? json['timeBalance']),
      totalAdsWatched:
          _parseInt(json['total_ads_watched'] ?? json['totalAdsWatched']),
      isActive: json['is_active'] as bool? ??
          json['isActive'] as bool? ??
          true,
      createdAt: _parseDateTime(json['created_at'] ?? json['createdAt']),
      lastLogin: _parseDateTime(json['last_login'] ?? json['lastLogin']),
    );
  }

  /// Converts this model to a JSON map using snake_case keys.
  ///
  /// Suitable for sending to the backend API.
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'username': username,
      'time_balance': timeBalance,
      'total_ads_watched': totalAdsWatched,
      'is_active': isActive,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (lastLogin != null) 'last_login': lastLogin!.toIso8601String(),
    };
  }

  /// Creates a copy of this model with the given fields replaced.
  ///
  /// Useful for immutable state updates:
  /// ```dart
  /// final updated = user.copyWith(timeBalance: user.timeBalance + 7200);
  /// ```
  UserModel copyWith({
    String? id,
    String? email,
    String? username,
    int? timeBalance,
    int? totalAdsWatched,
    bool? isActive,
    DateTime? createdAt,
    DateTime? lastLogin,
  }) {
    return UserModel(
      id: id ?? this.id,
      email: email ?? this.email,
      username: username ?? this.username,
      timeBalance: timeBalance ?? this.timeBalance,
      totalAdsWatched: totalAdsWatched ?? this.totalAdsWatched,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      lastLogin: lastLogin ?? this.lastLogin,
    );
  }

  /// Whether the user has any remaining time balance.
  bool get hasTimeBalance => timeBalance > 0;

  /// Formatted time balance as `HH:MM:SS`.
  String get formattedTimeBalance {
    final hours = timeBalance ~/ 3600;
    final minutes = (timeBalance % 3600) ~/ 60;
    final seconds = timeBalance % 60;
    return '${hours.toString().padLeft(2, '0')}:'
        '${minutes.toString().padLeft(2, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }

  /// Creates an empty/guest user model.
  factory UserModel.empty() {
    return const UserModel(
      id: '',
      email: '',
      username: 'Guest',
    );
  }

  /// Whether this is an empty/guest user.
  bool get isEmpty => id.isEmpty;

  /// Whether this is an authenticated user (not empty).
  bool get isAuthenticated => id.isNotEmpty;

  // ─────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────

  /// Safely parses an integer from a dynamic value.
  static int _parseInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is double) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  /// Safely parses a [DateTime] from a dynamic value.
  static DateTime? _parseDateTime(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is String) return DateTime.tryParse(value);
    return null;
  }

  @override
  String toString() {
    return 'UserModel(id: $id, email: $email, username: $username, '
        'timeBalance: $formattedTimeBalance, adsWatched: $totalAdsWatched, '
        'active: $isActive)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is UserModel &&
        other.id == id &&
        other.email == email &&
        other.username == username &&
        other.timeBalance == timeBalance &&
        other.totalAdsWatched == totalAdsWatched &&
        other.isActive == isActive;
  }

  @override
  int get hashCode {
    return Object.hash(id, email, username, timeBalance, totalAdsWatched, isActive);
  }
}
