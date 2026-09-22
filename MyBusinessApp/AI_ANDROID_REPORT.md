# MyBusiness Android + Qwen3 0.6B

## Architecture

- The existing MyBusiness frontend remains HTML/CSS/JavaScript on Vercel.
- Android loads `https://mybusiness-green.vercel.app/` in WebView.
- The AI screen and chat UI are implemented in the Vercel frontend.
- Android exposes `AndroidAI` only as the native bridge for model status, manual file import, model loading and local inference.
- The GGUF model is stored only in private Android app storage.

## Model

- Qwen3 0.6B Q4_0
- File: `Qwen3-0.6B-Q4_0.gguf`
- Expected SHA-256: `da2572f16c06133561ce56accaa822216f2391ef4d37fba427801cd6736417d4`
- Approximate size: 429 MB

## Manual installation

There is **no automatic Qwen download anywhere in the APK**.

The user opens the AI page, taps **Get Qwen Model**, downloads the GGUF manually in the device browser, returns to MyBusiness, taps **Install Model**, and selects the file through Android's Storage Access Framework.

The selected file is copied to a temporary private file, checked for GGUF magic, reasonable size and the expected SHA-256, and loaded before the existing model is replaced. A verified working model is therefore retained if the new import fails.

## Runtime

- The main MyBusiness startup never waits for Qwen.
- Qwen is loaded only when the AI page requests it.
- Inference is performed locally through the existing `llama-android` dependency.
- No cloud AI API is used.
- Once installed, inference does not require internet access.

## WebView stability

- JavaScript and DOM storage remain enabled.
- Cookies and third-party cookies remain enabled for Firebase web authentication.
- Google popup windows are supported by a contained WebView dialog.
- Qwen failures are isolated from the main app page.
- Android window insets are applied to the WebView so the Vercel header does not sit underneath the status bar.
- Vercel CSS uses safe-area-aware spacing for fixed UI.
