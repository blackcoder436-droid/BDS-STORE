/// BDS STORE VPN - Backend API HTTP Client
///
/// Provides a centralized HTTP client for all backend API communication.
/// Features:
///   - JWT token management with auto-attachment to requests
///   - Automatic token refresh on 401 Unauthorized responses
///   - Custom exception types for structured error handling
///   - Configurable timeouts and retry behavior
///   - Request/response logging in debug mode
///
/// Dependencies:
///   - `http` package (add to pubspec.yaml: `http: ^1.2.0`)
///   - `shared_preferences` package for token persistence
///
/// Integration with Hiddify-Next:
///   TODO: Consider using Hiddify's existing HTTP client if available,
///   or integrate this as a separate service layer alongside it.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/user_model.dart';
import '../models/vpn_config_model.dart';

// ─────────────────────────────────────────────
// Custom Exceptions
// ─────────────────────────────────────────────

/// Base exception for all API errors.
class ApiException implements Exception {
  /// HTTP status code (if applicable).
  final int? statusCode;

  /// Human-readable error message.
  final String message;

  /// Raw response body (if available).
  final String? responseBody;

  const ApiException({
    this.statusCode,
    required this.message,
    this.responseBody,
  });

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// Thrown when authentication fails (invalid credentials).
class AuthenticationException extends ApiException {
  const AuthenticationException({String message = 'Authentication failed'})
      : super(statusCode: 401, message: message);
}

/// Thrown when the JWT token has expired and refresh also failed.
class TokenExpiredException extends ApiException {
  const TokenExpiredException()
      : super(statusCode: 401, message: 'Session expired. Please login again.');
}

/// Thrown when the server returns a validation error.
class ValidationException extends ApiException {
  /// Field-level validation errors from the server.
  final Map<String, String> fieldErrors;

  const ValidationException({
    required this.fieldErrors,
    String message = 'Validation failed',
  }) : super(statusCode: 422, message: message);
}

/// Thrown when a network error occurs (no connectivity, DNS failure, etc.).
class NetworkException extends ApiException {
  const NetworkException({String message = 'Network error. Check your connection.'})
      : super(message: message);
}

/// Thrown when a request times out.
class TimeoutException extends ApiException {
  const TimeoutException({String message = 'Request timed out. Please try again.'})
      : super(message: message);
}

// ─────────────────────────────────────────────
// API Response Wrapper
// ─────────────────────────────────────────────

/// Wrapper for parsed API responses.
class ApiResponse<T> {
  /// Whether the request was successful.
  final bool success;

  /// Parsed data payload.
  final T? data;

  /// Message from the server (success or error).
  final String? message;

  /// HTTP status code.
  final int statusCode;

  const ApiResponse({
    required this.success,
    this.data,
    this.message,
    required this.statusCode,
  });
}

// ─────────────────────────────────────────────
// API Service (Singleton)
// ─────────────────────────────────────────────

/// Centralized HTTP client for the BDS STORE backend API.
///
/// Usage:
/// ```dart
/// final api = ApiService.instance;
/// api.configure(baseUrl: 'https://api.bdsstore.com');
///
/// // Login
/// final user = await api.login('user@example.com', 'password123');
///
/// // Get VPN config
/// final config = await api.getVpnConfig();
/// ```
class ApiService {
  // ── Singleton ──
  static final ApiService _instance = ApiService._internal();

  /// Global singleton instance.
  static ApiService get instance => _instance;

  ApiService._internal();

  // ── State ──

  /// Base URL for API requests.
  String _baseUrl = AppConfig.apiBasePath;

  /// JWT access token for authenticated requests.
  String? _accessToken;

  /// JWT refresh token for obtaining new access tokens.
  String? _refreshToken;

  /// Underlying HTTP client (injectable for testing).
  http.Client _httpClient = http.Client();

  /// Whether a token refresh is currently in progress.
  bool _isRefreshing = false;

  /// Completer used to queue requests while a token refresh is in progress.
  Completer<bool>? _refreshCompleter;

  /// Callback invoked when the session expires and user must re-login.
  ///
  /// TODO: Connect this to Hiddify's auth/navigation system.
  void Function()? onSessionExpired;

