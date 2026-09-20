# MyBusiness Android + Qwen3 0.6B report

## Target
Android Studio APK, without Flutter. Existing HTML/CSS/JS PWA is embedded locally in Android WebView.

## Local AI
- Model: Qwen3 0.6B
- Quantization: GGUF Q4_0
- Model source: ggml-org/Qwen3-0.6B-GGUF
- SHA-256: da2572f16c06133561ce56accaa822216f2391ef4d37fba427801cd6736417d4
- Approximate model file size: 429 MB
- Runtime: llama.cpp Android AAR 0.1.1, CPU/NEON, arm64-v8a
- Minimum SDK: 24
- Context: 2048 tokens initially, configurable in MainActivity

## Model installation
The project automatically downloads the model on first launch, supports resume when the server supplies HTTP Range, verifies SHA-256, then stores it in app-private external-files model storage. The model is loaded once and reused. Subsequent AI inference is local and does not call an AI server.

The 429 MB GGUF binary is not included in this ZIP because the current build environment could not retrieve the binary. Therefore this ZIP is the complete Android source/integration, but it is not a claim that a zero-download bundled-model APK was produced here.

## AI tools
Implemented adapters for product/customer/supplier search and balances, low stock, sales/purchases/expenses summaries, stock summary, customer payment, customer credit, stock addition, product add/update, simple product sale, expense, supplier payment.

Writes require confirmation in the AI UI. Tool arguments are validated in JavaScript before Firestore operations. Qwen never receives unrestricted Firebase access and never executes generated JavaScript.

## Existing app preservation
The original root PWA files are retained. The Android project contains a copy of the PWA under `android/app/src/main/assets/web/` and loads it with AndroidX WebViewAssetLoader.

## Testing performed here
- Original ZIP inspected.
- Android project structure generated.
- AI JavaScript syntax checked with Node.js.
- Existing app.js syntax checked with Node.js.
- Qwen model checksum recorded from the official GGUF listing.

## Not verified here
- Android Studio Gradle build (Android SDK/Gradle dependencies are unavailable in this environment).
- Physical-device WebView authentication.
- Physical-device Qwen inference.
- Offline Firebase behavior.

Do not describe those items as tested until the APK is built and installed on the target phone.
