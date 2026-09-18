import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../domain/calculations/sale_calculator.dart';
import 'return_refund_dialog.dart';

class InvoiceDetailScreen extends StatelessWidget {
  final Map<String, dynamic> sale;
  final Map<String, dynamic>? shopSettings;
  final Function(List<SaleItemDraft> returnedItems, String note) onProcessReturn;

  const InvoiceDetailScreen({
    super.key,
    required this.sale,
    this.shopSettings,
    required this.onProcessReturn,
  });

  void _shareWhatsApp() async {
    final customer = sale['customerName'] ?? 'Walk-in';
    final billNo = sale['invoiceNumber'] ?? 'N/A';
    final total = CurrencyFormatter.format(sale['total'] ?? 0);
    final due = CurrencyFormatter.format(sale['amountDue'] ?? 0);
    final shopName = shopSettings?['shopName'] ?? 'MyBusiness';

    final text = '*$shopName - Bill #$billNo*\n'
        'Customer: $customer\n'
        'Total: $total\n'
        'Balance Due: $due\n'
        'Thank you for your business!';

    final url = 'https://wa.me/?text=${Uri.encodeComponent(text)}';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final billNo = sale['invoiceNumber'] != null ? '#${sale['invoiceNumber']}' : '';
    final dateStr = DateFormat('dd MMM yyyy, hh:mm a').format(
      DateTime.tryParse(sale['date'] ?? '') ?? DateTime.now(),
    );
    final customer = sale['customerName'] ?? 'Walk-in Customer';
    final items = (sale['items'] as List<dynamic>?) ?? [];
    final subtotal = (sale['subtotal'] as num?)?.toDouble() ?? 0.0;
    final discount = (sale['discount'] as num?)?.toDouble() ?? 0.0;
    final total = (sale['total'] as num?)?.toDouble() ?? 0.0;
    final paid = (sale['amountPaid'] as num?)?.toDouble() ?? 0.0;
    final due = (sale['amountDue'] as num?)?.toDouble() ?? 0.0;

    return Scaffold(
      appBar: AppBar(
        title: Text('Bill $billNo'),
        actions: [
          IconButton(
            icon: const Icon(Icons.share),
            tooltip: 'Share via WhatsApp',
            onPressed: _shareWhatsApp,
          ),
          IconButton(
            icon: const Icon(Icons.assignment_return_outlined),
            tooltip: 'Return / Refund',
            onPressed: () {
              final draftItems = items.map((i) => SaleItemDraft(
                id: i['id'] ?? '',
                name: i['name'] ?? '',
                cost: (i['cost'] as num?)?.toDouble() ?? 0.0,
                price: (i['price'] as num?)?.toDouble() ?? 0.0,
                qty: (i['qty'] as int?) ?? 1,
                returnedQty: (i['returnedQty'] as int?) ?? 0,
              )).toList();

              showDialog(
                context: context,
                builder: (_) => ReturnRefundDialog(
                  sale: sale,
                  items: draftItems,
                  onConfirmReturn: onProcessReturn,
                ),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Bill Header
                Center(
                  child: Column(
                    children: [
                      Text(
                        shopSettings?['shopName'] ?? 'MyBusiness',
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                      ),
                      if (shopSettings?['phone'] != null)
                        Text(shopSettings!['phone'], style: const TextStyle(color: Colors.grey)),
                      if (shopSettings?['address'] != null)
                        Text(shopSettings!['address'], style: const TextStyle(color: Colors.grey)),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.tealPrimary.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'INVOICE $billNo',
                          style: const TextStyle(color: AppColors.tealPrimary, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),
                const Divider(),

                // Metadata
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Customer:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        Text(customer, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('Date:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        Text(dateStr, style: const TextStyle(fontSize: 13)),
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 16),
                const Divider(),

                // Items table
                Table(
                  columnWidths: const {
                    0: FlexColumnWidth(4),
                    1: FlexColumnWidth(2),
                    2: FlexColumnWidth(2),
                    3: FlexColumnWidth(3),
                  },
                  children: [
                    const TableRow(
                      children: [
                        Text('Item', style: TextStyle(fontWeight: FontWeight.bold)),
                        Text('Price', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.bold)),
                        Text('Qty', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold)),
                        Text('Total', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const TableRow(children: [SizedBox(height: 8), SizedBox(height: 8), SizedBox(height: 8), SizedBox(height: 8)]),
                    ...items.map((i) {
                      final name = i['name'] ?? 'Item';
                      final price = (i['price'] as num?)?.toDouble() ?? 0.0;
                      final qty = (i['qty'] as int?) ?? 1;
                      final retQty = (i['returnedQty'] as int?) ?? 0;
                      final lineTotal = price * qty;

                      return TableRow(
                        children: [
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(name, style: const TextStyle(fontSize: 14)),
                                if (retQty > 0)
                                  Text('(Returned: $retQty)', style: const TextStyle(color: AppColors.danger, fontSize: 11)),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Text(CurrencyFormatter.format(price), textAlign: TextAlign.right, style: const TextStyle(fontSize: 13)),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Text('$qty', textAlign: TextAlign.center, style: const TextStyle(fontSize: 13)),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Text(CurrencyFormatter.format(lineTotal), textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                          ),
                        ],
                      );
                    }),
                  ],
                ),

                const Divider(height: 24),

                // Calculations summary
                Align(
                  alignment: Alignment.centerRight,
                  child: SizedBox(
                    width: 240,
                    child: Column(
                      children: [
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                          const Text('Subtotal:'),
                          Text(CurrencyFormatter.format(subtotal)),
                        ]),
                        if (discount > 0) ...[
                          const SizedBox(height: 4),
                          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                            const Text('Discount:'),
                            Text('- ${CurrencyFormatter.format(discount)}', style: const TextStyle(color: AppColors.danger)),
                          ]),
                        ],
                        const SizedBox(height: 4),
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                          const Text('Grand Total:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          Text(CurrencyFormatter.format(total), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        ]),
                        const SizedBox(height: 4),
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                          const Text('Amount Paid:'),
                          Text(CurrencyFormatter.format(paid), style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.bold)),
                        ]),
                        if (due > 0) ...[
                          const SizedBox(height: 4),
                          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                            const Text('Balance Due:', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.danger)),
                            Text(CurrencyFormatter.format(due), style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.danger)),
                          ]),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
