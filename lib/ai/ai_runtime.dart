import 'dart:convert';
import 'ai_tools.dart';

abstract class AiModelRunner {
  Future<String> generateResponse(String prompt);
}

class LocalAiAgent {
  final AiModelRunner runner;

  LocalAiAgent({required this.runner});

  /// Processes user query through Qwen 1.7B and detects any tool call
  Future<AiToolCall?> parseToolFromResponse(String responseText) async {
    try {
      final jsonMatch = RegExp(r'\{[\s\S]*"tool"[\s\S]*\}').firstMatch(responseText);
      if (jsonMatch == null) return null;

      final jsonStr = jsonMatch.group(0)!;
      final parsed = jsonDecode(jsonStr) as Map<String, dynamic>;
      final toolName = parsed['tool'] as String;
      final args = (parsed['arguments'] as Map<String, dynamic>?) ?? {};

      final definition = AiToolRegistry.tools.firstWhere(
        (t) => t.name == toolName,
        orElse: () => throw Exception('Tool $toolName not found'),
      );

      final summary = _generateSummary(toolName, args);

      return AiToolCall(
        toolName: toolName,
        arguments: args,
        requiresConfirmation: definition.requiresUserConfirmation,
        humanReadableSummary: summary,
      );
    } catch (_) {
      return null;
    }
  }

  String _generateSummary(String toolName, Map<String, dynamic> args) {
    switch (toolName) {
      case 'check_stock':
        return 'Check stock for "${args['product_name']}"';
      case 'get_customer_balance':
        return 'Check Khata balance for "${args['customer_name']}"';
      case 'record_sale':
        return 'Record a ${args['sale_type']} sale for ${args['customer_name'] ?? 'Walk-in'} with amount paid Rs. ${args['amount_paid']}.';
      case 'record_customer_payment':
        return 'Collect Rs. ${args['amount']} from ${args['customer_name']}.';
      case 'check_daily_report':
        return 'View daily business summary.';
      case 'add_expense':
        return 'Add expense of Rs. ${args['amount']} under "${args['category']}".';
      default:
        return 'Execute $toolName with parameters: $args';
    }
  }
}
