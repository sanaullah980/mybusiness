# MyBusiness Android + Offline Qwen3

This Android wrapper preserves the existing HTML/CSS/JS PWA under `app/src/main/assets/web/` and adds a native `llama.cpp` bridge for Qwen3 0.6B Q4_0.

## Model
- Qwen3 0.6B Q4_0 GGUF from `ggml-org/Qwen3-0.6B-GGUF`
- Expected file size: 428,970,080 bytes
- SHA-256: `da2572f16c06133561ce56accaa822216f2391ef4d37fba427801cd6736417d4`
- First launch downloads automatically to app external files `models/`
- After verification and initialization, inference is local/offline.

## Build
Open the `android` folder in Android Studio, allow Gradle to download dependencies, then build:

`gradlew.bat assembleDebug`

APK: `app/build/outputs/apk/debug/app-debug.apk`

The native runtime is `dev.ffmpegkit-maintained:llama-android:0.1.1`, which provides a prebuilt arm64-v8a llama.cpp AAR.