  // ── Configuration ──

  /// Configures the API service.
  ///
  /// Call this during app initialization:
  /// ```dart
  /// ApiService.instance.configure(
  ///   baseUrl: 'https://api.bdsstore.com/api/v1',
  ///   httpClient: mockClient, // optional, for testing
  /// );
  /// ```
  void configure({
    String? baseUrl,
    http.Client? httpClient,
    void Function()? onSessionExpired,
  }) {
    if (baseUrl != null) _baseUrl = baseUrl;
    if (httpClient != null) _httpClient = httpClient;
    if (onSessionExpired != null) this.onSessionExpired = onSessionExpired;
  }

  /// Sets the authentication tokens directly (e.g., from stored preferences).
  void setTokens({required String accessToken, String? refreshToken}) {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
  }

  /// Clears stored tokens (logout).
  void clearTokens() {
    _accessToken = null;
    _refreshToken = null;
  }

  /// Whether the user currently has a valid access token.
  bool get isAuthenticated => _accessToken != null && _accessToken!.isNotEmpty;

  // ─────────────────────────────────────────────
  // Authentication Endpoints
  // ─────────────────────────────────────────────

  /// Registers a new user account.
  ///
  /// Returns the created [UserModel] on success.
  /// Throws [ValidationException] if email is already taken.
  /// Throws [ApiException] on server errors.
  Future<UserModel> register({
    required String email,
    required String password,
    required String username,
  }) async {
    final response = await _post(
      AppConfig.registerEndpoint,
      body: {
        'email': email,
        'password': password,
        'username': username,
      },
      authenticated: false,
    );

    final data = _parseJsonResponse(response);
    _extractAndStoreTokens(data);

    return UserModel.fromJson(data['user'] as Map<String, dynamic>? ?? data);
  }

  /// Authenticates an existing user.
  ///
  /// Returns the [UserModel] on success.
  /// Throws [AuthenticationException] on invalid credentials.
  Future<UserModel> login({
    required String email,
    required String password,
  }) async {
    final response = await _post(
      AppConfig.loginEndpoint,
      body: {
        'email': email,
        'password': password,
      },
      authenticated: false,
    );

    final data = _parseJsonResponse(response);
    _extractAndStoreTokens(data);

    return UserModel.fromJson(data['user'] as Map<String, dynamic>? ?? data);
  }

  // ─────────────────────────────────────────────
  // User Profile Endpoints
  // ─────────────────────────────────────────────

  /// Fetches the authenticated user's profile.
  ///
  /// Returns the current [UserModel] including up-to-date time balance.
  Future<UserModel> getProfile() async {
    final response = await _get(AppConfig.profileEndpoint);
    final data = _parseJsonResponse(response);
    return UserModel.fromJson(data['user'] as Map<String, dynamic>? ?? data);
  }

  // ─────────────────────────────────────────────
  // VPN Endpoints
  // ─────────────────────────────────────────────

  /// Fetches the VPN configuration for the current user.
  ///
  /// Returns a [VpnConfigModel] containing the subscription link
  /// and server details.
  ///
  /// TODO: After receiving this config, pass [VpnConfigModel.configLink]
  /// or [VpnConfigModel.subscriptionUrl] to Hiddify's profile import.
  Future<VpnConfigModel> getVpnConfig() async {
    final response = await _get(AppConfig.vpnConfigEndpoint);
    final data = _parseJsonResponse(response);
    return VpnConfigModel.fromJson(
        data['config'] as Map<String, dynamic>? ?? data);
  }

  /// Reports a VPN connection event to the backend.
  ///
  /// The server starts tracking time usage upon receiving this call.
  /// TODO: Call this when Hiddify's VPN core reports a connected state.
  Future<void> reportConnect() async {
    await _post(AppConfig.vpnConnectEndpoint, body: {
      'connected_at': DateTime.now().toUtc().toIso8601String(),
    });
  }

