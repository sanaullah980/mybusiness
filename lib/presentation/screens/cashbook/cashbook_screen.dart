import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../domain/calculations/cashbook_aggregator.dart';

class CashbookScreen extends StatelessWidget {
  final double openingBalance;
  final List<CashEntry> entries;
  final Function(String type, double amount, String note) onAddManualEntry;
  final Function(double newOpeningBalance) onSetOpeningBalance;

  const CashbookScreen({
    super.key,
    required this.openingBalance,
    required this.entries,
    required this.onAddManualEntry,
    required this.onSetOpeningBalance,
  });

  void _openManualEntryDialog(BuildContext context, bool isCashIn) {
    final amountCtrl = TextEditingController();
    final noteCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isCashIn ? '+ Cash In (Income)' : '+ Cash Out (Expense)'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: amountCtrl,
              keyboardType: TextInputType.number,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Amount (Rs.) *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: noteCtrl,
              decoration: InputDecoration(
                labelText: 'Description / Note',
                hintText: isCashIn ? 'e.g., Bank withdrawal to cash drawer' : 'e.g., Tea and refreshments',
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: isCashIn ? AppColors.success : AppColors.danger,
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              final amount = double.tryParse(amountCtrl.text.trim());
              if (amount == null || amount <= 0) return;
              onAddManualEntry(isCashIn ? 'income' : 'expense', amount, noteCtrl.text.trim());
              Navigator.pop(ctx);
            },
            child: Text(isCashIn ? 'Add Cash In' : 'Add Cash Out'),
          ),
        ],
      ),
    );
  }

  void _openSetOpeningBalanceDialog(BuildContext context) {
    final amountCtrl = TextEditingController(text: openingBalance.toString());

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Set Opening Balance'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Set your starting cash balance in the register once when you begin using MyBusiness.',
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: amountCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Opening Balance (Rs.) *', border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.tealPrimary, foregroundColor: Colors.white),
            onPressed: () {
              final amount = double.tryParse(amountCtrl.text.trim());
              if (amount == null || amount < 0) return;
              onSetOpeningBalance(amount);
              Navigator.pop(ctx);
            },
            child: const Text('Save Balance'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final summary = CashBookAggregator.buildSummary(
      openingBalance: openingBalance,
      entries: entries,
    );

    return Scaffold(
      body: Column(
        children: [
          // Summary cards
          Container(
            padding: const EdgeInsets.all(16),
            color: Theme.of(context).cardColor,
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Cash In Hand', style: TextStyle(fontSize: 13, color: Colors.grey)),
                        Text(
                          CurrencyFormatter.format(summary.cashInHand),
                          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: AppColors.tealPrimary),
                        ),
                      ],
                    ),
                    TextButton.icon(
                      onPressed: () => _openSetOpeningBalanceDialog(context),
                      icon: const Icon(Icons.tune, size: 16),
                      label: Text('Opening: ${CurrencyFormatter.format(openingBalance)}'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.success.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Total Cash In', style: TextStyle(fontSize: 12, color: Colors.grey)),
                            Text(CurrencyFormatter.format(summary.totalIn),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.success)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.danger.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Total Cash Out', style: TextStyle(fontSize: 12, color: Colors.grey)),
                            Text(CurrencyFormatter.format(summary.totalOut),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.danger)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.success,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onPressed: () => _openManualEntryDialog(context, true),
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('+ Cash In'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.danger,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onPressed: () => _openManualEntryDialog(context, false),
                        icon: const Icon(Icons.remove, size: 18),
                        label: const Text('- Cash Out'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Chronological running ledger
          Expanded(
            child: summary.entries.isEmpty
                ? const Center(child: Text('No cash movements recorded yet.'))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: summary.entries.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (context, index) {
                      final e = summary.entries[index];
                      final isIn = e.type == CashFlowType.inFlow;
                      final dateStr = DateFormat('dd MMM, hh:mm a').format(e.date);

                      return Card(
                        child: ListTile(
                          title: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(e.label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                              Text(
                                isIn ? '+ ${CurrencyFormatter.format(e.amount)}' : '- ${CurrencyFormatter.format(e.amount)}',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                  color: isIn ? AppColors.success : AppColors.danger,
                                ),
                              ),
                            ],
                          ),
                          subtitle: Text(dateStr, style: const TextStyle(fontSize: 12, color: Colors.grey)),
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
