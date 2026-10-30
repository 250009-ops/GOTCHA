package app.gotcha.android

import android.app.Application
import app.gotcha.android.di.AppContainer

class GotchaApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        // M1: initialise the in-app language before any Activity (incl. ImportTrampolineActivity) builds strings.
        app.gotcha.android.ui.theme.AppUiPrefs.init(this)
        container = AppContainer(this)
    }
}
