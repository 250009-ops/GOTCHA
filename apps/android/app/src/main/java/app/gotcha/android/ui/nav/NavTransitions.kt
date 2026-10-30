package app.gotcha.android.ui.nav

import androidx.compose.animation.AnimatedContentScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.runtime.Composable
import androidx.navigation.NamedNavArgument
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable

private const val SheetAnimMs = 280
private const val FadeAnimMs = 150

/** Short cross-fade for bottom-nav tab switches (UI-12): Home, Library, Words, Progress, Profile. */
fun NavGraphBuilder.learnerTabComposable(
    route: String,
    content: @Composable AnimatedContentScope.(NavBackStackEntry) -> Unit,
) {
    composable(
        route = route,
        enterTransition = { fadeIn(tween(FadeAnimMs)) },
        exitTransition = { fadeOut(tween(FadeAnimMs / 2)) },
        popEnterTransition = { fadeIn(tween(FadeAnimMs)) },
        popExitTransition = { fadeOut(tween(FadeAnimMs / 2)) },
        content = content,
    )
}

/** Slide + fade for learner secondary routes (messages, settings, detail screens). */
fun NavGraphBuilder.learnerSlideComposable(
    route: String,
    arguments: List<NamedNavArgument> = emptyList(),
    content: @Composable AnimatedContentScope.(NavBackStackEntry) -> Unit,
) {
    composable(
        route = route,
        arguments = arguments,
        enterTransition = {
            fadeIn(tween(FadeAnimMs)) + slideInHorizontally(
                initialOffsetX = { it / 6 },
                animationSpec = tween(FadeAnimMs),
            )
        },
        exitTransition = { fadeOut(tween(FadeAnimMs / 2)) },
        popEnterTransition = { fadeIn(tween(FadeAnimMs / 2)) },
        popExitTransition = {
            fadeOut(tween(FadeAnimMs)) + slideOutHorizontally(
                targetOffsetX = { it / 6 },
                animationSpec = tween(FadeAnimMs),
            )
        },
        content = content,
    )
}

/** Slide up from bottom — import sheet and similar overlays without heavy scrim. */
fun NavGraphBuilder.slideUpSheetComposable(
    route: String,
    content: @Composable AnimatedContentScope.(NavBackStackEntry) -> Unit,
) {
    composable(
        route = route,
        enterTransition = {
            slideInVertically(initialOffsetY = { it }, animationSpec = tween(SheetAnimMs)) +
                fadeIn(tween(SheetAnimMs))
        },
        exitTransition = {
            fadeOut(tween(SheetAnimMs / 2))
        },
        popEnterTransition = {
            fadeIn(tween(SheetAnimMs / 2))
        },
        popExitTransition = {
            slideOutVertically(targetOffsetY = { it }, animationSpec = tween(SheetAnimMs)) +
                fadeOut(tween(SheetAnimMs))
        },
        content = content,
    )
}

/** Reader / full-screen flows pushed from root nav. */
fun NavGraphBuilder.rootSlideComposable(
    route: String,
    arguments: List<NamedNavArgument> = emptyList(),
    content: @Composable AnimatedContentScope.(NavBackStackEntry) -> Unit,
) {
    composable(
        route = route,
        arguments = arguments,
        enterTransition = { fadeIn(tween(FadeAnimMs)) },
        exitTransition = { fadeOut(tween(FadeAnimMs / 2)) },
        popEnterTransition = { fadeIn(tween(FadeAnimMs / 2)) },
        popExitTransition = { fadeOut(tween(FadeAnimMs)) },
        content = content,
    )
}
