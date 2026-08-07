import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gotcha_app/core/network/api_client.dart';
import 'package:gotcha_app/core/theme/gotcha_theme.dart';

class ReaderScreen extends ConsumerStatefulWidget {
  const ReaderScreen({super.key, required this.contentId, required this.onClose});
  final String contentId;
  final VoidCallback onClose;

  @override
  ConsumerState<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends ConsumerState<ReaderScreen> {
  Map<String, dynamic>? _segment;
  Map<String, dynamic>? _lookup;
  int? _selectedTokenIndex;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get('/content/${widget.contentId}/segments?from=0&limit=1');
      final segments = res['segments'] as List?;
      setState(() {
        _segment = segments?.isNotEmpty == true ? segments!.first as Map<String, dynamic> : null;
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _lookupToken(Map<String, dynamic> token) async {
    if (token['isWord'] != true) return;
    setState(() {
      _selectedTokenIndex = token['i'] as int?;
      _lookup = null;
    });

    final sentence = _segment?['plainText']?.toString() ?? '';
    try {
      final res = await ref.read(apiClientProvider).post('/ai/lookup', {
        'token': token['surface'],
        'sentence': sentence,
        'sourceLang': 'en',
        'targetLang': 'uz',
      });
      if (mounted) setState(() => _lookup = res);
    } catch (e) {
      if (mounted) setState(() => _lookup = {'translation': 'Error', 'grammarNote': e.toString()});
    }
  }

  Future<void> _saveWord() async {
    if (_lookup == null || _selectedTokenIndex == null) return;
    final tokens = (_segment?['tokenMap'] as List?) ?? [];
    final token = tokens.cast<Map<String, dynamic>>().firstWhere((t) => t['i'] == _selectedTokenIndex);
    await ref.read(apiClientProvider).post('/vocabulary', {
      'lemma': token['lemma'] ?? token['surface'],
      'sourceLang': 'en',
      'targetLang': 'uz',
      'translation': _lookup!['translation'],
      'contextSentence': _segment?['plainText'],
      'contextSegmentId': _segment?['id'],
      'contentId': widget.contentId,
    });
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Word saved to vocabulary')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.gotchaColors;

    return Scaffold(
      backgroundColor: colors.readerBackground,
      appBar: AppBar(
        backgroundColor: colors.readerBackground,
        leading: IconButton(icon: const Icon(Icons.close), onPressed: widget.onClose),
        title: Text(_segment?['title']?.toString() ?? 'Reader'),
        actions: [
          IconButton(icon: const Icon(Icons.text_fields), onPressed: () {}),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : Column(
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(20),
                        child: Wrap(
                          children: _buildTokens(colors),
                        ),
                      ),
                    ),
                    if (_lookup != null)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surface,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 16, offset: const Offset(0, -4))],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_lookup!['translation']?.toString() ?? '', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                            if (_lookup!['grammarNote'] != null) ...[
                              const SizedBox(height: 8),
                              Text(_lookup!['grammarNote'].toString(), style: Theme.of(context).textTheme.bodyMedium),
                            ],
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                FilledButton(onPressed: _saveWord, child: const Text('Save word')),
                                const SizedBox(width: 8),
                                OutlinedButton(onPressed: () => setState(() => _lookup = null), child: const Text('Close')),
                              ],
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
    );
  }

  List<Widget> _buildTokens(GotchaColors colors) {
    final tokens = (_segment?['tokenMap'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    return tokens.map((token) {
      final selected = token['i'] == _selectedTokenIndex;
      final isWord = token['isWord'] == true;
      return GestureDetector(
        onTap: isWord ? () => _lookupToken(token) : null,
        child: Container(
          margin: const EdgeInsets.only(bottom: 2),
          padding: isWord ? const EdgeInsets.symmetric(horizontal: 1, vertical: 1) : EdgeInsets.zero,
          decoration: BoxDecoration(
            color: selected ? colors.highlightNew : Colors.transparent,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            token['surface']?.toString() ?? '',
            style: TextStyle(
              fontSize: 18,
              height: 1.6,
              color: colors.readerText,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
            ),
          ),
        ),
      );
    }).toList();
  }
}
