package app.gotcha.android

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * P3b.1 GOT-QA-P3b-07: every sign-in / sign-up step pins its primary CTA in AuthScaffold's
 * bottomBar (outside the scroll, inside imePadding) instead of a one-shot bringIntoView.
 */
class AuthCtaPinnedTest {
    private val src = listOf(
        File("src/main/java/app/gotcha/android/ui/auth/AuthScreens.kt"),
        File("app/src/main/java/app/gotcha/android/ui/auth/AuthScreens.kt"),
    ).first { it.isFile }.readText()

    @Test fun signInAndBothSignUpStepsUseBottomBar() {
        assertEquals(3, Regex("""AuthScaffold\(""").findAll(src).count() - 1)
        assertEquals(3, Regex("""\n\s+bottomBar = \{""").findAll(src).count())
    }

    @Test fun oneShotScrollHackIsGone() {
        assertFalse(src.contains("authCta"))
        assertFalse(src.contains("BringIntoViewRequester"))
    }

    @Test fun bottomBarSitsInsideImePaddedColumnAfterScroll() {
        val body = src.substringAfter("private fun AuthScaffold(")
        val ime = body.indexOf(".imePadding()")
        val scroll = body.indexOf(".verticalScroll(")
        val bar = body.indexOf("bottomBar()")
        assertTrue(ime in 0 until scroll)
        assertTrue(scroll < bar)
    }
}
