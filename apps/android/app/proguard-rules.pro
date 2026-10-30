# Gotcha Android — Retrofit + Kotlinx serialization keep rules for release minify.

-keepattributes *Annotation*, InnerClasses, Signature, Exception
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-dontwarn kotlinx.serialization.**
-dontwarn org.jetbrains.annotations.**

-keep class app.gotcha.android.BuildConfig { *; }
-keep class app.gotcha.android.GotchaApp { *; }
-keep class app.gotcha.android.MainActivity { *; }

-keep @kotlinx.serialization.Serializable class * { *; }
-keepclassmembers class **$$serializer { *; }
-keepclassmembers class app.gotcha.android.data.model.** {
    *** Companion;
}
-keepclasseswithmembers class app.gotcha.android.data.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}

-keep interface app.gotcha.android.data.api.GotchaApi { *; }
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
-dontwarn retrofit2.**
-dontwarn okhttp3.**
-dontwarn okio.**

-keep class kotlinx.serialization.json.** { *; }
