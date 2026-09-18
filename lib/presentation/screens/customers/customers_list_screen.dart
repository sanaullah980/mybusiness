import 'package:flutter/material.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../common_widgets/search_bar_widget.dart';

class CustomersListScreen extends StatefulWidget {
  final List<Map<String, dynamic>> customers;
  final Function(String customerId) onSelectCustomer;
  final Function(Map<String, dynamic> newCustomer) onAddCustomer;

  const CustomersListScreen({
    super.key,
    required this.customers,
    required this.onSelectCustomer,
    required this.onAddCustomer,
  });

  @override
  State<CustomersListScreen> createState() => _CustomersListScreenState();
}

class _CustomersListScreenState extends State<CustomersListScreen> {
  String _searchQuery = '';

  void _openAddCustomerDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final addressCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Khata Customer'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Customer Name *')),
            const SizedBox(height: 8),
            TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone Number')),
            const SizedBox(height: 8),
            TextField(controller: addressCtrl, decoration: const InputDecoration(labelText: 'Address / Location')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.tealPrimary, foregroundColor: Colors.white),
            onPressed: () {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) return;
              widget.onAddCustomer({
                'name': name,
                'phone': phoneCtrl.text.trim(),
                'address': addressCtrl.text.trim(),
                'balance': 0.0,
              });
              Navigator.pop(ctx);
            },
            child: const Text('Save Customer'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalDebt = widget.customers.fold<double>(
      0.0,
      (sum, c) => sum + ((c['balance'] as num?)?.toDouble() ?? 0.0),
    );

    final filtered = widget.customers.where((c) {
      final name = (c['name'] as String? ?? '').toLowerCase();
      final phone = (c['phone'] as String? ?? '').toLowerCase();
      return name.contains(_searchQuery.toLowerCase()) || phone.contains(_searchQuery.toLowerCase());
    }).toList();

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.tealPrimary,
        foregroundColor: Colors.white,
        onPressed: _openAddCustomerDialog,
        icon: const Icon(Icons.person_add),
        label: const Text('Add Customer'),
      ),
      body: Column(
        children: [
          // Total Receivable summary banner
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
                    Text('Total Khata Receivable', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.black87)),
                    Text('Money to collect from customers', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
                Text(
                  CurrencyFormatter.format(totalDebt),
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.danger),
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(16.0),
            child: SearchBarWidget(
              hintText: 'Search by name or phone...',
              onChanged: (val) => setState(() => _searchQuery = val),
            ),
          ),

          Expanded(
            child: filtered.isEmpty
                ? const Center(child: Text('No customers found.'))
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final c = filtered[index];
                      final balance = (c['balance'] as num?)?.toDouble() ?? 0.0;
                      final name = c['name'] as String;
                      final phone = c['phone'] as String? ?? 'No phone';

                      return ListTile(
                        onTap: () => widget.onSelectCustomer(c['id'] as String),
                        contentPadding: const EdgeInsets.symmetric(vertical: 4),
                        leading: CircleAvatar(
                          backgroundColor: AppColors.tealPrimary.withOpacity(0.12),
                          child: Text(
                            name.isNotEmpty ? name[0].toUpperCase() : 'C',
                            style: const TextStyle(color: AppColors.tealPrimary, fontWeight: FontWeight.bold),
                          ),
                        ),
                        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(phone),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              CurrencyFormatter.format(balance),
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                color: balance > 0 ? AppColors.danger : AppColors.success,
                              ),
                            ),
                            Text(
                              balance > 0 ? 'Receivable' : 'Settled',
                              style: const TextStyle(fontSize: 11, color: Colors.grey),
                            ),
                          ],
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
