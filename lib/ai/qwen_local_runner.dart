import 'dart:io';

import 'package:flutter_mind/flutter_mind.dart' show Prompt;
import 'package:flutter_mind_local/flutter_mind_local.dart';
import 'package:path_provider/path_provider.dart';

import 'ai_prompt_templates.dart';
import 'ai_runtime.dart';

/// Real on-device Qwen runner. No network API is used for inference.
///
/// The model is intentionally not bundled in source control because a Q4
/// Qwen 1.5B GGUF is roughly 1 GB. Put the chosen GGUF at the returned model
/// path before using the assistant. The runtime is compiled locally by
/// flutter_mind_local/llama.cpp on Android.
class QwenLocalRunner implements AiModelRunner {
  QwenLocalRunner({this.modelFileName = 'qwen2-1.5b-instruct-q4_k_m.gguf'});

  final String modelFileName;
  LocalEngine? _engine;

  Future<String> _modelPath() async {
    final dir = await getApplicationDocumentsDirectory();
    return '${dir.path}/models/$modelFileName';
  }

  Future<LocalEngine> _getEngine() async {
    if (_engine != null) return _engine!;
    final path = await _modelPath();
    final file = File(path);
    if (!await file.exists()) {
      throw StateError(
        'Local Qwen model is not installed. Place $modelFileName in ${file.parent.path}. '
        'The AI assistant never sends prompts to an online API.',
      );
    }
    _engine = LocalEngine(
      config: LocalConfig(
        modelPath: path,
        modelType: LocalModelType.qwen,
        systemPrompt: Prompt(role: AiPromptTemplates.buildSystemPrompt()),
        temperature: 0.2,
        maxOutputTokens: 512,
        contextSize: 2048,
        threads: 4,
      ),
    );
    return _engine!;
  }

  @override
  Future<String> generateResponse(String prompt) async {
    final engine = await _getEngine();
    final response = await engine.send(userMessage: prompt);
    return response.text;
  }

  Future<void> dispose() async {
    _engine?.dispose();
    _engine = null;
  }
}
