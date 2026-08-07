import 'package:flutter/material.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:gotcha_app/core/network/api_client.dart';

import 'package:gotcha_app/core/theme/gotcha_theme.dart';

import 'package:gotcha_app/core/widgets/gotcha_empty_state.dart';



final libraryFeedProvider = FutureProvider<Map<String, dynamic>>((ref) async {

  return ref.read(apiClientProvider).get('/content/feed');

});



class LibraryScreen extends ConsumerWidget {

  const LibraryScreen({super.key, required this.onOpenReader});

  final ValueChanged<String> onOpenReader;



  @override

  Widget build(BuildContext context, WidgetRef ref) {

    final feed = ref.watch(libraryFeedProvider);

    final colors = context.gotchaColors;



    return Scaffold(

      backgroundColor: const Color(0xFFF5F3FF),

      body: SafeArea(

        child: feed.when(

          loading: () => const Center(child: CircularProgressIndicator()),

          error: (_, __) => Padding(
            padding: const EdgeInsets.all(24),
            child: GotchaEmptyState(
              icon: Icons.cloud_off_outlined,
              title: 'Could not load library',
              description: 'Check your connection and pull to refresh.',
            ),
          ),

          data: (data) {

            final continueReading = (data['continueReading'] as List?) ?? [];

            final recent = (data['recentlyPublished'] as List?) ?? [];

            final featured = (data['featuredCollections'] as List?) ?? [];



            return CustomScrollView(

              slivers: [

                SliverToBoxAdapter(

                  child: Padding(

                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),

                    child: Column(

                      crossAxisAlignment: CrossAxisAlignment.start,

                      children: [

                        Row(

                          children: [

                            Container(

                              width: 36,

                              height: 36,

                              decoration: BoxDecoration(

                                gradient: const LinearGradient(colors: [Color(0xFF7C3AED), Color(0xFF4338CA)]),

                                borderRadius: BorderRadius.circular(10),

                              ),

                              child: const Icon(Icons.menu_book_rounded, color: Colors.white, size: 20),

                            ),

                            const SizedBox(width: 10),

                            Text('Library', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),

                          ],

                        ),

                        const SizedBox(height: 4),

                        Text('Discover stories and continue reading', style: TextStyle(color: Colors.grey.shade600, fontSize: 14)),

                      ],

                    ),

                  ),

                ),

                if (continueReading.isNotEmpty)

                  SliverToBoxAdapter(

                    child: Padding(

                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),

                      child: Text('Continue reading', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),

                    ),

                  ),

                if (continueReading.isNotEmpty)

                  SliverToBoxAdapter(

                    child: SizedBox(

                      height: 160,

                      child: ListView.separated(

                        scrollDirection: Axis.horizontal,

                        padding: const EdgeInsets.symmetric(horizontal: 20),

                        itemCount: continueReading.length,

                        separatorBuilder: (_, __) => const SizedBox(width: 12),

                        itemBuilder: (_, i) => _HeroCard(

                          item: continueReading[i] as Map<String, dynamic>,

                          onTap: () => onOpenReader(continueReading[i]['id'] as String),

                        ),

                      ),

                    ),

                  ),

                if (featured.isNotEmpty)

                  ...featured.map((col) {

                    final collection = col as Map<String, dynamic>;

                    final items = ((collection['items'] as List?) ?? [])

                        .map((e) => (e as Map<String, dynamic>)['content'] as Map<String, dynamic>?)

                        .whereType<Map<String, dynamic>>()

                        .toList();

                    if (items.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());

                    return SliverToBoxAdapter(

                      child: Column(

                        crossAxisAlignment: CrossAxisAlignment.start,

                        children: [

                          Padding(

                            padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),

                            child: Text(collection['title']?.toString() ?? 'Featured', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),

                          ),

                          SizedBox(

                            height: 200,

                            child: ListView.separated(

                              scrollDirection: Axis.horizontal,

                              padding: const EdgeInsets.symmetric(horizontal: 20),

                              itemCount: items.length,

                              separatorBuilder: (_, __) => const SizedBox(width: 12),

                              itemBuilder: (_, i) => SizedBox(

                                width: 140,

                                child: _ContentCard(item: items[i], onTap: () => onOpenReader(items[i]['id'] as String)),

                              ),

                            ),

                          ),

                        ],

                      ),

                    );

                  }),

                SliverToBoxAdapter(

                  child: Padding(

                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),

                    child: Text('Discover', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),

                  ),

                ),

                SliverPadding(

                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),

                  sliver: SliverList.separated(

                    itemCount: recent.length,

                    separatorBuilder: (_, __) => const SizedBox(height: 12),

                    itemBuilder: (_, i) => _ContentCard(

                      item: recent[i] as Map<String, dynamic>,

                      onTap: () => onOpenReader(recent[i]['id'] as String),

                      horizontal: true,

                    ),

                  ),

                ),

                if (recent.isEmpty && continueReading.isEmpty)

                  SliverFillRemaining(

                    hasScrollBody: false,

                    child: Padding(

                      padding: const EdgeInsets.all(20),

                      child: GotchaEmptyState(

                        icon: Icons.menu_book_outlined,

                        title: 'Your library is empty',

                        description: 'Import your own text or explore stories once content is available.',

                        actionLabel: 'Import content',

                        onAction: () {},

                      ),

                    ),

                  ),

              ],

            );

          },

        ),

      ),

    );

  }

}



