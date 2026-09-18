import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';

class RemindersScreen extends StatelessWidget {
  final List<Map<String, dynamic>> reminders;
  final Function(Map<String, dynamic> reminder) onAddReminder;
  final Function(String reminderId, bool completed) onToggleComplete;
  final Function(String reminderId) onDeleteReminder;

  const RemindersScreen({
    super.key,
    required this.reminders,
    required this.onAddReminder,
    required this.onToggleComplete,
    required this.onDeleteReminder,
  });

  void _openAddReminderDialog(BuildContext context) {
    final titleCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    DateTime selectedDate = DateTime.now().add(const Duration(days: 1));

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: const Text('Add Reminder'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(labelText: 'Reminder Title *', hintText: 'e.g., Collect payment from Bilal'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Amount (Optional)'),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Due Date: ${DateFormat('dd MMM yyyy').format(selectedDate)}'),
                  TextButton(
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: selectedDate,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (picked != null) setModalState(() => selectedDate = picked);
                    },
                    child: const Text('Select Date'),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.tealPrimary, foregroundColor: Colors.white),
              onPressed: () {
                final title = titleCtrl.text.trim();
                if (title.isEmpty) return;
                onAddReminder({
                  'title': title,
                  'amount': double.tryParse(amountCtrl.text.trim()),
                  'dueDate': selectedDate.toIso8601String(),
                  'completed': false,
                  'createdAt': DateTime.now().toIso8601String(),
                });
                Navigator.pop(ctx);
              },
              child: const Text('Save Reminder'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.tealPrimary,
        foregroundColor: Colors.white,
        onPressed: () => _openAddReminderDialog(context),
        icon: const Icon(Icons.alarm_add),
        label: const Text('Add Reminder'),
      ),
      body: reminders.isEmpty
          ? const Center(child: Text('No pending reminders.'))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: reminders.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final r = reminders[index];
                final isDone = r['completed'] == true;
                final title = r['title'] as String;
                final amount = (r['amount'] as num?)?.toDouble();
                final dueDateStr = DateFormat('dd MMM yyyy').format(
                  DateTime.tryParse(r['dueDate'] ?? '') ?? DateTime.now(),
                );

                return Card(
                  child: ListTile(
                    leading: Checkbox(
                      value: isDone,
                      activeColor: AppColors.tealPrimary,
                      onChanged: (val) => onToggleComplete(r['id'] as String, val ?? false),
                    ),
                    title: Text(
                      title,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        decoration: isDone ? TextDecoration.lineThrough : null,
                        color: isDone ? Colors.grey : null,
                      ),
                    ),
                    subtitle: Text('Due: $dueDateStr'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (amount != null && amount > 0)
                          Text(
                            CurrencyFormatter.format(amount),
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, color: Colors.grey, size: 20),
                          onPressed: () => onDeleteReminder(r['id'] as String),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
