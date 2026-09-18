import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';

class CustomerLedgerScreen extends StatelessWidget {
  final Map<String, dynamic> customer;
  final List<Map<String, dynamic>> transactions;
  final Function(double amount, String note) onRecordPayment; // You Got
  final Function(double amount, String note) onRecordDebt; // You Gave
  final Function(String saleId) onOpenInvoice;
  final VoidCallback onDeleteCustomer;

  const CustomerLedgerScreen({
    super.key,
    required this.customer,
    required this.transactions,
    required this.onRecordPayment,
    required this.onRecordDebt,
    required this.onOpenInvoice,
    required this.onDeleteCustomer,
  });

  void _openGiveGotModal(BuildContext context, bool isPayment) {
    final amountCtrl = TextEditingController();
    final noteCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isPayment ? 'You Got (Received Payment)' : 'You Gave (Added Credit/Debt)'),
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
                labelText: 'Note (Optional)',
                hintText: isPayment ? 'Cash received' : 'Goods delivered on credit',
                border: const OutlineInputBorder(),
              ),
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
                onRecordPayment(amount, noteCtrl.text.trim());
              } else {
                onRecordDebt(amount, noteCtrl.text.trim());
              }
              Navigator.pop(ctx);
            },
            child: Text(isPayment ? 'Record Payment' : 'Add Debt'),
          ),
        ],
      ),
    );
  }

  void _sendWhatsAppReminder() async {
    final phone = (customer['phone'] as String? ?? '').replaceAll(RegExp(r'\D'), '');
    final name = customer['name'] ?? 'Customer';
    final balance = CurrencyFormatter.format(customer['balance'] ?? 0);
    final text = 'Respected $name, your pending balance at our shop is $balance. Please clear your dues at your earliest convenience. Thank you!';
    final url = phone.isNotEmpty
        ? 'https://wa.me/$phone?text=${Uri.encodeComponent(text)}'
        : 'https://wa.me/?text=${Uri.encodeComponent(text)}';

    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final balance = (customer['balance'] as num?)?.toDouble() ?? 0.0;
    final name = customer['name'] as String? ?? 'Customer';
    final phone = customer['phone'] as String? ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Text(name),
        actions: [
          IconButton(
            icon: const Icon(Icons.share),
            tooltip: 'WhatsApp Reminder',
            onPressed: _sendWhatsAppReminder,
          ),
          PopupMenuButton<String>(
            onSelected: (val) {
              if (val == 'delete') onDeleteCustomer();
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'delete', child: Text('Delete Customer', style: TextStyle(color: AppColors.danger))),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // Outstanding balance header card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
            color: Theme.of(context).cardColor,
            child: Column(
              children: [
                Text(
                  balance > 0 ? 'You Will Receive (Payable to You)' : 'Account Settled',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 6),
                Text(
                  CurrencyFormatter.format(balance),
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: balance > 0 ? AppColors.danger : AppColors.success,
                  ),
                ),
                if (phone.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(phone, style: const TextStyle(color: Colors.grey, fontSize: 13)),
                ],
              ],
            ),
          ),

          const Divider(height: 1),

          // Ledger transactions list
          Expanded(
            child: transactions.isEmpty
                ? const Center(child: Text('No transactions recorded yet.'))
                : ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: transactions.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (context, index) {
                      final t = transactions[index];
                      final isPayment = t['type'] == 'payment';
                      final amount = (t['amount'] as num?)?.toDouble() ?? 0.0;
                      final dateStr = DateFormat('dd MMM yyyy').format(
                        DateTime.tryParse(t['date'] ?? '') ?? DateTime.now(),
                      );
                      final note = t['note'] ?? (isPayment ? 'Payment received' : 'Sale debt');
                      final saleId = t['saleId'] as String?;

                      return Card(
                        child: ListTile(
                          onTap: saleId != null ? () => onOpenInvoice(saleId) : null,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                          title: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(dateStr, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                              Text(
                                isPayment ? '+ ${CurrencyFormatter.format(amount)}' : '- ${CurrencyFormatter.format(amount)}',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                  color: isPayment ? AppColors.success : AppColors.danger,
                                ),
                              ),
                            ],
                          ),
                          subtitle: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(note, style: const TextStyle(fontSize: 13, color: Colors.grey)),
                              if (saleId != null)
                                const Text('View Bill →', style: TextStyle(fontSize: 12, color: AppColors.tealPrimary)),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),

          // Bottom Action Bar: You Gave / You Got
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              border: Border(top: BorderSide(color: Colors.grey.shade200)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.danger,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: () => _openGiveGotModal(context, false),
                    icon: const Icon(Icons.arrow_upward, size: 18),
                    label: const Text('You Gave (Debt)', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.success,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: () => _openGiveGotModal(context, true),
                    icon: const Icon(Icons.arrow_downward, size: 18),
                    label: const Text('You Got (Paid)', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
