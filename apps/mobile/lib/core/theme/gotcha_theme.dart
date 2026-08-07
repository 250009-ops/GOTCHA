import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class GotchaColors extends ThemeExtension<GotchaColors> {
  const GotchaColors({
    required this.brandPrimary,
    required this.brandPrimarySoft,
    required this.brandAccent,
    required this.brandWarm,
    required this.readerBackground,
    required this.readerText,
    required this.highlightNew,
    required this.highlightSaved,
  });

  final Color brandPrimary;
  final Color brandPrimarySoft;
  final Color brandAccent;
  final Color brandWarm;
  final Color readerBackground;
  final Color readerText;
  final Color highlightNew;
  final Color highlightSaved;

  static const light = GotchaColors(
    brandPrimary: Color(0xFF6D28D9),
    brandPrimarySoft: Color(0xFFEDE9FE),
    brandAccent: Color(0xFF0D9488),
    brandWarm: Color(0xFFF59E0B),
    readerBackground: Color(0xFFFFFEF9),
    readerText: Color(0xFF1C1917),
    highlightNew: Color(0xFFFEF3C7),
    highlightSaved: Color(0xFFDDD6FE),
  );

  static const dark = GotchaColors(
    brandPrimary: Color(0xFFA78BFA),
    brandPrimarySoft: Color(0xFF2E1065),
    brandAccent: Color(0xFF2DD4BF),
    brandWarm: Color(0xFFFBBF24),
    readerBackground: Color(0xFF1C1917),
    readerText: Color(0xFFE7E5E4),
    highlightNew: Color(0xFF713F12),
    highlightSaved: Color(0xFF4C1D95),
  );

  @override
  GotchaColors copyWith({
    Color? brandPrimary,
    Color? brandPrimarySoft,
    Color? brandAccent,
    Color? brandWarm,
    Color? readerBackground,
    Color? readerText,
    Color? highlightNew,
    Color? highlightSaved,
  }) {
    return GotchaColors(
      brandPrimary: brandPrimary ?? this.brandPrimary,
      brandPrimarySoft: brandPrimarySoft ?? this.brandPrimarySoft,
      brandAccent: brandAccent ?? this.brandAccent,
      brandWarm: brandWarm ?? this.brandWarm,
      readerBackground: readerBackground ?? this.readerBackground,
      readerText: readerText ?? this.readerText,
      highlightNew: highlightNew ?? this.highlightNew,
      highlightSaved: highlightSaved ?? this.highlightSaved,
    );
  }

  @override
  GotchaColors lerp(ThemeExtension<GotchaColors>? other, double t) => this;
}

class GotchaTheme {
  static ThemeData get light => _build(Brightness.light, GotchaColors.light);
  static ThemeData get dark => _build(Brightness.dark, GotchaColors.dark);

  static ThemeData _build(Brightness brightness, GotchaColors ext) {
    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: ColorScheme.fromSeed(
        seedColor: ext.brandPrimary,
        brightness: brightness,
        primary: ext.brandPrimary,
        secondary: ext.brandAccent,
        tertiary: ext.brandWarm,
      ),
      scaffoldBackgroundColor: const Color(0xFFF5F3FF),
      textTheme: GoogleFonts.plusJakartaSansTextTheme(),
    );
    return base.copyWith(
      extensions: [ext],
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        backgroundColor: base.scaffoldBackgroundColor,
        foregroundColor: base.colorScheme.onSurface,
      ),
      navigationBarTheme: NavigationBarThemeData(
        indicatorColor: ext.brandPrimarySoft,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: base.dividerColor.withValues(alpha: 0.5)),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }
}

extension GotchaThemeContext on BuildContext {
  GotchaColors get gotchaColors => Theme.of(this).extension<GotchaColors>()!;
}