class _HeroCard extends StatelessWidget {

  const _HeroCard({required this.item, required this.onTap});

  final Map<String, dynamic> item;

  final VoidCallback onTap;



  @override

  Widget build(BuildContext context) {

    final pct = item['progressPct'] as num? ?? 0;

    return GestureDetector(

      onTap: onTap,

      child: Container(

        width: 280,

        decoration: BoxDecoration(

          gradient: const LinearGradient(colors: [Color(0xFF7C3AED), Color(0xFF4338CA)]),

          borderRadius: BorderRadius.circular(16),

        ),

        padding: const EdgeInsets.all(20),

        child: Column(

          crossAxisAlignment: CrossAxisAlignment.start,

          mainAxisAlignment: MainAxisAlignment.end,

          children: [

            Text('CONTINUE READING', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1)),

            const SizedBox(height: 8),

            Text(item['title']?.toString() ?? 'Untitled', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),

            const SizedBox(height: 8),

            ClipRRect(

              borderRadius: BorderRadius.circular(4),

              child: LinearProgressIndicator(value: pct / 100, minHeight: 4, backgroundColor: Colors.white24, color: Colors.white),

            ),

            const SizedBox(height: 4),

            Text('$pct% read', style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 12)),

          ],

        ),

      ),

    );

  }

}



class _ContentCard extends StatelessWidget {

  const _ContentCard({required this.item, required this.onTap, this.horizontal = false});

  final Map<String, dynamic> item;

  final VoidCallback onTap;

  final bool horizontal;



  @override

  Widget build(BuildContext context) {

    final colors = context.gotchaColors;

    final level = (item['cefrLevel'] ?? '').toString().toUpperCase();

    final lang = (item['language'] ?? '?').toString().toUpperCase();



    if (horizontal) {

      return Material(

        color: Colors.white,

        borderRadius: BorderRadius.circular(16),

        child: InkWell(

          borderRadius: BorderRadius.circular(16),

          onTap: onTap,

          child: Padding(

            padding: const EdgeInsets.all(14),

            child: Row(

              children: [

                Container(

                  width: 56,

                  height: 56,

                  decoration: BoxDecoration(

                    gradient: LinearGradient(colors: [colors.brandPrimary, const Color(0xFF4338CA)]),

                    borderRadius: BorderRadius.circular(12),

                  ),

                  child: const Icon(Icons.menu_book_rounded, color: Colors.white54),

                ),

                const SizedBox(width: 14),

                Expanded(

                  child: Column(

                    crossAxisAlignment: CrossAxisAlignment.start,

                    children: [

                      Text(item['title']?.toString() ?? 'Untitled', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),

                      const SizedBox(height: 4),

                      Text('$level · $lang · ${item['wordCount'] ?? 0} words', style: Theme.of(context).textTheme.bodySmall),

                    ],

                  ),

                ),

                const Icon(Icons.chevron_right, color: Colors.grey),

              ],

            ),

          ),

        ),

      );

    }



    return Material(

      color: Colors.white,

      borderRadius: BorderRadius.circular(16),

      child: InkWell(

        borderRadius: BorderRadius.circular(16),

        onTap: onTap,

        child: Column(

          crossAxisAlignment: CrossAxisAlignment.start,

          children: [

            Container(

              height: 100,

              decoration: BoxDecoration(

                gradient: LinearGradient(colors: [colors.brandPrimary, const Color(0xFF4338CA)]),

                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),

              ),

              child: Stack(

                children: [

                  const Center(child: Icon(Icons.menu_book_rounded, color: Colors.white38, size: 36)),

                  Positioned(

                    top: 8,

                    left: 8,

                    child: Container(

                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),

                      decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(6)),

                      child: Text(level, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),

                    ),

                  ),

                ],

              ),

            ),

            Padding(

              padding: const EdgeInsets.all(10),

              child: Text(item['title']?.toString() ?? 'Untitled', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),

            ),

          ],

        ),

      ),

    );

  }

}


