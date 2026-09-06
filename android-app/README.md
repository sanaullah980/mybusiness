# MyBusiness Android — Hybrid Standalone App

This Android project is the permanent native shell for MyBusiness.

## Architecture

- The Android APK opens MyBusiness directly inside its own WebView. Chrome is not used to launch the app.
- The app is **remote-first**: the latest HTML/CSS/JavaScript is loaded from the Vercel deployment when online.
- The existing MyBusiness PWA service worker and WebView storage keep the app available offline after the first successful online launch.
- Firestore persistent local cache keeps previously synchronized business data available locally and queues supported writes for synchronization when connectivity returns.
- Because normal web code comes from Vercel, **HTML/CSS/JavaScript feature updates do not require a new APK**. Deploy those changes to Vercel and the installed Android shell can receive them.
- A new APK is only needed for Android-native changes (native authentication, permissions, package/icon changes, native bridges, etc.).

## Build

1. Open `android-app` in Android Studio.
2. Let Gradle sync and install any requested Android SDK components.
3. Connect your physical Android phone with USB debugging enabled. The emulator is not required.
4. Choose **Build > Build APK(s)**.
5. The debug APK will be under `app/build/outputs/apk/debug/`.

## Updating the app without rebuilding the APK

For normal application changes:

1. Edit the web project (`index.html`, `style.css`, `app.js`, `modules/*.js`, service worker, etc.).
2. Commit/push the changes to GitHub.
3. Deploy the web project to the same Vercel URL: `https://mybusiness-green.vercel.app/`.
4. Open MyBusiness while online. The Android shell loads the latest web version and the service worker updates its cache.
5. Close and reopen the app if needed.

You do **not** need to rebuild/reinstall the APK for ordinary web changes.

## Offline behavior

The first installation/first successful launch needs internet so the hosted app, Firebase modules and authentication resources can be obtained. After that, the service worker/WebView cache and Firestore persistence provide the offline experience.

For a completely first-launch-offline application with no hosted dependency at all, the web assets and Firebase SDK would need to be bundled locally and the authentication flow would need a native Android implementation. That is a separate deeper architecture change.
