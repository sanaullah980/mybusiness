import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';

class PurchasesScreen extends StatelessWidget {
  final List<Map<String, dynamic>> purchases;
  final List<Map<String, dynamic>> suppliers;
  final List<Map<String, dynamic>> products;
  final Function(Map<String, dynamic> purchase) onAddPurchase;
  final VoidCallback onOpenBillScanner;

  const PurchasesScreen({
    super.key,
    required this.purchases,
    required this.suppliers,
    required this.products,
    required this.onAddPurchase,
    required this.onOpenBillScanner,
  });

  void _openPurchaseDialog(BuildContext context) {
    String? selectedSupplierId;
    final List<Map<String, dynamic>> items = [];
    final paidCtrl = TextEditingController();
    final noteCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          final totalAmount = items.fold<double>(
            0.0,
            (sum, i) => sum + ((i['amount'] as num?)?.toDouble() ?? 0.0),
          );

          return AlertDialog(
            title: const Text('New Stock Purchase'),
            content: SizedBox(
              width: double.maxFinite,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DropdownButtonFormField<String?>(
                      value: selectedSupplierId,
                      decoration: const InputDecoration(labelText: 'Supplier', border: OutlineInputBorder()),
                      items: [
                        const DropdownMenuItem(value: null, child: Text('Cash Purchase (No Supplier)')),
                        ...suppliers.map((s) => DropdownMenuItem(
                              value: s['id'] as String,
                              child: Text('${s['name']} (Payable: ${CurrencyFormatter.format(s['balance'] ?? 0)})'),
                            )),
                      ],
                      onChanged: (val) => setModalState(() => selectedSupplierId = val),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Purchased Items', style: TextStyle(fontWeight: FontWeight.bold)),
                        TextButton.icon(
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('Add Item'),
                          onPressed: () {
                            // Quick item addition
                            setModalState(() {
                              if (products.isNotEmpty) {
                                final first = products.first;
                                final cost = (first['cost'] as num?)?.toDouble() ?? 0.0;
                                items.add({
                                  'productId': first['id'],
                                  'productName': first['name'],
                                  'qty': 1,
                                  'unitCost': cost,
                                  'amount': cost,
                                });
                              }
                            });
                          },
                        ),
                      ],
                    ),
                    if (items.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Text('No items added. Click "+ Add Item" above.', style: TextStyle(color: Colors.grey)),
                      )
                    else
                      ...items.asMap().entries.map((entry) {
                        final idx = entry.key;
                        final item = entry.value;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey.shade300),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            children: [
                              DropdownButtonFormField<String>(
                                value: item['productId'],
                                decoration: const InputDecoration(isDense: true, border: InputBorder.none),
                                items: products.map((p) => DropdownMenuItem(
                                      value: p['id'] as String,
                                      child: Text(p['name'] as String),
                                    )).toList(),
                                onChanged: (pId) {
                                  final p = products.firstWhere((prod) => prod['id'] == pId);
                                  final cost = (p['cost'] as num?)?.toDouble() ?? 0.0;
                                  setModalState(() {
                                    items[idx]['productId'] = pId;
                                    items[idx]['productName'] = p['name'];
                                    items[idx]['unitCost'] = cost;
                                    items[idx]['amount'] = cost * (items[idx]['qty'] as int);
                                  });
                                },
                              ),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextFormField(
                                      initialValue: item['qty'].toString(),
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(labelText: 'Qty', isDense: true),
                                      onChanged: (v) {
                                        final q = int.tryParse(v) ?? 1;
                                        setModalState(() {
                                          items[idx]['qty'] = q;
                                          items[idx]['amount'] = q * (items[idx]['unitCost'] as double);
                                        });
                                      },
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: TextFormField(
                                      initialValue: item['unitCost'].toString(),
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(labelText: 'Unit Cost', isDense: true),
                                      onChanged: (v) {
                                        final c = double.tryParse(v) ?? 0.0;
                                        setModalState(() {
                                          items[idx]['unitCost'] = c;
                                          items[idx]['amount'] = (items[idx]['qty'] as int) * c;
                                        });
                                      },
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete, color: AppColors.danger, size: 20),
                                    onPressed: () => setModalState(() => items.removeAt(idx)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      }),
                    const SizedBox(height: 12),
                    Text('Total Bill: ${CurrencyFormatter.format(totalAmount)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: paidCtrl,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'Amount Paid (Rs.)',
                        hintText: totalAmount.toString(),
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: noteCtrl,
                      decoration: const InputDecoration(labelText: 'Purchase Note', border: OutlineInputBorder()),
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.tealPrimary, foregroundColor: Colors.white),
                onPressed: () {
                  if (items.isEmpty) return;
                  final paid = double.tryParse(paidCtrl.text) ?? totalAmount;
                  final due = totalAmount - paid;
                  final supplier = suppliers.firstWhere(
                    (s) => s['id'] == selectedSupplierId,
                    orElse: () => {'name': null, 'id': null},
                  );

                  onAddPurchase({
                    'date': DateTime.now().toIso8601String(),
                    'supplierId': supplier['id'],
                    'supplier': supplier['name'],
                    'amount': totalAmount,
                    'amountPaid': paid,
                    'amountDue': due > 0 ? due : 0.0,
                    'items': items,
                    'note': noteCtrl.text.trim(),
                  });
                  Navigator.pop(ctx);
                },
                child: const Text('Save Purchase'),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.tealPrimary,
        foregroundColor: Colors.white,
        onPressed: () => _openPurchaseDialog(context),
        icon: const Icon(Icons.add),
        label: const Text('New Purchase'),
      ),
      body: Column(
        children: [
          // Bill Scanner action bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: AppColors.tealPrimary.withOpacity(0.08),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('On-Device Bill Scanner', style: TextStyle(fontWeight: FontWeight.bold)),
                    Text('Auto-read paper bills into inventory', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.tealPrimary,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: onOpenBillScanner,
                  icon: const Icon(Icons.camera_alt, size: 18),
                  label: const Text('Scan Bill'),
                ),
              ],
            ),
          ),
          Expanded(
            child: purchases.isEmpty
                ? const Center(child: Text('No stock purchases recorded yet.'))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: purchases.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final p = purchases[index];
                      final amount = (p['amount'] as num?)?.toDouble() ?? 0.0;
                      final due = (p['amountDue'] as num?)?.toDouble() ?? 0.0;
                      final dateStr = DateFormat('dd MMM yyyy').format(
                        DateTime.tryParse(p['date'] ?? '') ?? DateTime.now(),
                      );
                      final supplierName = p['supplier'] ?? 'Cash Purchase';

                      return Card(
                        child: ListTile(
                          title: Text(supplierName, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('$dateStr · Due: ${CurrencyFormatter.format(due)}'),
                          trailing: Text(
                            CurrencyFormatter.format(amount),
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
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
