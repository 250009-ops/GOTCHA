package app.gotcha.android

import app.gotcha.android.ui.i18n.practiceCopyFor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PracticeCopyTest {
    @Test fun fallsBackToEnglish() {
        assertEquals(practiceCopyFor("en").title, practiceCopyFor("de").title)
        assertEquals(practiceCopyFor("en").title, practiceCopyFor(null).title)
    }

    @Test fun allLanguagesHaveEveryExerciseType() {
        for (l in listOf("en", "ru", "uz")) {
            val t = practiceCopyFor(l)
            for (type in listOf("flashcard", "mcq_meaning", "typed_recall", "cloze", "cloze_mcq", "listening_mcq", "dictation")) {
                assertTrue("$l/$type", t.typeNames.containsKey(type))
            }
            assertTrue(t.`continue`.isNotBlank())
        }
    }

    @Test fun uzbekUsesModifierLetterTurnedComma() {
        val all = practiceCopyFor("uz").toString()
        assertFalse("U+2018 in uz copy", all.contains('\u2018'))
    }

    @Test fun russianPlurals() {
        val ru = practiceCopyFor("ru")
        assertEquals("1 новое", ru.f(ru.newWords, 1))
        assertEquals("Серия: 3 дня", ru.f(ru.streakDays, 3))
        assertEquals("Серия: 11 дней", ru.f(ru.streakDays, 11))
        assertEquals("Серия: 21 день", ru.f(ru.streakDays, 21))
        val en = practiceCopyFor("en")
        assertEquals("1 streak freeze", en.f(en.freezes, 1))
        assertEquals("21 streak freezes", en.f(en.freezes, 21))
    }
}
