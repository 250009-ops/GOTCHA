package app.gotcha.android.ui.nav

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.gotcha.android.AuthDeepLink
import app.gotcha.android.LocalAppContainer
import app.gotcha.android.PendingAuthDeepLink
import app.gotcha.android.PendingReaderNavigation
import app.gotcha.android.ui.admin.AdminShell
import app.gotcha.android.ui.auth.ForgotPasswordScreen
import app.gotcha.android.ui.auth.ResetPasswordFromLinkScreen
import app.gotcha.android.ui.auth.SignInScreen
import app.gotcha.android.ui.auth.SignUpScreen
import app.gotcha.android.ui.auth.VerifyEmailFromLinkScreen
import app.gotcha.android.ui.learner.ImportScreen
import app.gotcha.android.ui.learner.LearnerShell
import app.gotcha.android.ui.learner.PracticeScreen
import app.gotcha.android.ui.learner.ReaderScreen
import app.gotcha.android.ui.nav.rootSlideComposable
import app.gotcha.android.ui.nav.slideUpSheetComposable
import app.gotcha.android.ui.onboarding.OnboardingScreen
import app.gotcha.android.ui.onboarding.SplashScreen
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

object Routes {
    const val Splash = "splash"
    const val Onboarding = "onboarding"
    const val SignIn = "sign_in"
    const val SignUp = "sign_up"
    const val ForgotPassword = "forgot_password"
    const val VerifyEmail = "verify_email?token={token}"
    const val ResetPassword = "reset_password?token={token}"
    const val Learner = "learner"
    const val Admin = "admin"
    const val Reader = "reader/{contentId}"
    const val Practice = "practice?contentId={contentId}&segmentId={segmentId}"
    const val Import = "import"
    const val ImportUrl = "import_url"
    const val ImportPaste = "import_paste"
    const val ImportFile = "import_file"
    fun verifyEmail(token: String) = "verify_email?token=${android.net.Uri.encode(token)}"
    fun resetPassword(token: String) = "reset_password?token=${android.net.Uri.encode(token)}"
    fun reader(id: String) = "reader/$id"
    fun practice(contentId: String?, segmentId: String?) =
        "practice?contentId=${contentId.orEmpty()}&segmentId=${segmentId.orEmpty()}"
}

