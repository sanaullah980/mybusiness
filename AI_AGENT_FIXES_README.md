# MyBusiness AI Agent Fixes

This build keeps the existing PWA, Firebase project, Firestore collections, and business data model.

## What changed

- Added `modules/ai-agent.js` as the deterministic local agent/tool layer.
- Updated `modules/ai.js` so common business commands are handled by the agent before Qwen.
- The agent can read and perform common operations for products/stock, customers/Khata, suppliers, expenses, and daily sales/profit summaries.
- Write operations ask for confirmation (`yes` / `no`) before changing business data.
- Existing Firestore helpers and existing collection names are used; no migration or destructive reset is performed.
- Qwen is retained as the local fallback for normal conversation and ambiguous requests.
- Reduced Qwen fallback output limit from 384 to 256 tokens to improve responsiveness on-device.
- Added `/no_think` to the Qwen fallback instruction to reduce unnecessary reasoning output.
- Google sign-in no longer falls back to `signInWithRedirect` inside the Android WebView. That redirect was the source of the reported `missing initial state` loop when popup storage was partitioned.
- In Android WebView, a storage-related Google login failure now gives a clear message and does not loop through redirect authentication. Email/password login remains available.

## Important Google sign-in limitation

The web Firebase Google popup flow is not a reliable native Android WebView authentication mechanism because Google/Firebase may partition temporary browser storage between the main WebView and popup. A fully native Google login requires registering the Android app in the Firebase project and adding native Google Sign-In configuration (including the correct OAuth client/SHA-1 setup). This ZIP does not invent those Firebase console credentials.

## Build validation

JavaScript syntax was checked locally. Android Gradle compilation could not be completed in the packaging environment because the Gradle wrapper needed to download Gradle 8.11 and external network access was unavailable. Run `gradlew.bat assembleDebug` on a machine with internet access before installing the APK.
