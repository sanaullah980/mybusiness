# MyBusiness Flutter Web

The project is configured to build the Flutter Web application and deploy it to Vercel.

## Local build

```bash
flutter pub get
flutter build web --release --base-href /
```

Output: `build/web`

## Vercel

The repository includes `vercel.json` and `scripts/vercel-build.sh`. Vercel downloads the pinned Flutter SDK, runs `flutter pub get`, and builds `build/web`.

Use the project root as the Vercel project root. No Firebase Hosting setup is required.

## Firebase Web

The existing Firebase Web app configuration is in `lib/firebase_options.dart`. The Flutter Web build initializes Firebase with that configuration.

Make sure the deployed Vercel domain is added under Firebase Authentication > Settings > Authorized domains.

## Local persistence on Web

Flutter Web uses the browser's persistent storage backend implemented in `lib/data/local/app_database_web.dart`. Android continues to use SQLite through Drift. Both use the same repository and Firestore synchronization layer.

## AI

The local Qwen runtime is intentionally disabled on Web because the selected native llama.cpp runtime uses Dart FFI and is Android-only. No online AI API or mock model is used by the Web build.
