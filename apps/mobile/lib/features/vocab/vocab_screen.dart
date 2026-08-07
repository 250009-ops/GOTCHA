import 'package:flutter/material.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:gotcha_app/core/network/api_client.dart';

import 'package:gotcha_app/core/theme/gotcha_theme.dart';

import 'package:gotcha_app/core/widgets/gotcha_empty_state.dart';



final vocabListProvider = FutureProvider<List<dynamic>>((ref) async {

  final res = await ref.read(apiClientProvider).get('/vocabulary?sort=recent');

  return res is List ? res : (res['items'] as List?) ?? [];

});



final reviewQueueProvider = FutureProvider<List<dynamic>>((ref) async {

  final res = await ref.read(apiClientProvider).get('/vocabulary/review-queue?limit=20');

  return res is List ? res : [];

});



class VocabScreen extends ConsumerWidget {

  const VocabScreen({super.key});



  Future<void> _startReview(BuildContext context, WidgetRef ref) async {

    final queue = await ref.read(reviewQueueProvider.future);

    if (queue.isEmpty) {

      if (context.mounted) {

        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No words due for review')));

      }

      return;

    }



    if (!context.mounted) return;

    await showModalBottomSheet<void>(

      context: context,

      isScrollControlled: true,

      builder: (ctx) => _ReviewSheet(items: queue.cast<Map<String, dynamic>>(), onDone: () => ref.invalidate(vocabListProvider)),

    );

  }



  @override

  Widget build(BuildContext context, WidgetRef ref) {

    final vocab = ref.watch(vocabListProvider);

    final colors = context.gotchaColors;

    final reviewQueue = ref.watch(reviewQueueProvider);



    return Scaffold(

      backgroundColor: const Color(0xFFF5F3FF),

      appBar: AppBar(

        backgroundColor: const Color(0xFFF5F3FF),

        title: const Text('Vocabulary', style: TextStyle(fontWeight: FontWeight.w800)),

        actions: [

          IconButton(icon: const Icon(Icons.refresh), onPressed: () {

            ref.invalidate(vocabListProvider);

            ref.invalidate(reviewQueueProvider);

          }),

        ],

      ),

      body: vocab.when(

        loading: () => const Center(child: CircularProgressIndicator()),

        error: (e, _) => Center(child: GotchaEmptyState(icon: Icons.error_outline, title: 'Could not load vocabulary', description: '$e', compact: true)),

        data: (items) => items.isEmpty

            ? const Padding(
                padding: EdgeInsets.all(16),
                child: GotchaEmptyState(
                  icon: Icons.auto_stories_outlined,
                  title: 'No words saved yet',
                  description: 'Tap any word while reading to look it up and save it to your list.',
                ),
              )

            : Column(

          children: [

            if (reviewQueue.valueOrNull?.isNotEmpty == true)

              Padding(

                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),

                child: Material(

                  color: colors.brandPrimary,

                  borderRadius: BorderRadius.circular(12),

                  child: ListTile(

                    leading: const Icon(Icons.psychology_outlined, color: Colors.white),

                    title: Text('Review ${reviewQueue.value!.length} due words', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),

                    trailing: const Icon(Icons.chevron_right, color: Colors.white),

                    onTap: () => _startReview(context, ref),

                  ),

                ),

              ),

            Expanded(

              child: ListView.separated(

                      padding: const EdgeInsets.all(16),

                      itemCount: items.length,

                      separatorBuilder: (_, __) => const SizedBox(height: 8),

                      itemBuilder: (_, i) {

                        final item = items[i] as Map<String, dynamic>;

                        return Card(

                          color: Colors.white,

                          child: ListTile(

                            title: Text(item['lemma']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),

                            subtitle: Text(item['translation']?.toString() ?? ''),

                            trailing: item['mastered'] == true

                                ? Icon(Icons.check_circle, color: colors.brandAccent)

                                : Icon(Icons.schedule, color: colors.brandWarm, size: 20),

                          ),

                        );

                      },

                    ),

            ),

          ],

        ),

      ),

      floatingActionButton: FloatingActionButton.extended(

        onPressed: () => _startReview(context, ref),

        backgroundColor: colors.brandPrimary,

        icon: const Icon(Icons.style),

        label: const Text('Review'),

      ),

    );

  }

}



class _ReviewSheet extends StatefulWidget {

  const _ReviewSheet({required this.items, required this.onDone});

  final List<Map<String, dynamic>> items;

  final VoidCallback onDone;



  @override

  State<_ReviewSheet> createState() => _ReviewSheetState();

}



class _ReviewSheetState extends State<_ReviewSheet> {

  int _index = 0;

  bool _revealed = false;



  Future<void> _rate(String rating) async {

    final item = widget.items[_index];

    final client = ApiClient();

    await client.post('/vocabulary/${item['id']}/review', {'rating': rating.toLowerCase()});

    setState(() {

      _revealed = false;

      if (_index + 1 >= widget.items.length) {

        widget.onDone();

        Navigator.pop(context);

      } else {

        _index++;

      }

    });

  }



  @override

  Widget build(BuildContext context) {

    if (widget.items.isEmpty) return const SizedBox.shrink();

    final item = widget.items[_index];



    return Padding(

      padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.paddingOf(context).bottom + 24),

      child: Column(

        mainAxisSize: MainAxisSize.min,

        children: [

          Text('${_index + 1} / ${widget.items.length}', style: Theme.of(context).textTheme.labelLarge),

          const SizedBox(height: 16),

          Text(item['lemma']?.toString() ?? '', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),

          const SizedBox(height: 24),

          if (!_revealed)

            OutlinedButton(onPressed: () => setState(() => _revealed = true), child: const Text('Show translation'))

          else ...[

            Text(item['translation']?.toString() ?? '', style: Theme.of(context).textTheme.titleLarge),

            const SizedBox(height: 24),

            Wrap(

              spacing: 8,

              alignment: WrapAlignment.center,

              children: ['again', 'hard', 'good', 'easy'].map((r) => FilledButton(

                onPressed: () => _rate(r),

                child: Text(r[0].toUpperCase() + r.substring(1)),

              )).toList(),

            ),

          ],

        ],

      ),

    );

  }

}


