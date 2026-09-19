# MyBusiness PWA — Browser-local Qwen3 0.6B

This build targets the browser/PWA only. There is no Android project and no native AI bridge.

## Runtime
- Model: Qwen3 0.6B
- Browser format: ONNX q4f16 through Transformers.js
- Runtime: Hugging Face Transformers.js + WebGPU
- Model repository: onnx-community/Qwen3-0.6B-ONNX
- Approximate q4f16 model file: 570 MB
- First use downloads/caches the model in the browser; subsequent inference is local.
- WebGPU is required for the primary path. The app clearly reports when it is unavailable.

## Agent safety
- Central allow-listed tool registry.
- Qwen only emits JSON tool requests.
- Application validates tool name and required arguments.
- Customer/product/supplier resolution rejects ambiguous matches.
- Write operations require Confirm/Cancel.
- No arbitrary JavaScript from model output.
- No direct model access to Firestore credentials.

## PWA/Vercel
- `index.html` is at the project root, so Vercel can serve it directly.
- No Vercel Root Directory setting is required when this folder is the repository root.
- Service worker caches the application shell and Transformers.js runtime.
- Model weights are cached by the browser runtime rather than stored in Firebase/Firestore.

## Important limitation
Browser local AI depends on browser WebGPU and available device memory. Recent Chrome/Edge are the intended browsers. The model download is roughly 570 MB for the q4f16 ONNX file, not the smaller Android GGUF package.

## Verification
- Existing source tree preserved from the supplied PWA.
- Browser AI module replaces the previous Android-only AI bridge.
- Root `index.html` and Vercel configuration are included.
- No claim is made that live Vercel deployment or physical-browser WebGPU inference was executed in this environment.
