import 'package:flutter/material.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../common_widgets/stat_card.dart';

class DashboardScreen extends StatelessWidget {
  final VoidCallback onNewSale;
  final VoidCallback onOpenKhata;
  final VoidCallback onOpenInventory;
  final VoidCallback onOpenCashBook;
  final VoidCallback onOpenExpenses;
  final VoidCallback onOpenReports;

  // Real-time state inputs from SQLite/Riverpod
  final double todaySales;
  final double todayProfit;
  final double totalReceivable;
  final int lowStockCount;
  final List<Map<String, dynamic>> recentSales;

  const DashboardScreen({
    super.key,
    required this.onNewSale,
    required this.onOpenKhata,
    required this.onOpenInventory,
    required this.onOpenCashBook,
    required this.onOpenExpenses,
    required this.onOpenReports,
    this.todaySales = 0.0,
    this.todayProfit = 0.0,
    this.totalReceivable = 0.0,
    this.lowStockCount = 0,
    this.recentSales = const [],
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Key metrics grid
          GridView.count(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 1.35,
            children: [
              StatCard(
                title: "Today's Sales",
                value: CurrencyFormatter.format(todaySales),
                icon: Icons.point_of_sale,
                valueColor: AppColors.tealPrimary,
                iconBg: AppColors.tealPrimary,
                onTap: onOpenReports,
              ),
              StatCard(
                title: "Today's Profit",
                value: CurrencyFormatter.format(todayProfit),
                icon: Icons.trending_up,
                valueColor: AppColors.success,
                iconBg: AppColors.success,
                onTap: onOpenReports,
              ),
              StatCard(
                title: 'Khata Receivable',
                value: CurrencyFormatter.format(totalReceivable),
                subtitle: 'Total Customer Debt',
                icon: Icons.menu_book,
                valueColor: AppColors.danger,
                iconBg: AppColors.danger,
                onTap: onOpenKhata,
              ),
              StatCard(
                title: 'Low Stock Alert',
                value: '$lowStockCount items',
                subtitle: 'Needs reordering',
                icon: Icons.warning_amber_rounded,
                valueColor: lowStockCount > 0 ? AppColors.warning : AppColors.success,
                iconBg: lowStockCount > 0 ? AppColors.warning : AppColors.success,
                onTap: onOpenInventory,
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Quick actions
          const Text('Quick Actions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.tealPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: onNewSale,
                  icon: const Icon(Icons.add_shopping_cart, size: 20),
                  label: const Text('New Sale', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.tealPrimary,
                    side: const BorderSide(color: AppColors.tealPrimary),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: onOpenExpenses,
                  icon: const Icon(Icons.money_off, size: 20),
                  label: const Text('Add Expense'),
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Recent sales transactions
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Recent Sales', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              TextButton(
                onPressed: onOpenReports,
                child: const Text('View All'),
              ),
            ],
          ),
          const SizedBox(height: 8),

          if (recentSales.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 36),
              decoration: BoxDecoration(
                color: Theme.of(context).cardColor,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: const Column(
                children: [
                  Icon(Icons.receipt_long, size: 48, color: Colors.grey),
                  SizedBox(height: 8),
                  Text('No sales yet today', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w500)),
                  Text('Start by tapping "+ New Sale"', style: TextStyle(color: Colors.grey, fontSize: 13)),
                ],
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: recentSales.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final sale = recentSales[index];
                final billNo = sale['invoiceNumber'] != null ? '#${sale['invoiceNumber']}' : '';
                final customer = sale['customerName'] ?? 'Walk-in';
                final total = (sale['total'] as num?)?.toDouble() ?? 0.0;
                final amountDue = (sale['amountDue'] as num?)?.toDouble() ?? 0.0;

                return Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: AppColors.tealPrimary.withOpacity(0.12),
                      child: Text(
                        customer.isNotEmpty ? customer[0].toUpperCase() : 'W',
                        style: const TextStyle(color: AppColors.tealPrimary, fontWeight: FontWeight.bold),
                      ),
                    ),
                    title: Text('$customer $billNo', style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(
                      amountDue > 0 ? 'Due: ${CurrencyFormatter.format(amountDue)}' : 'Fully Paid',
                      style: TextStyle(
                        color: amountDue > 0 ? AppColors.danger : AppColors.success,
                        fontWeight: FontWeight.w500,
                        fontSize: 13,
                      ),
                    ),
                    trailing: Text(
                      CurrencyFormatter.format(total),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}
