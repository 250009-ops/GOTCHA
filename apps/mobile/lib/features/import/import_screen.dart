import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gotcha_app/core/network/api_client.dart';
import 'package:gotcha_app/core/theme/gotcha_theme.dart';
import 'package:gotcha_app/core/widgets/gotcha_empty_state.dart';

final importHistoryProvider = FutureProvider<List<dynamic>>((ref) async {
  final res = await ref.read(apiClientProvider).get('/imports');
  return res is List ? res : [];
});

class ImportScreen extends ConsumerStatefulWidget {
  const ImportScreen({super.key});

  @override
  ConsumerState<ImportScreen> createState() => _ImportScreenState();
}

class _ImportScreenState extends ConsumerState<ImportScreen> {
  final _title = TextEditingController();
  final _text = TextEditingController();
  final _url = TextEditingController();
  String _language = 'en';
  bool _submitting = false;
  int _tab = 0;

  Future<void> _importPaste() async {
    setState(() => _submitting = true);
    try {
      await ref.read(apiClientProvider).post('/imports/paste', {
        'title': _title.text.trim().isEmpty ? 'Imported text' : _title.text.trim(),
        'text': _text.text.trim(),
        'language': _language,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Import submitted')));
        _text.clear();
        ref.invalidate(importHistoryProvider);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _importUrl() async {
    setState(() => _submitting = true);
    try {
      await ref.read(apiClientProvider).post('/imports/url', {
        'url': _url.text.trim(),
        'language': _language,
        'title': _title.text.trim().isEmpty ? null : _title.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('URL import queued')));
        _url.clear();
        ref.invalidate(importHistoryProvider);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.gotchaColors;
    final history = ref.watch(importHistoryProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F3FF),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF5F3FF),
        title: const Text('Import content', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Add your own texts to read and learn from.', style: TextStyle(color: Colors.grey.shade600, fontSize: 14)),
          const SizedBox(height: 16),
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(child: _TabButton(label: 'URL', selected: _tab == 0, onTap: () => setState(() => _tab = 0))),
                    Expanded(child: _TabButton(label: 'Paste', selected: _tab == 1, onTap: () => setState(() => _tab = 1))),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      DropdownButtonFormField<String>(
                        value: _language,
                        decoration: InputDecoration(labelText: 'Language', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
                        items: const [
                          DropdownMenuItem(value: 'en', child: Text('🇬🇧 English')),
                          DropdownMenuItem(value: 'ru', child: Text('🇷🇺 Russian')),
                          DropdownMenuItem(value: 'uz', child: Text('🇺🇿 Uzbek')),
                        ],
                        onChanged: (v) => setState(() => _language = v ?? 'en'),
                      ),
                      const SizedBox(height: 12),
                      if (_tab == 0) ...[
                        TextField(controller: _url, decoration: InputDecoration(labelText: 'URL', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)))),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: _submitting ? null : _importUrl,
                          style: FilledButton.styleFrom(backgroundColor: colors.brandPrimary, minimumSize: const Size.fromHeight(44), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                          child: const Text('Import from URL'),
                        ),
                      ] else ...[
                        TextField(controller: _title, decoration: InputDecoration(labelText: 'Title', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)))),
                        const SizedBox(height: 12),
                        TextField(controller: _text, maxLines: 8, decoration: InputDecoration(labelText: 'Text', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)))),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: _submitting ? null : _importPaste,
                          style: FilledButton.styleFrom(backgroundColor: colors.brandPrimary, minimumSize: const Size.fromHeight(44), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                          child: const Text('Import text'),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Import history', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              history.whenOrNull(data: (items) => Text('${items.length} imports', style: Theme.of(context).textTheme.bodySmall)),
            ],
          ),
          const SizedBox(height: 12),
          history.when(
            loading: () => const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator())),
            error: (_, __) => GotchaEmptyState(icon: Icons.history, title: 'Could not load history', description: 'Try again in a moment.', compact: true),
            data: (items) => items.isEmpty
                ? const GotchaEmptyState(
                    icon: Icons.upload_outlined,
                    title: 'No imports yet',
                    description: 'Paste text or import from a URL to build your personal library.',
                    compact: true,
                  )
                : Column(
                    children: items.map((raw) {
                      final item = raw as Map<String, dynamic>;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          title: Text(item['title']?.toString() ?? 'Untitled', style: const TextStyle(fontWeight: FontWeight.w700)),
                          subtitle: Text('${item['importType']} · ${item['ingestionStatus']}'),
                          trailing: const Icon(Icons.chevron_right),
                        ),
                      );
                    }).toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: selected ? const Color(0xFF7C3AED) : Colors.transparent, width: 2)),
          color: selected ? const Color(0xFF7C3AED).withValues(alpha: 0.05) : null,
        ),
        child: Text(label, textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, color: selected ? const Color(0xFF6D28D9) : Colors.grey)),
      ),
    );
  }
}
