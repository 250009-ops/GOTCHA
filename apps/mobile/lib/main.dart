import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gotcha_app/core/router/app_router.dart';
import 'package:gotcha_app/core/theme/gotcha_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: GotchaApp()));
}

class GotchaApp extends ConsumerWidget {
  const GotchaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'Gotcha',
      debugShowCheckedModeBanner: false,
      theme: GotchaTheme.light,
      darkTheme: GotchaTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}
