package app.gotcha.android

import app.gotcha.android.ui.auth.isValidEmail
import app.gotcha.android.ui.learner.tidyChapterTitle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** P3: UI-19 chapter-title cleanup and DESIGN §B #26 client email validation. */
class P3UiLogicTest {
    @Test fun collapsesLetterSpacedChapterTitles() {
        assertEquals("LEIPZIG", tidyChapterTitle("Chapter L E I P Z I G"))
        assertEquals("LEIPZIG", tidyChapterTitle("L E I P Z I G"))
        assertEquals("Chapter II", tidyChapterTitle("Chapter II"))
        assertEquals("Chapter III. Die Flut", tidyChapterTitle("Chapter III. Die Flut"))
    }

    @Test fun validatesEmails() {
        assertTrue("name@example.com".isValidEmail())
        assertTrue(" a.b@sub.example.uz ".isValidEmail())
        assertFalse("name@".isValidEmail())
        assertFalse("name example.com".isValidEmail())
        assertFalse("name@example".isValidEmail())
    }
}