  /// Reports a VPN disconnection event to the backend.
  ///
  /// The server stops tracking time usage and updates the balance.
  /// TODO: Call this when Hiddify's VPN core reports a disconnected state.
  Future<void> reportDisconnect() async {
    await _post(AppConfig.vpnDisconnectEndpoint, body: {
      'disconnected_at': DateTime.now().toUtc().toIso8601String(),
    });
  }

  /// Fetches the current VPN connection status and time balance from server.
  ///
  /// Used for syncing local time balance with server-side tracking.
  Future<Map<String, dynamic>> getVpnStatus() async {
    final response = await _get(AppConfig.vpnStatusEndpoint);
    return _parseJsonResponse(response);
  }

  // ─────────────────────────────────────────────
  // Reward / Ad Endpoints
  // ─────────────────────────────────────────────

  /// Verifies a completed rewarded ad view with the backend.
  ///
  /// Called after the user finishes watching a rewarded video ad.
  /// The server validates the reward and credits time to the user's balance.
  ///
  /// [rewardType] — the reward type string from AdMob callback.
  /// [rewardAmount] — the reward amount from AdMob callback.
  ///
  /// Returns the updated time balance in seconds.
  Future<int> verifyAdReward({
    required String rewardType,
    required int rewardAmount,
  }) async {
    final response = await _post(
      AppConfig.adVerifyEndpoint,
      body: {
        'reward_type': rewardType,
        'reward_amount': rewardAmount,
        'timestamp': DateTime.now().toUtc().toIso8601String(),
      },
    );

    final data = _parseJsonResponse(response);
    return data['time_balance'] as int? ?? data['timeBalance'] as int? ?? 0;
  }

  /// Fetches the current reward status (ads watched today, cooldowns, etc.).
  Future<Map<String, dynamic>> getRewardStatus() async {
    final response = await _get(AppConfig.rewardStatusEndpoint);
    return _parseJsonResponse(response);
  }

  // ─────────────────────────────────────────────
  // Private HTTP Methods
  // ─────────────────────────────────────────────

  /// Sends a GET request to the given [endpoint].
  Future<http.Response> _get(
    String endpoint, {
    bool authenticated = true,
    Map<String, String>? queryParams,
  }) async {
    final uri = _buildUri(endpoint, queryParams);
    final headers = _buildHeaders(authenticated: authenticated);

    _log('GET $uri');

    try {
      final response = await _httpClient
          .get(uri, headers: headers)
          .timeout(AppConfig.requestTimeout);

      return await _handleResponse(response, () => _get(
        endpoint,
        authenticated: authenticated,
        queryParams: queryParams,
      ));
    } on SocketException {
      throw const NetworkException();
    } on TimeoutException {
      throw const TimeoutException();
    }
  }

  /// Sends a POST request to the given [endpoint] with a JSON [body].
  Future<http.Response> _post(
    String endpoint, {
    Map<String, dynamic>? body,
    bool authenticated = true,
  }) async {
    final uri = _buildUri(endpoint);
    final headers = _buildHeaders(authenticated: authenticated);

    _log('POST $uri — body: ${body?.keys.join(', ')}');

    try {
      final response = await _httpClient
          .post(uri, headers: headers, body: jsonEncode(body))
          .timeout(AppConfig.requestTimeout);

      return await _handleResponse(response, () => _post(
        endpoint,
        body: body,
        authenticated: authenticated,
      ));
    } on SocketException {
      throw const NetworkException();
    } on TimeoutException {
      throw const TimeoutException();
    }
  }

  /// Builds a full [Uri] from the base URL and endpoint path.
  Uri _buildUri(String endpoint, [Map<String, String>? queryParams]) {
    final url = '$_baseUrl$endpoint';
    final uri = Uri.parse(url);
    if (queryParams != null && queryParams.isNotEmpty) {
      return uri.replace(queryParameters: queryParams);
    }
    return uri;
  }

  /// Builds HTTP headers with optional JWT authorization.
  Map<String, String> _buildHeaders({bool authenticated = true}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-App-Version': AppConfig.appVersion,
    };

    if (authenticated && _accessToken != null) {
      headers['Authorization'] = 'Bearer $_accessToken';
    }

    return headers;
  }

