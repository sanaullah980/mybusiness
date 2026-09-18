import 'package:flutter/material.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../domain/calculations/return_calculator.dart';
import '../../../domain/calculations/sale_calculator.dart';

class ReturnRefundDialog extends StatefulWidget {
  final Map<String, dynamic> sale;
  final List<SaleItemDraft> items;
  final Function(List<SaleItemDraft> returnedItems, String note) onConfirmReturn;

  const ReturnRefundDialog({
    super.key,
    required this.sale,
    required this.items,
    required this.onConfirmReturn,
  });

  @override
  State<ReturnRefundDialog> createState() => _ReturnRefundDialogState();
}

class _ReturnRefundDialogState extends State<ReturnRefundDialog> {
  final Map<String, int> _returnQuantities = {};
  final TextEditingController _noteCtrl = TextEditingController();

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final returnableItems = widget.items.where((i) => (i.qty - i.returnedQty) > 0).toList();

    // Compute live refund breakdown
    final draftReturnList = <SaleItemDraft>[];
    _returnQuantities.forEach((id, qty) {
      if (qty > 0) {
        final item = widget.items.firstWhere((i) => i.id == id);
        draftReturnList.add(SaleItemDraft(
          id: item.id,
          name: item.name,
          cost: item.cost,
          price: item.price,
          qty: qty,
        ));
      }
    });

    final subtotal = (widget.sale['subtotal'] as num?)?.toDouble() ?? 0.0;
    final discount = (widget.sale['discount'] as num?)?.toDouble() ?? 0.0;
    final existingDue = (widget.sale['amountDue'] as num?)?.toDouble() ?? 0.0;

    final refundResult = ReturnCalculator.calculateReturn(
      returnedItems: draftReturnList,
      originalSubtotal: subtotal,
      originalDiscount: discount,
      existingSaleDue: existingDue,
    );

    return AlertDialog(
      title: const Text('Return / Refund Items'),
      content: SizedBox(
        width: double.maxFinite,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Select items and return quantities. Stock, Khata balance, and cash will update automatically.',
                style: TextStyle(fontSize: 13, color: Colors.grey),
              ),
              const SizedBox(height: 12),
              if (returnableItems.isEmpty)
                const Text('All items from this bill have already been returned.')
              else
                ...returnableItems.map((item) {
                  final maxReturnable = item.qty - item.returnedQty;
                  final current = _returnQuantities[item.id] ?? 0;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                              Text(
                                'Available: $maxReturnable · ${CurrencyFormatter.format(item.price)} each',
                                style: const TextStyle(fontSize: 12, color: Colors.grey),
                              ),
                            ],
                          ),
                        ),
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove, size: 18),
                              onPressed: current > 0
                                  ? () => setState(() => _returnQuantities[item.id] = current - 1)
                                  : null,
                            ),
                            Text('$current', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            IconButton(
                              icon: const Icon(Icons.add, size: 18),
                              onPressed: current < maxReturnable
                                  ? () => setState(() => _returnQuantities[item.id] = current + 1)
                                  : null,
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                }),
              const SizedBox(height: 12),
              TextField(
                controller: _noteCtrl,
                decoration: const InputDecoration(
                  labelText: 'Return Reason / Note',
                  hintText: 'e.g., Damaged item or wrong size',
                  border: OutlineInputBorder(),
                ),
              ),
              if (draftReturnList.isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Total Refund Value:'),
                          Text(CurrencyFormatter.format(refundResult.refundAmount), style: const TextStyle(fontWeight: FontWeight.bold)),
                        ],
                      ),
                      if (refundResult.dueReduction > 0) ...[
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Customer Debt Reduced:'),
                            Text('- ${CurrencyFormatter.format(refundResult.dueReduction)}', style: const TextStyle(color: AppColors.danger)),
                          ],
                        ),
                      ],
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Cash Refund Paid Out:', style: TextStyle(fontWeight: FontWeight.bold)),
                          Text(
                            CurrencyFormatter.format(refundResult.cashRefund),
                            style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger, foregroundColor: Colors.white),
          onPressed: draftReturnList.isEmpty
              ? null
              : () {
                  widget.onConfirmReturn(draftReturnList, _noteCtrl.text.trim());
                  Navigator.pop(context);
                },
          child: const Text('Confirm Return'),
        ),
      ],
    );
  }
}
