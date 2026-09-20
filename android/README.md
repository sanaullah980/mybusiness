# MyBusiness Android + Local Qwen3

Native Android Studio wrapper for the existing HTML/CSS/JS MyBusiness PWA.

## Build
Open the `android` folder in Android Studio and let Gradle sync. Build with **Build > Build APK(s)**.

The app uses WebView for the existing PWA and llama.cpp through the `llama-android` AAR for local GGUF inference. Qwen3-0.6B Q4_0 is downloaded once on first launch into app-private model storage, verified by SHA-256, then loaded locally. After that, AI inference does not require internet.

The model is intentionally not copied into this ZIP because the model is ~429 MB and the current build environment cannot retrieve the binary. The APK project contains the automatic first-launch installer, so the user does not manually install the model.

## AI
- Qwen3 0.6B Q4_0
- llama.cpp
- No Ollama
- No cloud inference
- WebView JavaScript bridge exposes only `AndroidAI.ask()` and `AndroidAI.status()`
- AI actions are validated in `ai-agent.js`
- Write actions require confirmation

## Important
Firebase remains the existing web configuration. Initial authentication/data sync can still require internet; local Qwen inference does not.

For a fully bundled APK with no first-launch model download, place the verified Qwen3 GGUF at `app/src/main/assets/models/Qwen3-0.6B-Q4_0.gguf` before building and change `LocalAi.prepare()` to copy that asset into app-private storage. This is optional; the provided project uses automatic first-launch download.
