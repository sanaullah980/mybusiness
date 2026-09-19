# MyBusiness Offline Qwen3 AI — implementation report

## What was changed
- Preserved the existing HTML/CSS/JS PWA and existing Firebase project/configuration.
- Added `web/modules/aiAgent.js` as an additional AI agent/controller.
- Added an AI floating entry point and chat/confirmation UI using the existing design variables.
- Added a strict central tool registry and validated tool execution layer.
- Added English/Roman Urdu/mixed-language handling through the local Qwen parser plus small deterministic fallback for browser-safe basic commands.
- Added Android wrapper under `android/` using a WebView for the existing PWA and a native JavaScript bridge for local Qwen inference.
- Added first-launch model download, resume support, file-size verification, SHA-256 verification, local storage, initialization, retry/error states, and offline inference.

## Model/runtime
- Model: Qwen3 0.6B GGUF, Q4_0.
- Model file: `Qwen3-0.6B-Q4_0.gguf`.
- Download size: 428,970,080 bytes (about 429 MB).
- SHA-256: `da2572f16c06133561ce56accaa822216f2391ef4d37fba427801cd6736417d4`.
- Runtime: `dev.ffmpegkit-maintained:llama-android:0.1.1` (prebuilt llama.cpp Android AAR, arm64-v8a).
- Context size: 2048 tokens in the Android bridge to keep memory use reasonable.
- Model is not bundled in the APK; it is downloaded once on first launch and stored under the app's model storage.

## AI tools
Read: search_products, get_product, get_low_stock_products, search_customers, get_customer_balance, search_suppliers, get_supplier_balance, get_today_sales, get_sales_summary, get_purchase_summary, get_cashbook_summary, get_expense_summary, get_stock_summary.

Write: add_product, update_product, add_stock, create_sale, create_credit_sale, receive_customer_payment, record_customer_credit, create_purchase, record_supplier_payment, record_expense.

Write actions require explicit Confirm/Cancel UI. No delete tool is exposed.

## Safety
- Qwen receives tool schemas, not unrestricted Firestore access.
- Tool arguments are validated in JavaScript before database operations.
- The model cannot execute generated JavaScript or arbitrary shell commands.
- Customer/product/supplier resolution rejects ambiguous matches rather than guessing.

## Browser/PWA behavior
The PWA remains intact. A normal browser cannot run this native Qwen runtime, so its AI panel explains that offline local AI is available in the Android app. Existing browser functionality remains separate from the native bridge.

## Android behavior
The Android wrapper loads the existing PWA assets locally and exposes `AndroidQwen` only to the WebView. First launch checks the local model, downloads it if needed, verifies it, initializes it once, and then serves inference locally. The model is never uploaded to Firebase.

## Build target
- Android min SDK: 24 (Android 7.0).
- Target/compile SDK: 35.
- Primary ABI supplied by the selected llama Android AAR: arm64-v8a.
- Debug APK expected at: `android/app/build/outputs/apk/debug/app-debug.apk`.
- Release APK expected at: `android/app/build/outputs/apk/release/app-release.apk`.

## Verification performed in this environment
- Inspected the complete supplied project file list and key business modules before integration.
- Confirmed existing non-AI project files were not modified except `index.html` and `style.css` for the additive AI UI/module.
- Ran JavaScript syntax checks across all existing and new JS modules successfully.
- Parsed the Android manifest/resources as XML successfully.
- Verified the model size and SHA-256 values are pinned in the native downloader.

## Not honestly completed here
A real Android Gradle build, APK install, physical-device inference test, Firebase live-data test, and airplane-mode device test could not be performed in this execution environment because Android SDK/ADB/Gradle are not installed and external Gradle dependency/model downloads are unavailable from the container. Therefore this package is **not being represented as a successfully built/tested APK**.

The Android project is intended to be opened in Android Studio on the build machine, where Gradle can resolve the AAR/dependencies and the APK can be built.