@Composable
fun GotchaNavHost() {
    val nav = rememberNavController()
    val container = LocalAppContainer.current
    val scope = rememberCoroutineScope()
    var bootstrapped by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { bootstrapped = true }

    LaunchedEffect(Unit) {
        container.sessionExpired.collectLatest {
            container.endSession()
            nav.navigate(Routes.SignIn) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    // QA deep-open reader: adb … --es navigate_reader "<id>" | --es navigate_route "reader/<id>"
    LaunchedEffect(Unit) {
        PendingReaderNavigation.collectLatest { id ->
            if (!id.isNullOrBlank()) {
                PendingReaderNavigation.value = null
                nav.navigate(Routes.reader(id)) { launchSingleTop = true }
            }
        }
    }

    LaunchedEffect(Unit) {
        PendingAuthDeepLink.collectLatest { link ->
            if (link == null) return@collectLatest
            PendingAuthDeepLink.value = null
            container.endSession()
            val dest = when (link) {
                is AuthDeepLink.VerifyEmail -> Routes.verifyEmail(link.token)
                is AuthDeepLink.ResetPassword -> Routes.resetPassword(link.token)
            }
            nav.navigate(dest) {
                popUpTo(Routes.Splash) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    NavHost(navController = nav, startDestination = Routes.Splash) {
        composable(Routes.Splash) {
            SplashScreen { loggedIn, isAdmin, onboardingDone ->
                val pending = PendingAuthDeepLink.value
                if (pending != null) {
                    PendingAuthDeepLink.value = null
                    scope.launch {
                        container.endSession()
                        val dest = when (pending) {
                            is AuthDeepLink.VerifyEmail -> Routes.verifyEmail(pending.token)
                            is AuthDeepLink.ResetPassword -> Routes.resetPassword(pending.token)
                        }
                        nav.navigate(dest) {
                            popUpTo(Routes.Splash) { inclusive = true }
                            launchSingleTop = true
                        }
                    }
                    return@SplashScreen
                }
                if (nav.currentBackStackEntry?.destination?.route != Routes.Splash) {
                    return@SplashScreen
                }
                val dest = when {
                    !onboardingDone -> Routes.Onboarding
                    !loggedIn -> Routes.SignIn
                    isAdmin -> Routes.Admin
                    else -> Routes.Learner
                }
                nav.navigate(dest) { popUpTo(Routes.Splash) { inclusive = true } }
            }
        }
        composable(Routes.Onboarding) {
            OnboardingScreen {
                nav.navigate(Routes.SignIn) { popUpTo(Routes.Onboarding) { inclusive = true } }
            }
        }
        composable(Routes.SignIn) {
            SignInScreen(
                onSignedIn = { isAdmin ->
                    nav.navigate(if (isAdmin) Routes.Admin else Routes.Learner) {
                        popUpTo(Routes.SignIn) { inclusive = true }
                    }
                },
                onGoSignUp = { nav.navigate(Routes.SignUp) },
                onForgotPassword = { nav.navigate(Routes.ForgotPassword) },
            )
        }
        composable(Routes.SignUp) {
            SignUpScreen(
                onSignedUp = { isAdmin ->
                    nav.navigate(if (isAdmin) Routes.Admin else Routes.Learner) {
                        popUpTo(Routes.SignIn) { inclusive = true }
                    }
                },
                onGoSignIn = { nav.popBackStack() },
            )
        }
        composable(Routes.ForgotPassword) {
            ForgotPasswordScreen(onBack = { nav.popBackStack() })
        }
        composable(
            Routes.VerifyEmail,
            arguments = listOf(navArgument("token") { type = NavType.StringType; defaultValue = "" }),
        ) { entry ->
            VerifyEmailFromLinkScreen(
                token = entry.arguments?.getString("token").orEmpty(),
                onDone = {
                    nav.navigate(Routes.SignIn) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
        composable(
            Routes.ResetPassword,
            arguments = listOf(navArgument("token") { type = NavType.StringType; defaultValue = "" }),
        ) { entry ->
            ResetPasswordFromLinkScreen(
                token = entry.arguments?.getString("token").orEmpty(),
                onDone = {
                    nav.navigate(Routes.SignIn) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.Learner) {
            LearnerShell(
                onOpenReader = { id -> nav.navigate(Routes.reader(id)) },
                onOpenImport = { nav.navigate(Routes.Import) },
                onOpenPractice = { nav.navigate(Routes.practice(null, null)) },
                onOpenImportUrl = { nav.navigate(Routes.ImportUrl) },
                onOpenImportPaste = { nav.navigate(Routes.ImportPaste) },
                onOpenImportFile = { nav.navigate(Routes.ImportFile) },
                onLogout = {
                    scope.launch {
                        container.endSession()
                        nav.navigate(Routes.SignIn) { popUpTo(0) { inclusive = true } }
                    }
                },
                onOpenAdmin = {
                    nav.navigate(Routes.Admin)
                },
            )
        }
        composable(Routes.Admin) {
            AdminShell(
                onBackToLearner = {
                    nav.navigate(Routes.Learner) {
                        popUpTo(Routes.Admin) { inclusive = true }
                    }
                },
                onLogout = {
                    scope.launch {
                        container.endSession()
                        nav.navigate(Routes.SignIn) { popUpTo(0) { inclusive = true } }
                    }
                },
            )
        }
        rootSlideComposable(
            Routes.Reader,
            arguments = listOf(navArgument("contentId") { type = NavType.StringType }),
        ) { entry ->
            val id = entry.arguments?.getString("contentId") ?: return@rootSlideComposable
            ReaderScreen(
                contentId = id,
                onBack = { nav.popBackStack() },
                onOpenPractice = { contentId, segmentId ->
                    nav.navigate(Routes.practice(contentId, segmentId))
                },
            )
        }
        rootSlideComposable(
            Routes.Practice,
            arguments = listOf(
                navArgument("contentId") { type = NavType.StringType; nullable = true; defaultValue = null },
                navArgument("segmentId") { type = NavType.StringType; nullable = true; defaultValue = null },
            ),
        ) { entry ->
            val contentId = entry.arguments?.getString("contentId")?.takeIf { it.isNotBlank() }
            val segmentId = entry.arguments?.getString("segmentId")?.takeIf { it.isNotBlank() }
            PracticeScreen(
                contentId = contentId,
                segmentId = segmentId,
                onBack = { nav.popBackStack() },
            )
        }
        slideUpSheetComposable(Routes.Import) {
            ImportScreen(
                onClose = { nav.popBackStack() },
                // Import opens from Library FAB — pop returns to Learner on the Library tab.
                onBrowseCatalog = { nav.popBackStack() },
                onOpenUrl = { nav.navigate(Routes.ImportUrl) },
                onOpenPaste = { nav.navigate(Routes.ImportPaste) },
                onOpenFile = { nav.navigate(Routes.ImportFile) },
                onRead = { id -> nav.navigate(Routes.reader(id)) },
            )
        }
        rootSlideComposable(Routes.ImportUrl) {
            app.gotcha.android.ui.learner.ImportUrlScreen(
                onBack = { nav.popBackStack() },
                onImported = {
                    nav.popBackStack()
                    nav.popBackStack(Routes.Import, inclusive = true)
                },
            )
        }
        rootSlideComposable(Routes.ImportPaste) {
            app.gotcha.android.ui.learner.PasteTextScreen(
                onBack = { nav.popBackStack() },
                onImported = {
                    nav.popBackStack()
                    nav.popBackStack(Routes.Import, inclusive = true)
                },
            )
        }
        rootSlideComposable(Routes.ImportFile) {
            app.gotcha.android.ui.learner.ImportFileScreen(
                onBack = { nav.popBackStack() },
                onImported = {
                    nav.popBackStack()
                    nav.popBackStack(Routes.Import, inclusive = true)
                },
            )
        }
    }

    // Keep container referenced so session helpers stay hot-path ready.
    if (bootstrapped) {
        @Suppress("UNUSED_EXPRESSION")
        container
    }
}
