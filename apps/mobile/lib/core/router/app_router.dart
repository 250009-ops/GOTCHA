import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gotcha_app/core/auth/auth_provider.dart';
import 'package:gotcha_app/features/auth/forgot_password_screen.dart';
import 'package:gotcha_app/features/auth/login_screen.dart';
import 'package:gotcha_app/features/auth/register_screen.dart';
import 'package:gotcha_app/features/auth/reset_password_screen.dart';
import 'package:gotcha_app/features/onboarding/onboarding_screen.dart';
import 'package:gotcha_app/features/onboarding/splash_screen.dart';
import 'package:gotcha_app/features/reader/reader_screen.dart';
import 'package:gotcha_app/features/shell/app_shell.dart';

final appRouterProvider = Provider<RouterConfig<Object>>((ref) {
  final auth = ref.watch(authStateProvider);
  return RouterConfig(
    routerDelegate: _GotchaRouterDelegate(ref: ref, auth: auth),
    routeInformationParser: const _GotchaRouteParser(),
  );
});

class _GotchaRouteParser extends RouteInformationParser<String> {
  const _GotchaRouteParser();
  @override
  Future<String> parseRouteInformation(RouteInformation routeInformation) async =>
      routeInformation.uri.path.isEmpty ? '/' : routeInformation.uri.path;

  @override
  RouteInformation restoreRouteInformation(String configuration) =>
      RouteInformation(uri: Uri.parse(configuration));
}

class _GotchaRouterDelegate extends RouterDelegate<String>
    with ChangeNotifier, PopNavigatorRouterDelegateMixin<String> {
  _GotchaRouterDelegate({required this.ref, required this.auth}) {
    ref.listen<AuthState>(authStateProvider, (_, __) => notifyListeners());
  }

  final Ref ref;
  AuthState auth;

  @override
  final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  String _path = '/';
  String? _readerContentId;
  String? _resetToken;

  @override
  String get currentConfiguration {
    if (_readerContentId != null) return '/reader/$_readerContentId';
    if (_path == '/reset-password' && _resetToken != null) {
      return '/reset-password?token=$_resetToken';
    }
    return _path;
  }

  @override
  Widget build(BuildContext context) {
    if (auth.loading) return const MaterialApp(home: SplashScreen());

    return Navigator(
      key: navigatorKey,
      pages: _buildPages(),
      onPopPage: (route, result) {
        if (!route.didPop(result)) return false;
        if (_readerContentId != null) {
          _readerContentId = null;
          notifyListeners();
        } else if (_path != '/') {
          _path = '/login';
          _resetToken = null;
          notifyListeners();
        }
        return true;
      },
    );
  }

  List<Page<void>> _buildPages() {
    if (_readerContentId != null) {
      return [
        MaterialPage(
          child: ReaderScreen(
            contentId: _readerContentId!,
            onClose: () {
              _readerContentId = null;
              notifyListeners();
            },
          ),
        ),
      ];
    }

    if (!auth.isAuthenticated) {
      Widget child;
      if (_path == '/register') {
        child = RegisterScreen(onNavigateLogin: () => _go('/login'));
      } else if (_path == '/onboarding') {
        child = OnboardingScreen(onDone: () => _go('/register'));
      } else if (_path == '/forgot-password') {
        child = ForgotPasswordScreen(onNavigateLogin: () => _go('/login'));
      } else if (_path == '/reset-password') {
        child = ResetPasswordScreen(
          token: _resetToken ?? '',
          onNavigateLogin: () => _go('/login'),
          onNavigateForgot: () => _go('/forgot-password'),
        );
      } else {
        child = LoginScreen(
          onNavigateRegister: () => _go('/register'),
          onNavigateOnboarding: () => _go('/onboarding'),
          onNavigateForgotPassword: () => _go('/forgot-password'),
        );
      }
      return [MaterialPage(child: child)];
    }

    return [
      MaterialPage(
        child: AppShell(
          onOpenReader: (id) {
            _readerContentId = id;
            notifyListeners();
          },
          onLogout: () => ref.read(authStateProvider.notifier).logout(),
        ),
      ),
    ];
  }

  void _go(String path) {
    _path = path;
    if (path != '/reset-password') _resetToken = null;
    notifyListeners();
  }

  @override
  Future<void> setNewRoutePath(String configuration) async {
    if (configuration.startsWith('/reader/')) {
      _readerContentId = configuration.split('/').last;
      return;
    }
    final uri = Uri.tryParse(configuration);
    if (uri != null && uri.path == '/reset-password') {
      _path = '/reset-password';
      _resetToken = uri.queryParameters['token'];
      return;
    }
    _path = configuration;
    _resetToken = null;
  }
}
