import 'package:flutter/material.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../domain/calculations/report_calculator.dart';
import '../../common_widgets/stat_card.dart';

class ReportsScreen extends StatefulWidget {
  final BusinessReportStats stats;
  final String dateRangeLabel;
  final Function(String filter) onFilterChanged;

  const ReportsScreen({
    super.key,
    required this.stats,
    required this.dateRangeLabel,
    required this.onFilterChanged,
  });

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String _selectedFilter = 'today';

  @override
  Widget build(BuildContext context) {
    final stats = widget.stats;

    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Filter chips row
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  ChoiceChip(
                    label: const Text('Today'),
                    selected: _selectedFilter == 'today',
                    onSelected: (_) {
                      setState(() => _selectedFilter = 'today');
                      widget.onFilterChanged('today');
                    },
                  ),
                  const SizedBox(width: 8),
                  ChoiceChip(
                    label: const Text('Yesterday'),
                    selected: _selectedFilter == 'yesterday',
                    onSelected: (_) {
                      setState(() => _selectedFilter = 'yesterday');
                      widget.onFilterChanged('yesterday');
                    },
                  ),
                  const SizedBox(width: 8),
                  ChoiceChip(
                    label: const Text('This Week'),
                    selected: _selectedFilter == 'week',
                    onSelected: (_) {
                      setState(() => _selectedFilter = 'week');
                      widget.onFilterChanged('week');
                    },
                  ),
                  const SizedBox(width: 8),
                  ChoiceChip(
                    label: const Text('This Month'),
                    selected: _selectedFilter == 'month',
                    onSelected: (_) {
                      setState(() => _selectedFilter = 'month');
                      widget.onFilterChanged('month');
                    },
                  ),
                  const SizedBox(width: 8),
                  ChoiceChip(
                    label: const Text('All Time'),
                    selected: _selectedFilter == 'all',
                    onSelected: (_) {
                      setState(() => _selectedFilter = 'all');
                      widget.onFilterChanged('all');
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Top primary performance metrics
            GridView.count(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 1.35,
              children: [
                StatCard(
                  title: 'Total Revenue',
                  value: CurrencyFormatter.format(stats.totalSales),
                  subtitle: '${stats.txCount} bills recorded',
                  icon: Icons.point_of_sale,
                  valueColor: AppColors.tealPrimary,
                  iconBg: AppColors.tealPrimary,
                ),
                StatCard(
                  title: 'Net Profit',
                  value: CurrencyFormatter.format(stats.netProfit),
                  subtitle: 'Gross Profit - Expenses',
                  icon: Icons.trending_up,
                  valueColor: stats.netProfit >= 0 ? AppColors.success : AppColors.danger,
                  iconBg: stats.netProfit >= 0 ? AppColors.success : AppColors.danger,
                ),
                StatCard(
                  title: 'Gross Profit',
                  value: CurrencyFormatter.format(stats.knownProfit),
                  subtitle: 'Wholesale + Retail margin',
                  icon: Icons.pie_chart_outline,
                  valueColor: AppColors.success,
                  iconBg: AppColors.success,
                ),
                StatCard(
                  title: 'Total Expenses',
                  value: CurrencyFormatter.format(stats.totalExpenses),
                  subtitle: 'Operating overhead',
                  icon: Icons.money_off,
                  valueColor: AppColors.danger,
                  iconBg: AppColors.danger,
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Advanced Cash & Stock Breakdown
            const Text('Cash & Working Capital', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _buildReportRow('Cash in Hand', CurrencyFormatter.format(stats.cashInHand), isBold: true),
                    const Divider(),
                    _buildReportRow('Total Cash Collected (In)', CurrencyFormatter.format(stats.cashIn), color: AppColors.success),
                    const SizedBox(height: 8),
                    _buildReportRow('Total Cash Disbursed (Out)', CurrencyFormatter.format(stats.cashOut), color: AppColors.danger),
                    const Divider(),
                    _buildReportRow('Stock Purchases (New Stock)', CurrencyFormatter.format(stats.purchasesTotal)),
                    const SizedBox(height: 8),
                    _buildReportRow('Customer Returns / Refunds', CurrencyFormatter.format(stats.returnedAmount), color: AppColors.danger),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Inventory Valuation
            const Text('Inventory Valuation', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _buildReportRow('Stock Value at Cost', CurrencyFormatter.format(stats.stockValueCost), isBold: true),
                    const SizedBox(height: 8),
                    _buildReportRow('Stock Value at Selling Price', CurrencyFormatter.format(stats.stockValuePrice)),
                    const Divider(),
                    _buildReportRow('Low Stock Items', '${stats.lowStockCount}', color: stats.lowStockCount > 0 ? AppColors.warning : AppColors.success),
                    const SizedBox(height: 8),
                    _buildReportRow('Out of Stock Items', '${stats.outOfStockCount}', color: stats.outOfStockCount > 0 ? AppColors.danger : AppColors.success),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Top Selling Products
            if (stats.bestSellers.isNotEmpty) ...[
              const Text('Top Selling Products', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Card(
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: stats.bestSellers.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final item = stats.bestSellers[index];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: AppColors.tealPrimary.withOpacity(0.12),
                        child: Text('${index + 1}', style: const TextStyle(color: AppColors.tealPrimary, fontWeight: FontWeight.bold)),
                      ),
                      title: Text(item.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('${item.quantity} units sold'),
                      trailing: Text(
                        CurrencyFormatter.format(item.revenue),
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                    );
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildReportRow(String label, String value, {bool isBold = false, Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(fontSize: 14, fontWeight: isBold ? FontWeight.bold : FontWeight.normal)),
        Text(
          value,
          style: TextStyle(
            fontSize: 15,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            color: color,
          ),
        ),
      ],
    );
  }
}
