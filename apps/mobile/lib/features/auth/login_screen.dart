import 'package:flutter/material.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:gotcha_app/core/auth/auth_provider.dart';

import 'package:gotcha_app/core/theme/gotcha_theme.dart';



class LoginScreen extends ConsumerStatefulWidget {

  const LoginScreen({
    super.key,
    required this.onNavigateRegister,
    required this.onNavigateOnboarding,
    required this.onNavigateForgotPassword,
  });

  final VoidCallback onNavigateRegister;

  final VoidCallback onNavigateOnboarding;

  final VoidCallback onNavigateForgotPassword;



  @override

  ConsumerState<LoginScreen> createState() => _LoginScreenState();

}



class _LoginScreenState extends ConsumerState<LoginScreen> {

  final _email = TextEditingController(text: 'learner@gotcha.app');

  final _password = TextEditingController(text: 'Learner2026!');

  bool _obscure = true;



  @override

  Widget build(BuildContext context) {

    final auth = ref.watch(authStateProvider);

    final colors = context.gotchaColors;



    return Scaffold(

      body: Column(

        children: [

          Container(

            width: double.infinity,

            padding: EdgeInsets.fromLTRB(24, MediaQuery.paddingOf(context).top + 32, 24, 32),

            decoration: const BoxDecoration(

              gradient: LinearGradient(

                begin: Alignment.topLeft,

                end: Alignment.bottomRight,

                colors: [Color(0xFF6D28D9), Color(0xFF3730A3), Color(0xFF5B21B6)],

              ),

            ),

            child: Column(

              crossAxisAlignment: CrossAxisAlignment.start,

              children: [

                Row(

                  children: [

                    Container(

                      width: 40,

                      height: 40,

                      decoration: BoxDecoration(

                        color: Colors.white.withValues(alpha: 0.2),

                        borderRadius: BorderRadius.circular(12),

                      ),

                      child: const Icon(Icons.menu_book_rounded, color: Colors.white, size: 22),

                    ),

                    const SizedBox(width: 12),

                    const Text('Gotcha', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),

                  ],

                ),

                const SizedBox(height: 24),

                const Text(

                  'Read your way\nto fluency.',

                  style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800, height: 1.15),

                ),

                const SizedBox(height: 8),

                Text(

                  'The reading-first language app.',

                  style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 15),

                ),

              ],

            ),

          ),

          Expanded(

            child: SingleChildScrollView(

              padding: const EdgeInsets.all(24),

              child: Column(

                crossAxisAlignment: CrossAxisAlignment.stretch,

                children: [

                  Text('Welcome back', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),

                  const SizedBox(height: 4),

                  Text('Sign in to continue your reading journey.', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey)),

                  const SizedBox(height: 24),

                  TextField(

                    controller: _email,

                    keyboardType: TextInputType.emailAddress,

                    decoration: InputDecoration(

                      labelText: 'Email',

                      filled: true,

                      fillColor: const Color(0xFFF9FAFB),

                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE5E7EB))),

                    ),

                  ),

                  const SizedBox(height: 12),

                  TextField(

                    controller: _password,

                    obscureText: _obscure,

                    decoration: InputDecoration(

                      labelText: 'Password',

                      filled: true,

                      fillColor: const Color(0xFFF9FAFB),

                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),

                      suffixIcon: IconButton(

                        icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined),

                        onPressed: () => setState(() => _obscure = !_obscure),

                      ),

                    ),

                  ),

                  if (auth.error != null) ...[

                    const SizedBox(height: 12),

                    Text(auth.error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),

                  ],

                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: widget.onNavigateForgotPassword,
                      child: const Text(
                        'Forgot password?',
                        style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF7F22FE), fontSize: 13),
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),

                  FilledButton(

                    style: FilledButton.styleFrom(

                      backgroundColor: colors.brandPrimary,

                      minimumSize: const Size.fromHeight(48),

                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),

                    ),

                    onPressed: auth.loading

                        ? null

                        : () => ref.read(authStateProvider.notifier).login(_email.text.trim(), _password.text),

                    child: auth.loading

                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))

                        : const Text('Sign in', style: TextStyle(fontWeight: FontWeight.w700)),

                  ),

                  const SizedBox(height: 8),

                  TextButton(onPressed: widget.onNavigateRegister, child: const Text('Sign up free')),

                  TextButton(onPressed: widget.onNavigateOnboarding, child: const Text('See how Gotcha works')),

                ],

              ),

            ),

          ),

        ],

      ),

    );

  }

}


