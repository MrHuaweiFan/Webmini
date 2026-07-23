# Webmini

An Android app that wraps [Gemini](https://gemini.google.com/app) in a WebView, with extras:

- **Adaptive icon** — the Gemini zodiac symbol filled with a yellow→red→blue→green gradient, on a white background. A trademark-safe knockoff: the glyph is a public-domain astrology symbol, not the proprietary Gemini sparkle.
- **Material 3 theme** with light/dark mode support
- **Navbar color** adapts to device type + orientation + theme:
  - Dark mode: `#0F0F0F` on tablet landscape (desktop-style layout), OLED black `#000000` elsewhere
  - Light mode: `#FDFCFC` everywhere (matches the web light surface)
- **Loading screen** with the Webmini logo that fades out smoothly after first page load
- **Blob: URL download support** — downloads code files, images, and other attachments that use `blob:` URLs (including `blob:null/...` from sandboxed iframes) via `WebViewCompat.addDocumentStartJavaScript`
- **Long-press image menu** with Share / Download options (downloads the preview image — see warning in the dialog)
- **Share-to-Webmini** — share text or files from other apps directly into the wrapped site
- **Hidden Settings menu** with:
  - WebView switcher (pick which WebView implementation to use — Thorium recommended)
  - Desktop mode toggle
  - Performance optimizations (GPU blocklist bypass, surface control)
  - Update checker

> **Webmini is an independent, unofficial client.** It is not affiliated with, endorsed by, or sponsored by Google. The Webmini name, icon (the Gemini zodiac glyph with a gradient fill), and source code are this project's own — they do not use the Gemini trademark or the proprietary Gemini sparkle logo. Webmini simply loads the public `gemini.google.com` website inside an Android WebView, the same way any general-purpose browser would.

## Build

### Prerequisites

- JDK 17+ (JDK 21 tested)
- Android SDK with `platforms;android-34` and `build-tools;34.0.0`
- AndroidX WebView 1.12+ (for `addDocumentStartJavaScript` blob capture support)

### Build commands

```bash
# Set SDK location
echo "sdk.dir=$HOME/Android/Sdk" > local.properties

# Build release APK (signed with bundled test.keystore)
./gradlew assembleRelease

# APK lands in app/build/outputs/apk/release/app-release.apk
```

### Debug build

```bash
./gradlew assembleDebug
# APK lands in app/build/outputs/apk/debug/app-debug.apk
```

## How blob: URL downloads work

Android WebView's `DownloadListener` only gives Java a URL string. For `blob:` URLs (especially `blob:null/...` created in sandboxed iframes), Java can't fetch the blob directly. This app uses `WebViewCompat.addDocumentStartJavaScript` (androidx.webkit 1.12+) to inject a blob-capture script into **every frame** at document creation time. The script:

1. Overrides `URL.createObjectURL` in every frame (main + all iframes, including sandboxed null-origin ones)
2. Eagerly reads each blob via `FileReader.readAsDataURL` at creation time (before the page can revoke the URL)
3. Main frame stores blob data in `window.__blobRefs`
4. Iframes send blob data to parent via `postMessage` (works cross-origin)
5. When the `DownloadListener` fires, the download interceptor checks `__blobRefs` first, then falls back to `fetch()`

See `app/src/main/assets/blob_capture.js` and `app/src/main/assets/download_interceptor.js` for the implementation.

## Updates

The in-app **Check for updates** button queries the GitHub releases API for this repository:

```
https://api.github.com/repos/MrHuaweiFan/Webmini/releases
```

When a newer release is found, the app opens the release's download page in the user's default browser. If you fork this repo, update `REPO_API` and `USER_AGENT` in `app/src/main/java/com/webmini/app/webview/UpdateChecker.java` to point at your own releases.

## Customization

- **Web URL**: edit `URL` in `app/src/main/java/com/webmini/app/MainActivity.java`
- **App name**: edit `app_name` in `app/src/main/res/values/strings.xml`
- **App icon**: edit `app/src/main/res/drawable/ic_launcher_foreground.xml` (vector drawable with gradient) and regenerate the PNG fallbacks, or just replace the `ic_launcher.png` files under `app/src/main/res/mipmap-*/`
- **Version**: edit `versionCode` / `versionName` in `app/build.gradle`

## Credits

Based on [WebGPT](https://github.com/MrHuaweiFan/WebGPT).

## License

Webmini is free software released under the **MIT License** — see [LICENSE](LICENSE) for the full text. The Webmini name and icon are this project's own and do not infringe any third-party trademark. "Gemini" is a trademark of Google LLC; this project is not affiliated with Google and merely loads the public `gemini.google.com` website inside an Android WebView.

## F-Droid metadata

The repository ships F-Droid / Fastlane upstream metadata so the app's
listing (description, icon, screenshots, changelog) is under direct
control of the developer:

```
fastlane/metadata/android/en-US/
├── short_description.txt        (≤ 80 chars, no trailing dot)
├── full_description.txt
├── changelogs/
│   └── 22.txt                   (max 500 chars; 22 = versionCode)
└── images/
    ├── icon.png                 (512×512 PNG)
    ├── phoneScreenshots/        (1.png … 5.png)
    └── sevenInchScreenshots/    (1.png)
```

See [Submitting to F-Droid — Quick Start Guide](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/)
for the official spec.

Gemini WebApp for Android repo is now private to avoid any brand infringement.
