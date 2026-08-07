import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gotcha_app/core/network/api_client.dart';
import 'package:gotcha_app/core/widgets/gotcha_empty_state.dart';

class PracticeScreen extends ConsumerStatefulWidget {
  const PracticeScreen({super.key});

  @override
  ConsumerState<PracticeScreen> createState() => _PracticeScreenState();
}

class _PracticeScreenState extends ConsumerState<PracticeScreen> {
  List<dynamic> _queue = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadQueue();
  }

  Future<void> _loadQueue() async {
    try {
      final res = await ref.read(apiClientProvider).get('/vocabulary/review-queue');
      setState(() {
        _queue = res is List ? res : [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F3FF),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF5F3FF),
        title: const Text('Practice', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  color: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  child: ListTile(
                    leading: CircleAvatar(backgroundColor: const Color(0xFF7C3AED).withValues(alpha: 0.12), child: const Icon(Icons.quiz, color: Color(0xFF7C3AED))),
                    title: const Text('Comprehension quiz', style: TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: const Text('From your last reading session'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {},
                  ),
                ),
                const SizedBox(height: 8),
                Card(
                  color: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  child: ListTile(
                    leading: CircleAvatar(backgroundColor: const Color(0xFF7C3AED).withValues(alpha: 0.12), child: const Icon(Icons.spellcheck, color: Color(0xFF7C3AED))),
                    title: const Text('Cloze exercise', style: TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: const Text('Fill in the blanks from saved words'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {},
                  ),
                ),
                const SizedBox(height: 24),
                Text('Due for review', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                if (_queue.isEmpty)
                  const GotchaEmptyState(
                    icon: Icons.style_outlined,
                    title: 'No cards due right now',
                    description: 'Keep reading and save words — reviews will appear here when they are due.',
                    compact: true,
                  )
                else
                  ..._queue.map((item) {
                    final map = item as Map<String, dynamic>;
                    return Card(
                      color: Colors.white,
                      margin: const EdgeInsets.only(bottom: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      child: ListTile(
                        title: Text(map['lemma']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text(map['translation']?.toString() ?? ''),
                      ),
                    );
                  }),
              ],
            ),
    );
  }
}
