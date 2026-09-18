# MyBusiness Flutter

MyBusiness is an offline-first shop/Khata application. This project is now a Flutter application; the old vanilla-JS/Vite application files have been removed from the runtime tree so they cannot conflict with Flutter web deployment.

## Local setup

```bash
flutter pub get
flutter run
```

Android release/debug APK:

```bash
flutter build apk
```

Web:

```bash
flutter build web --release
```

## Firebase

The app uses the existing Firebase project `mybusinessapp-4734c`. Firestore collection names and the existing ownerId-based data model are preserved. Do not create a new Firebase project.

For Android Google Sign-In, register package `com.mybusiness.pos` in the existing Firebase project and add the SHA-1/SHA-256 fingerprints for the signing key, then replace `android/app/google-services.json` with the file downloaded from that same Firebase project.

## Local-first storage

- Android/native: persistent SQLite through Drift's `NativeDatabase`.
- Web: persistent browser storage using SharedPreferences because browser builds do not expose a native SQLite file.
- Every local mutation is saved before cloud synchronization is attempted.
- Pending writes are retried by the repository sync path.

## Offline Qwen

The AI assistant is wired to `flutter_mind_local`/llama.cpp and does not call an online AI API. A Qwen GGUF model is intentionally not bundled because it is a large binary. For Android, place a compatible Qwen 1.5B GGUF at the app documents `models/` path using the filename configured in `QwenLocalRunner`.

Bill OCR is intentionally not part of this Flutter build yet.

## Vercel

`vercel.json` builds Flutter Web into `build/web`. The build script installs the pinned Flutter SDK in the Vercel build environment, runs `flutter pub get`, and builds the release web bundle.
