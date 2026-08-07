import 'package:flutter/material.dart';
import 'package:gotcha_app/core/theme/gotcha_theme.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onDone});
  final VoidCallback onDone;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _index = 0;

  final _slides = const [
    ('Read', 'Authentic books, articles, and stories in English, Russian, and Uzbek.'),
    ('Tap & learn', 'Instant translations with grammar notes in the sentence you are reading.'),
    ('Practice', 'Quizzes and flashcards generated from your reading — not random drills.'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.gotchaColors;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _slides.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (_, i) => Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CircleAvatar(
                        radius: 48,
                        backgroundColor: colors.brandPrimarySoft,
                        child: Icon(Icons.auto_stories, size: 42, color: colors.brandPrimary),
                      ),
                      const SizedBox(height: 32),
                      Text(_slides[i].$1, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 16),
                      Text(_slides[i].$2, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge),
                    ],
                  ),
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_slides.length, (i) => Container(
                width: 8, height: 8, margin: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: i == _index ? colors.brandPrimary : colors.brandPrimarySoft,
                ),
              )),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: FilledButton(
                onPressed: () {
                  if (_index < _slides.length - 1) {
                    _controller.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
                  } else {
                    widget.onDone();
                  }
                },
                child: Text(_index < _slides.length - 1 ? 'Next' : 'Get started'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
