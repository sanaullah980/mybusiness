import 'package:flutter/material.dart';
import '../../../ai/ai_confirmation_dialog.dart';
import '../../../ai/ai_runtime.dart';
import '../../../ai/ai_tools.dart';
import '../../../core/constants/colors.dart';

import '../../../ai/qwen_runner.dart';

class AiAssistantScreen extends StatefulWidget {
  final Future<String> Function(AiToolCall toolCall) onExecuteTool;

  const AiAssistantScreen({super.key, required this.onExecuteTool});

  @override
  State<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _AiAssistantScreenState extends State<AiAssistantScreen> {
  final TextEditingController _msgCtrl = TextEditingController();
  final List<Map<String, String>> _messages = [
    {
      'role': 'assistant',
      'content': 'Assalam-o-Alaikum! I am your shop assistant. Ask me anything about stock, customer Khata, or sales.'
    }
  ];
  late final LocalAiAgent _agent;
  bool _isBusy = false;

  @override
  void initState() {
    super.initState();
    _agent = LocalAiAgent(runner: QwenLocalRunner());
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSend() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty) return;

    _msgCtrl.clear();
    setState(() {
      _messages.add({'role': 'user', 'content': text});
      _isBusy = true;
    });

    try {
      final responseText = await _agent.runner.generateResponse(text);
      final toolCall = await _agent.parseToolFromResponse(responseText);

      if (toolCall != null) {
        if (toolCall.requiresConfirmation) {
          if (!mounted) return;
          showDialog(
            context: context,
            builder: (_) => AiConfirmationDialog(
              toolCall: toolCall,
              onConfirm: () async {
                setState(() => _isBusy = true);
                final executionResult = await widget.onExecuteTool(toolCall);
                setState(() {
                  _messages.add({
                    'role': 'assistant',
                    'content': 'Executed successfully: $executionResult',
                  });
                  _isBusy = false;
                });
              },
              onCancel: () {
                setState(() {
                  _messages.add({
                    'role': 'assistant',
                    'content': 'Action was cancelled.',
                  });
                });
              },
            ),
          );
        } else {
          final result = await widget.onExecuteTool(toolCall);
          setState(() {
            _messages.add({
              'role': 'assistant',
              'content': result,
            });
          });
        }
      } else {
        setState(() {
          _messages.add({'role': 'assistant', 'content': responseText});
        });
      }
    } catch (e) {
      setState(() {
        _messages.add({'role': 'assistant', 'content': 'Error: $e'});
      });
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.auto_awesome, color: Colors.amber, size: 20),
            SizedBox(width: 8),
            Text('Shop AI Assistant (Qwen 1.7B)'),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final m = _messages[index];
                final isUser = m['role'] == 'user';

                return Align(
                  alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: isUser ? AppColors.tealPrimary : Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      m['content'] ?? '',
                      style: TextStyle(
                        color: isUser ? Colors.white : Colors.black87,
                        fontSize: 14,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          if (_isBusy)
            const Padding(
              padding: EdgeInsets.all(8.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                  SizedBox(width: 8),
                  Text('Processing on device...', style: TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
            ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              border: Border(top: BorderSide(color: Colors.grey.shade300)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _msgCtrl,
                    decoration: const InputDecoration(
                      hintText: 'Type query (e.g. "check stock of rice" or "Bilal ka khata")',
                      border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(24))),
                      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    ),
                    onSubmitted: (_) => _handleSend(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  style: IconButton.styleFrom(backgroundColor: AppColors.tealPrimary),
                  icon: const Icon(Icons.send, color: Colors.white),
                  onPressed: _isBusy ? null : _handleSend,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
