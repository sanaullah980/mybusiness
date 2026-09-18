import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';

class ExpensesScreen extends StatefulWidget {
  final List<Map<String, dynamic>> expenses;
  final Function(Map<String, dynamic> expense) onAddExpense;
  final Function(String expenseId) onDeleteExpense;

  const ExpensesScreen({
    super.key,
    required this.expenses,
    required this.onAddExpense,
    required this.onDeleteExpense,
  });

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  static const List<String> categories = [
    'Rent',
    'Utilities',
    'Salaries',
    'Tea & Refreshments',
    'Transport',
    'Maintenance',
    'Marketing',
    'Other',
  ];

  void _openAddExpenseDialog() {
    String selectedCategory = categories.first;
    final amountCtrl = TextEditingController();
    final noteCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: const Text('Add Expense'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: selectedCategory,
                decoration: const InputDecoration(labelText: 'Category *', border: OutlineInputBorder()),
                items: categories.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                onChanged: (val) => setModalState(() => selectedCategory = val!),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Amount (Rs.) *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteCtrl,
                decoration: const InputDecoration(labelText: 'Description / Note', border: OutlineInputBorder()),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.tealPrimary, foregroundColor: Colors.white),
              onPressed: () {
                final amount = double.tryParse(amountCtrl.text.trim());
                if (amount == null || amount <= 0) return;
                widget.onAddExpense({
                  'category': selectedCategory,
                  'amount': amount,
                  'note': noteCtrl.text.trim(),
                  'date': DateTime.now().toIso8601String(),
                });
                Navigator.pop(ctx);
              },
              child: const Text('Save Expense'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalExpenses = widget.expenses.fold<double>(
      0.0,
      (sum, e) => sum + ((e['amount'] as num?)?.toDouble() ?? 0.0),
    );

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.tealPrimary,
        foregroundColor: Colors.white,
        onPressed: _openAddExpenseDialog,
        icon: const Icon(Icons.add),
        label: const Text('Add Expense'),
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            color: AppColors.danger.withOpacity(0.08),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Total Shop Expenses', style: TextStyle(fontWeight: FontWeight.bold)),
                    Text('Operating costs & bills', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
                Text(
                  CurrencyFormatter.format(totalExpenses),
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.danger),
                ),
              ],
            ),
          ),
          Expanded(
            child: widget.expenses.isEmpty
                ? const Center(child: Text('No expenses recorded yet.'))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: widget.expenses.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final exp = widget.expenses[index];
                      final amount = (exp['amount'] as num?)?.toDouble() ?? 0.0;
                      final dateStr = DateFormat('dd MMM yyyy, hh:mm a').format(
                        DateTime.tryParse(exp['date'] ?? '') ?? DateTime.now(),
                      );
                      final category = exp['category'] ?? 'General';
                      final note = exp['note'] ?? '';

                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: Colors.orange.withOpacity(0.12),
                            child: const Icon(Icons.receipt_outlined, color: Colors.orange, size: 20),
                          ),
                          title: Text(category, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text(note.isNotEmpty ? '$note\n$dateStr' : dateStr),
                          isThreeLine: note.isNotEmpty,
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                CurrencyFormatter.format(amount),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.danger),
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, color: Colors.grey, size: 20),
                                onPressed: () => widget.onDeleteExpense(exp['id'] as String),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