  /// Handles the HTTP response, including automatic 401 token refresh.
  Future<http.Response> _handleResponse(
    http.Response response,
    Future<http.Response> Function() retryRequest,
  ) async {
    _log('Response ${response.statusCode}: ${response.body.length} bytes');

    switch (response.statusCode) {
      case 200:
      case 201:
        return response;

      case 401:
        // Attempt token refresh
        final refreshed = await _tryRefreshToken();
        if (refreshed) {
          // Retry the original request with new token
          return retryRequest();
        }
        // Refresh failed — session expired
        clearTokens();
        onSessionExpired?.call();
        throw const TokenExpiredException();

      case 422:
        final data = _parseJsonResponse(response);
        final errors = <String, String>{};
        if (data['errors'] is Map) {
          (data['errors'] as Map).forEach((key, value) {
            errors[key.toString()] = value is List
                ? value.first.toString()
                : value.toString();
          });
        }
        throw ValidationException(
          fieldErrors: errors,
          message: data['message'] as String? ?? 'Validation failed',
        );

      case 403:
        throw ApiException(
          statusCode: 403,
          message: 'Access denied',
          responseBody: response.body,
        );

      case 404:
        throw ApiException(
          statusCode: 404,
          message: 'Resource not found',
          responseBody: response.body,
        );

      case 429:
        throw ApiException(
          statusCode: 429,
          message: 'Too many requests. Please slow down.',
          responseBody: response.body,
        );

      default:
        throw ApiException(
          statusCode: response.statusCode,
          message: 'Server error (${response.statusCode})',
          responseBody: response.body,
        );
    }
  }

  /// Attempts to refresh the access token using the stored refresh token.
  ///
  /// Returns `true` if the refresh was successful, `false` otherwise.
  /// Uses a [Completer] to prevent concurrent refresh requests.
  Future<bool> _tryRefreshToken() async {
    if (_refreshToken == null) return false;

    // If a refresh is already in progress, wait for it
    if (_isRefreshing) {
      return _refreshCompleter?.future ?? Future.value(false);
    }

    _isRefreshing = true;
    _refreshCompleter = Completer<bool>();

    try {
      _log('Refreshing access token...');

      final uri = _buildUri(AppConfig.refreshTokenEndpoint);
      final response = await _httpClient.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'refresh_token': _refreshToken}),
      ).timeout(AppConfig.requestTimeout);

      if (response.statusCode == 200) {
        final data = _parseJsonResponse(response);
        _extractAndStoreTokens(data);
        _log('Token refreshed successfully');
        _refreshCompleter!.complete(true);
        return true;
      } else {
        _log('Token refresh failed: ${response.statusCode}');
        _refreshCompleter!.complete(false);
        return false;
      }
    } catch (e) {
      _log('Token refresh error: $e');
      _refreshCompleter!.complete(false);
      return false;
    } finally {
      _isRefreshing = false;
    }
  }

  /// Extracts JWT tokens from an API response and stores them.
  void _extractAndStoreTokens(Map<String, dynamic> data) {
    _accessToken = data['access_token'] as String? ??
        data['accessToken'] as String? ??
        data['token'] as String?;

    _refreshToken = data['refresh_token'] as String? ??
        data['refreshToken'] as String? ??
        _refreshToken;

    // TODO: Persist tokens to SharedPreferences or secure storage.
    // Example:
    // final prefs = await SharedPreferences.getInstance();
    // await prefs.setString('access_token', _accessToken!);
    // await prefs.setString('refresh_token', _refreshToken!);
  }

  /// Parses a JSON response body into a Map.
  Map<String, dynamic> _parseJsonResponse(http.Response response) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) return decoded;
      return {'data': decoded};
    } catch (e) {
      throw ApiException(
        statusCode: response.statusCode,
        message: 'Invalid JSON response',
        responseBody: response.body,
      );
    }
  }

  /// Logs a message in debug mode.
  void _log(String message) {
    if (AppConfig.enableDebugLogging) {
      // ignore: avoid_print
      print('[ApiService] $message');
    }
  }

  /// Disposes the HTTP client and clears state.
  void dispose() {
    _httpClient.close();
    clearTokens();
  }
}
