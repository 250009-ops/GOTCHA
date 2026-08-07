import 'package:flutter/material.dart';
import 'package:gotcha_app/core/theme/gotcha_theme.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.gotchaColors;
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [colors.brandPrimary, colors.brandAccent],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Gotcha', style: TextStyle(color: Colors.white, fontSize: 42, fontWeight: FontWeight.w800)),
              SizedBox(height: 12),
              CircularProgressIndicator(color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }
}
