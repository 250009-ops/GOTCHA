import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gotcha_app/core/network/api_client.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(apiClientProvider));
});

class AuthState {
  const AuthState({this.user, this.loading = true, this.error});
  final Map<String, dynamic>? user;
  final bool loading;
  final String? error;

  bool get isAuthenticated => user != null;
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._api) : super(const AuthState()) {
    bootstrap();
  }

  final ApiClient _api;

  Future<void> bootstrap() async {
    try {
      final token = await _api.accessToken;
      if (token == null) {
        state = const AuthState(loading: false);
        return;
      }
      final user = await _api.get('/users/me');
      state = AuthState(user: user, loading: false);
    } catch (_) {
      await _api.clearTokens();
      state = const AuthState(loading: false);
    }
  }

  Future<void> login(String email, String password) async {
    state = const AuthState(loading: true);
    try {
      final res = await _api.post('/auth/login', {'email': email, 'password': password});
      await _api.saveTokens(res['accessToken'], res['refreshToken']);
      state = AuthState(user: res['user'] as Map<String, dynamic>, loading: false);
    } catch (e) {
      state = AuthState(loading: false, error: e.toString());
    }
  }

  Future<void> register({
    required String email,
    required String password,
    required String nativeLanguage,
    required List<String> targetLanguages,
  }) async {
    state = const AuthState(loading: true);
    try {
      final res = await _api.post('/auth/register', {
        'email': email,
        'password': password,
        'nativeLanguage': nativeLanguage,
        'targetLanguages': targetLanguages,
      });
      await _api.saveTokens(res['accessToken'], res['refreshToken']);
      state = AuthState(user: res['user'] as Map<String, dynamic>, loading: false);
    } catch (e) {
      state = AuthState(loading: false, error: e.toString());
    }
  }

  Future<void> logout() async {
    await _api.clearTokens();
    state = const AuthState(loading: false);
  }
}
