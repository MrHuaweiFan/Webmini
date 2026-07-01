# ─── App classes — keep everything in our package ──────────────────────
# The app uses reflection extensively (Hooker, proxies, PackageInstaller),
# so we keep all classes in com.webmini.app.** intact. R8 will still
# shrink the dependency libraries (Material, androidx, etc.).
-keep class com.webmini.app.** { *; }

# ─── @JavascriptInterface methods ─────────────────────────────────────
# WebView calls these by name from JavaScript. They must not be renamed.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── ContentProvider + BroadcastReceiver (declared in manifest) ───────
-keep class com.webmini.app.webview.DeveloperModeContentProvider { *; }
-keep class com.webmini.app.webview.UpdateInstallReceiver { *; }

# ─── Reflection targets in Hooker.java ────────────────────────────────
# These classes are loaded by name via Class.forName().
-keep class com.webmini.app.webview.IServiceManagerProxy { *; }
-keep class com.webmini.app.webview.IWebViewUpdateServiceProxy { *; }
-keep class com.webmini.app.webview.IPackageManagerProxy { *; }
-keep class com.webmini.app.webview.Hooker { *; }

# ─── Material Components ──────────────────────────────────────────────
# Material3 themes reference many attributes by reflection. Keep the
# styleable arrays so theme inflation doesn't crash.
-keep class com.google.android.material.R$styleable { *; }
-keep class com.google.android.material.R$attr { *; }
