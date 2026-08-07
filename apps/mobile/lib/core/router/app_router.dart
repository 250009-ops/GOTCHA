import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gotcha_app/core/auth/auth_provider.dart';
import 'package:gotcha_app/features/auth/login_screen.dart';
import 'package:gotcha_app/features/auth/register_screen.dart';
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

  @override
  String get currentConfiguration => _readerContentId != null ? '/reader/$_readerContentId' : _path;

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
          _path = '/';
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
      return [
        MaterialPage(
          child: _path == '/register'
              ? RegisterScreen(onNavigateLogin: () => _go('/login'))
              : _path == '/onboarding'
                  ? OnboardingScreen(onDone: () => _go('/register'))
                  : LoginScreen(
                      onNavigateRegister: () => _go('/register'),
                      onNavigateOnboarding: () => _go('/onboarding'),
                    ),
        ),
      ];
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
    notifyListeners();
  }

  @override
  Future<void> setNewRoutePath(String configuration) async {
    if (configuration.startsWith('/reader/')) {
      _readerContentId = configuration.split('/').last;
    } else {
      _path = configuration;
    }
  }
}
