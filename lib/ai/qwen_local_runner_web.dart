import 'ai_runtime.dart';

/// Web builds keep the AI interface but do not call a cloud model.
/// The current Qwen Flutter runtime targets Android/iOS/macOS; browser Qwen
/// inference needs a WASM-specific runtime and model artifact, so this build
/// reports the capability accurately instead of silently using a mock model.
class QwenLocalRunner implements AiModelRunner {
  @override
  Future<String> generateResponse(String prompt) async {
    throw UnsupportedError(
      'Local Qwen inference is currently available in the Android build. '
      'Web AI is disabled rather than using an online API or mock model.',
    );
  }
}
