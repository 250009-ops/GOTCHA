import 'package:flutter/material.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:gotcha_app/core/auth/auth_provider.dart';

import 'package:gotcha_app/core/theme/gotcha_theme.dart';



class RegisterScreen extends ConsumerStatefulWidget {

  const RegisterScreen({super.key, required this.onNavigateLogin});

  final VoidCallback onNavigateLogin;



  @override

  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();

}



class _RegisterScreenState extends ConsumerState<RegisterScreen> {

  final _email = TextEditingController();

  final _password = TextEditingController();

  String _native = 'en';

  final _targets = <String>{'ru'};



  InputDecoration _field(String label) => InputDecoration(

        labelText: label,

        filled: true,

        fillColor: const Color(0xFFF9FAFB),

        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),

      );



  @override

  Widget build(BuildContext context) {

    final auth = ref.watch(authStateProvider);

    final colors = context.gotchaColors;



    return Scaffold(

      body: Column(

        children: [

          Container(

            width: double.infinity,

            padding: EdgeInsets.fromLTRB(24, MediaQuery.paddingOf(context).top + 24, 24, 24),

            decoration: const BoxDecoration(

              gradient: LinearGradient(

                colors: [Color(0xFF6D28D9), Color(0xFF3730A3)],

              ),

            ),

            child: Column(

              crossAxisAlignment: CrossAxisAlignment.start,

              children: [

                IconButton(

                  onPressed: widget.onNavigateLogin,

                  icon: const Icon(Icons.arrow_back, color: Colors.white),

                  padding: EdgeInsets.zero,

                  constraints: const BoxConstraints(),

                ),

                const SizedBox(height: 16),

                const Text('Start learning', style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800)),

                Text('Create your free account.', style: TextStyle(color: Colors.white.withValues(alpha: 0.75))),

              ],

            ),

          ),

          Expanded(

            child: ListView(

              padding: const EdgeInsets.all(24),

              children: [

                TextField(controller: _email, decoration: _field('Email'), keyboardType: TextInputType.emailAddress),

                const SizedBox(height: 12),

                TextField(controller: _password, obscureText: true, decoration: _field('Password (min 8)')),

                const SizedBox(height: 16),

                DropdownButtonFormField<String>(

                  value: _native,

                  decoration: _field('Native language'),

                  items: const [

                    DropdownMenuItem(value: 'en', child: Text('English')),

                    DropdownMenuItem(value: 'ru', child: Text('Russian')),

                    DropdownMenuItem(value: 'uz', child: Text('Uzbek')),

                  ],

                  onChanged: (v) => setState(() => _native = v ?? 'en'),

                ),

                const SizedBox(height: 16),

                Text('Target languages', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),

                const SizedBox(height: 8),

                Wrap(

                  spacing: 8,

                  children: ['en', 'ru', 'uz'].map((lang) => FilterChip(

                    label: Text(lang.toUpperCase()),

                    selected: _targets.contains(lang),

                    selectedColor: colors.brandPrimarySoft,

                    checkmarkColor: colors.brandPrimary,

                    onSelected: (selected) => setState(() {

                      if (selected) {

                        _targets.add(lang);

                      } else if (_targets.length > 1) {

                        _targets.remove(lang);

                      }

                    }),

                  )).toList(),

                ),

                if (auth.error != null) ...[

                  const SizedBox(height: 12),

                  Text(auth.error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),

                ],

                const SizedBox(height: 24),

                FilledButton(

                  style: FilledButton.styleFrom(

                    backgroundColor: colors.brandPrimary,

                    minimumSize: const Size.fromHeight(48),

                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),

                  ),

                  onPressed: auth.loading

                      ? null

                      : () => ref.read(authStateProvider.notifier).register(

                            email: _email.text.trim(),

                            password: _password.text,

                            nativeLanguage: _native,

                            targetLanguages: _targets.toList(),

                          ),

                  child: auth.loading

                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))

                      : const Text('Create free account', style: TextStyle(fontWeight: FontWeight.w700)),

                ),

                TextButton(onPressed: widget.onNavigateLogin, child: const Text('Already have an account? Sign in')),

              ],

            ),

          ),

        ],

      ),

    );

  }

}


