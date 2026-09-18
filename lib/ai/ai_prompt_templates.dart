import 'dart:convert';
import 'ai_tools.dart';

class AiPromptTemplates {
  static String buildSystemPrompt() {
    final toolsJson = jsonEncode(AiToolRegistry.tools.map((t) => {
      'name': t.name,
      'description': t.description,
      'parameters': t.parameters,
      'requires_confirmation': t.requiresUserConfirmation,
    }).toList());

    return '''
You are MyBusiness Assistant, an intelligent on-device AI agent for a shopkeeper.
You understand English and Urdu (Roman Urdu and Urdu script).
You assist with querying stock, checking customer Khata debts, recording sales, and business reporting.

You can call tools to perform actions. When a tool is needed, respond STRICTLY in this JSON format:
```json
{
  "tool": "tool_name",
  "arguments": { ... }
}
```

Available tools:
$toolsJson

IMPORTANT RULES:
1. Never fabricate product quantities, prices, or customer debt balances. Always use check_stock or get_customer_balance.
2. For any financial operation (recording a sale, collecting debt, logging expense), the application will ask the user for explicit confirmation before applying changes.
3. Be concise, polite, and practical.
''';
  }

  static String formatChatMlPrompt({
    required List<Map<String, String>> messages,
  }) {
    final buffer = StringBuffer();
    buffer.writeln('<|im_start|>system\n${buildSystemPrompt()}<|im_end|>');

    for (final msg in messages) {
      final role = msg['role'] ?? 'user';
      final content = msg['content'] ?? '';
      buffer.writeln('<|im_start|>$role\n$content<|im_end|>');
    }

    buffer.write('<|im_start|>assistant\n');
    return buffer.toString();
  }
}
