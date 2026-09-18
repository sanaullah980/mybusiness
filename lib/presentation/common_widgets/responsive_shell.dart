import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';

class ResponsiveShell extends StatefulWidget {
  final int currentIndex;
  final ValueChanged<int> onNavigationChanged;
  final Widget body;
  final String title;
  final List<Widget>? actions;

  const ResponsiveShell({
    super.key,
    required this.currentIndex,
    required this.onNavigationChanged,
    required this.body,
    required this.title,
    this.actions,
  });

  @override
  State<ResponsiveShell> createState() => _ResponsiveShellState();
}

class _ResponsiveShellState extends State<ResponsiveShell> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        actions: widget.actions,
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: BoxDecoration(color: theme.primaryColor),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Icon(Icons.store, size: 40, color: Colors.white),
                  SizedBox(height: 8),
                  Text('MyBusiness', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                  Text('Shop & Khata Management', style: TextStyle(color: Colors.white70, fontSize: 13)),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.dashboard_outlined),
              title: const Text('Dashboard'),
              selected: widget.currentIndex == 0,
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(0);
              },
            ),
            ListTile(
              leading: const Icon(Icons.point_of_sale_outlined),
              title: const Text('Sales (POS)'),
              selected: widget.currentIndex == 1,
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(1);
              },
            ),
            ListTile(
              leading: const Icon(Icons.menu_book_outlined),
              title: const Text('Khata (Customers)'),
              selected: widget.currentIndex == 2,
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(2);
              },
            ),
            ListTile(
              leading: const Icon(Icons.inventory_2_outlined),
              title: const Text('Inventory (Stock)'),
              selected: widget.currentIndex == 3,
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(3);
              },
            ),
            ListTile(
              leading: const Icon(Icons.account_balance_wallet_outlined),
              title: const Text('Cash Book'),
              selected: widget.currentIndex == 4,
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(4);
              },
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.shopping_bag_outlined),
              title: const Text('Stock Purchases'),
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(5);
              },
            ),
            ListTile(
              leading: const Icon(Icons.local_shipping_outlined),
              title: const Text('Suppliers Book'),
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(6);
              },
            ),
            ListTile(
              leading: const Icon(Icons.receipt_long_outlined),
              title: const Text('Invoices / Bills'),
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(7);
              },
            ),
            ListTile(
              leading: const Icon(Icons.money_off_outlined),
              title: const Text('Expenses'),
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(8);
              },
            ),
            ListTile(
              leading: const Icon(Icons.badge_outlined),
              title: const Text('Staff & Attendance'),
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(9);
              },
            ),
            ListTile(
              leading: const Icon(Icons.notifications_outlined),
              title: const Text('Reminders'),
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(10);
              },
            ),
            ListTile(
              leading: const Icon(Icons.bar_chart_outlined),
              title: const Text('Reports & Analytics'),
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(11);
              },
            ),
            ListTile(
              leading: const Icon(Icons.group_outlined),
              title: const Text('Team & Access'),
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(12);
              },
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text('Settings & Backup'),
              onTap: () {
                Navigator.pop(context);
                widget.onNavigationChanged(13);
              },
            ),
          ],
        ),
      ),
      body: widget.body,
      bottomNavigationBar: widget.currentIndex <= 4
          ? NavigationBar(
              selectedIndex: widget.currentIndex,
              onDestinationSelected: widget.onNavigationChanged,
              destinations: const [
                NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Home'),
                NavigationDestination(icon: Icon(Icons.point_of_sale_outlined), selectedIcon: Icon(Icons.point_of_sale), label: 'Sale'),
                NavigationDestination(icon: Icon(Icons.menu_book_outlined), selectedIcon: Icon(Icons.menu_book), label: 'Khata'),
                NavigationDestination(icon: Icon(Icons.inventory_2_outlined), selectedIcon: Icon(Icons.inventory_2), label: 'Stock'),
                NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), selectedIcon: Icon(Icons.account_balance_wallet), label: 'Cash'),
              ],
            )
          : null,
    );
  }
}
