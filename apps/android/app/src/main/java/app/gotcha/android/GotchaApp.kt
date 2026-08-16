package app.gotcha.android

import android.app.Application
import app.gotcha.android.di.AppContainer

class GotchaApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
