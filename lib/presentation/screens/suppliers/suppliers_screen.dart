import 'package:flutter/material.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';

class SuppliersScreen extends StatelessWidget {
  final List<Map<String, dynamic>> suppliers;
  final Function(Map<String, dynamic> supplier) onAddSupplier;
  final Function(String supplierId, double amount, String note) onPaySupplier;
  final Function(String supplierId, double amount, String note) onCreditPurchase;

  const SuppliersScreen({
    super.key,
    required this.suppliers,
    required this.onAddSupplier,
    required this.onPaySupplier,
    required this.onCreditPurchase,
  });

  void _openAddSupplierDialog(BuildContext context) {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final notesCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Supplier'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Supplier Name *')),
            const SizedBox(height: 8),
            TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
            const SizedBox(height: 8),
            TextField(controller: notesCtrl, decoration: const InputDecoration(labelText: 'Notes')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.tealPrimary, foregroundColor: Colors.white),
            onPressed: () {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) return;
              onAddSupplier({
                'name': name,
                'phone': phoneCtrl.text.trim(),
                'notes': notesCtrl.text.trim(),
                'balance': 0.0,
              });
              Navigator.pop(ctx);
            },
            child: const Text('Save Supplier'),
          ),
        ],
      ),
    );
  }

  void _openSupplierActionDialog(BuildContext context, Map<String, dynamic> supplier, bool isPayment) {
    final amountCtrl = TextEditingController();
    final noteCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isPayment ? 'Pay Supplier (${supplier['name']})' : 'Record Credit Purchase (${supplier['name']})'),
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
              decoration: const InputDecoration(labelText: 'Note (Optional)', border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: isPayment ? AppColors.success : AppColors.danger,
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              final amount = double.tryParse(amountCtrl.text.trim());
              if (amount == null || amount <= 0) return;
              if (isPayment) {
                onPaySupplier(supplier['id'] as String, amount, noteCtrl.text.trim());
              } else {
                onCreditPurchase(supplier['id'] as String, amount, noteCtrl.text.trim());
              }
              Navigator.pop(ctx);
            },
            child: Text(isPayment ? 'Record Payment' : 'Add Credit'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalPayable = suppliers.fold<double>(
      0.0,
      (sum, s) => sum + ((s['balance'] as num?)?.toDouble() ?? 0.0),
    );

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.tealPrimary,
        foregroundColor: Colors.white,
        onPressed: () => _openAddSupplierDialog(context),
        icon: const Icon(Icons.person_add),
        label: const Text('Add Supplier'),
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
                    Text('Total Payable to Suppliers', style: TextStyle(fontWeight: FontWeight.bold)),
                    Text('Money you owe for stock', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
                Text(
                  CurrencyFormatter.format(totalPayable),
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.danger),
                ),
              ],
            ),
          ),
          Expanded(
            child: suppliers.isEmpty
                ? const Center(child: Text('No suppliers added yet.'))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: suppliers.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final s = suppliers[index];
                      final balance = (s['balance'] as num?)?.toDouble() ?? 0.0;

                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(s['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                  Text(
                                    CurrencyFormatter.format(balance),
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                      color: balance > 0 ? AppColors.danger : AppColors.success,
                                    ),
                                  ),
                                ],
                              ),
                              if (s['phone'] != null && (s['phone'] as String).isNotEmpty)
                                Text(s['phone'] as String, style: const TextStyle(color: Colors.grey, fontSize: 13)),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  OutlinedButton.icon(
                                    onPressed: () => _openSupplierActionDialog(context, s, true),
                                    icon: const Icon(Icons.payment, size: 16),
                                    label: const Text('Pay Supplier'),
                                  ),
                                  const SizedBox(width: 8),
                                  OutlinedButton.icon(
                                    onPressed: () => _openSupplierActionDialog(context, s, false),
                                    icon: const Icon(Icons.add_shopping_cart, size: 16),
                                    label: const Text('Credit Purchase'),
                                  ),
                                ],
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
