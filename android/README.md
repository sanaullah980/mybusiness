# MyBusiness Android + Local Qwen3

The Android app loads the existing MyBusiness Vercel application in WebView and provides an optional native Qwen3-0.6B Q4_0 engine.

## Manual model installation

Qwen is **never downloaded automatically** by the APK.

1. Open MyBusiness and open **AI**.
2. Tap **Get Qwen Model** to open the official model URL in the device browser.
3. Download `Qwen3-0.6B-Q4_0.gguf` manually.
4. Return to MyBusiness and tap **Install Model**.
5. Pick the GGUF file from Android's document picker.
6. The APK copies it into private app storage, reports real byte progress, checks GGUF magic, size and SHA-256, then loads it locally.

The downloaded source file is never deleted. No root, ADB or manual Android folder access is required.

## Build

From the `android` directory:

```bat
.\gradlew.bat clean
.\gradlew.bat assembleDebug
```

APK: `app\build\outputs\apk\debug\app-debug.apk`
