import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gotcha_app/core/auth/auth_provider.dart';
import 'package:gotcha_app/core/network/api_client.dart';
import 'package:gotcha_app/core/theme/gotcha_theme.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key, required this.onLogout});
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authStateProvider);
    final user = auth.user;
    final colors = context.gotchaColors;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: ref.read(apiClientProvider).get('/users/me/stats'),
        builder: (context, snapshot) {
          final stats = snapshot.data ?? {};
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 32,
                        backgroundColor: colors.brandPrimarySoft,
                        child: Text(
                          (user?['displayName']?.toString() ?? 'G').substring(0, 1).toUpperCase(),
                          style: TextStyle(color: colors.brandPrimary, fontSize: 24, fontWeight: FontWeight.w800),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(user?['displayName']?.toString() ?? 'Learner', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                            Text(user?['email']?.toString() ?? '', style: Theme.of(context).textTheme.bodyMedium),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Icon(Icons.local_fire_department, color: colors.brandWarm, size: 18),
                                const SizedBox(width: 4),
                                Text('${user?['streakCount'] ?? 0} day streak'),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _StatChip(label: 'Words saved', value: '${stats['vocabularyTotal'] ?? 0}'),
                  _StatChip(label: 'Mastered', value: '${stats['vocabularyMastered'] ?? 0}'),
                  _StatChip(label: 'Due reviews', value: '${stats['vocabularyDue'] ?? 0}'),
                  _StatChip(label: 'Read (min)', value: '${stats['totalReadMinutes'] ?? 0}'),
                ],
              ),
              const SizedBox(height: 24),
              Card(
                child: ListTile(
                  leading: Icon(Icons.workspace_premium, color: colors.brandWarm),
                  title: const Text('Premium'),
                  subtitle: const Text('Unlimited AI lookups & offline reading'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {},
                ),
              ),
              ListTile(
                leading: const Icon(Icons.logout),
                title: const Text('Sign out'),
                onTap: onLogout,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
        ],
      ),
      padding: const EdgeInsets.all(12),
    );
  }
}
