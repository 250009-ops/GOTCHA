import 'package:flutter/material.dart';
import 'package:gotcha_app/features/import/import_screen.dart';
import 'package:gotcha_app/features/library/library_screen.dart';
import 'package:gotcha_app/features/practice/practice_screen.dart';
import 'package:gotcha_app/features/profile/profile_screen.dart';
import 'package:gotcha_app/features/vocab/vocab_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.onOpenReader, required this.onLogout});
  final ValueChanged<String> onOpenReader;
  final VoidCallback onLogout;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      LibraryScreen(onOpenReader: widget.onOpenReader),
      VocabScreen(),
      PracticeScreen(),
      ImportScreen(),
      ProfileScreen(onLogout: widget.onLogout),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.menu_book_outlined), selectedIcon: Icon(Icons.menu_book), label: 'Library'),
          NavigationDestination(icon: Icon(Icons.translate_outlined), selectedIcon: Icon(Icons.translate), label: 'Vocab'),
          NavigationDestination(icon: Icon(Icons.quiz_outlined), selectedIcon: Icon(Icons.quiz), label: 'Practice'),
          NavigationDestination(icon: Icon(Icons.upload_file_outlined), selectedIcon: Icon(Icons.upload_file), label: 'Import'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
