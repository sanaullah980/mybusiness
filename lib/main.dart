import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'core/constants/colors.dart';
import 'core/security/app_lock_service.dart';
import 'core/theme/app_theme.dart';
import 'core/platform/backup_file_service.dart';
import 'data/local/app_database.dart';
import 'data/remote/backup_service.dart';
import 'data/remote/firebase_auth_service.dart';
import 'data/repositories/business_repository.dart';
import 'firebase_options.dart';
import 'presentation/common_widgets/responsive_shell.dart';
import 'presentation/screens/ai/ai_assistant_screen.dart';
import 'presentation/screens/auth/login_screen.dart';
import 'presentation/screens/cashbook/cashbook_screen.dart';
import 'presentation/screens/customers/customer_ledger_screen.dart';
import 'presentation/screens/customers/customers_list_screen.dart';
import 'presentation/screens/dashboard/dashboard_screen.dart';
import 'presentation/screens/expenses/expenses_screen.dart';
import 'presentation/screens/inventory/inventory_screen.dart';
import 'presentation/screens/invoices/invoice_detail_screen.dart';
import 'presentation/screens/purchases/purchases_screen.dart';
import 'presentation/screens/reminders/reminders_screen.dart';
import 'presentation/screens/reports/reports_screen.dart';
import 'presentation/screens/sales/sales_screen.dart';
import 'presentation/screens/settings/settings_screen.dart';
import 'presentation/screens/staff/staff_screen.dart';
import 'presentation/screens/suppliers/suppliers_screen.dart';
import 'presentation/screens/team/team_management_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Web uses the existing web app configuration. Android uses the native
  // google-services.json generated for the same Firebase project.
  if (kIsWeb) {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.web);
  } else if (defaultTargetPlatform == TargetPlatform.android) {
    await Firebase.initializeApp();
  } else {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  }
  try {
    await FirebaseFirestore.instance.enableNetwork();
  } catch (_) {}
  runApp(const MyBusinessApp());
}

class MyBusinessApp extends StatefulWidget {
  const MyBusinessApp({super.key});

  @override
  State<MyBusinessApp> createState() => _MyBusinessAppState();
}

class _MyBusinessAppState extends State<MyBusinessApp> {
  final FirebaseAuthService _authService = FirebaseAuthService();
  final AppLockService _lockService = AppLockService();

  BusinessRepository? _repo;
  AppDatabase? _database;
  StreamSubscription<User?>? _authSub;
  int _currentIndex = 0;
  bool _isLocked = false;
  bool _booting = true;
  String? _activeCustomerLedgerId;
  String? _activeInvoiceId;
  Future<void>? _bootstrapFuture;
  Timer? _syncTimer;

  @override
  void initState() {
    super.initState();
    _authSub = FirebaseAuth.instance.authStateChanges().listen((user) async {
      if (user == null) {
        if (mounted) setState(() { _repo = null; _booting = false; });
        return;
      }
      await _bootstrapUser();
    });
    if (FirebaseAuth.instance.currentUser != null) {
      _bootstrapUser();
    } else {
      _booting = false;
    }
  }

  Future<void> _bootstrapUser() async {
    if (_bootstrapFuture != null) return _bootstrapFuture!;
    final future = _bootstrapUserInternal();
    _bootstrapFuture = future;
    try {
      await future;
    } finally {
      _bootstrapFuture = null;
    }
  }

  Future<void> _bootstrapUserInternal() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      if (mounted) setState(() => _booting = false);
      return;
    }
    try {
      final ownerId = await _authService.resolveOwnerId();
      await _database?.close();
      final database = await AppDatabase.open(ownerId);
      final repo = BusinessRepository(ownerId: ownerId, database: database);
      await repo.initialize();
      final hasPin = await _lockService.isPinSet();
      if (!mounted) return;
      setState(() {
        _database = database;
        _repo = repo;
        _isLocked = hasPin;
        _booting = false;
        _syncTimer?.cancel();
        _syncTimer = Timer.periodic(const Duration(seconds: 30), (_) {
          _repo?.syncNow();
        });
      });
    } catch (e) {
      if (mounted) {
        setState(() => _booting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open local business data: $e')),
        );
      }
    }
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _syncTimer?.cancel();
    _database?.close();
    super.dispose();
  }

  String _getTitleForIndex(int idx) {
    const titles = [
      'Dashboard','New Sale (POS)','Khata (Customers)','Inventory (Stock)','Cash Book',
      'Stock Purchases','Suppliers Book','Invoices & Bills','Shop Expenses','Staff & Attendance',
      'Reminders','Reports & Analytics','Team & Permissions','Settings & Backup',
    ];
    return idx >= 0 && idx < titles.length ? titles[idx] : 'MyBusiness';
  }

  @override
  Widget build(BuildContext context) {
    if (_booting) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.getTheme('teal'),
        home: const Scaffold(body: Center(child: CircularProgressIndicator())),
      );
    }

    final repo = _repo;
    if (repo == null) {
      return MaterialApp(
        title: 'MyBusiness',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.getTheme('teal'),
        home: LoginScreen(
          authService: _authService,
          onLoginSuccess: _bootstrapUser,
        ),
      );
    }

    final themeName = repo.settings['theme'] as String? ?? 'teal';
    final isDark = repo.settings['darkMode'] == true;
    return MaterialApp(
      title: 'MyBusiness',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.getTheme(themeName, isDark: false),
      darkTheme: AppTheme.getTheme(themeName, isDark: true),
      themeMode: isDark ? ThemeMode.dark : ThemeMode.light,
      home: _isLocked ? _buildLockScreen() : _buildMainApp(repo),
    );
  }

  Widget _buildLockScreen() {
    final pinCtrl = TextEditingController();
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock, size: 64, color: AppColors.tealPrimary),
              const SizedBox(height: 16),
              const Text('Enter Security PIN', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              TextField(
                controller: pinCtrl, keyboardType: TextInputType.number, maxLength: 4,
                obscureText: true, autofocus: true, textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24, letterSpacing: 8),
                decoration: const InputDecoration(border: OutlineInputBorder()),
                onChanged: (val) async {
                  if (val.length != 4) return;
                  final valid = await _lockService.verifyPin(val);
                  if (!mounted) return;
                  if (valid) setState(() => _isLocked = false);
                  else {
                    pinCtrl.clear();
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Incorrect PIN')));
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMainApp(BusinessRepository repo) {
    if (_activeCustomerLedgerId != null) {
      final id = _activeCustomerLedgerId!;
      final customer = repo.customers.firstWhere((c) => c['id'] == id, orElse: () => {'name': 'Customer', 'balance': 0.0});
      final transactions = repo.customerTransactions.where((t) => t['customerId'] == id).toList()
        ..sort((a, b) => (b['date'] ?? '').toString().compareTo((a['date'] ?? '').toString()));
      return CustomerLedgerScreen(
        customer: customer,
        transactions: transactions,
        onRecordPayment: (amt, note) async { await repo.recordCustomerPayment(id, amt, note); setState(() {}); },
        onRecordDebt: (amt, note) async { await repo.recordCustomerDebt(id, amt, note); setState(() {}); },
        onOpenInvoice: (saleId) => setState(() => _activeInvoiceId = saleId),
        onDeleteCustomer: () async { await repo.deleteCustomer(id); setState(() => _activeCustomerLedgerId = null); },
      );
    }

    if (_activeInvoiceId != null) {
      final sale = repo.sales.firstWhere((s) => s['id'] == _activeInvoiceId, orElse: () => {'total': 0.0, 'items': []});
      return InvoiceDetailScreen(
        sale: sale,
        shopSettings: repo.settings,
        onProcessReturn: (items, note) async {
          await repo.processSaleReturn(_activeInvoiceId!, items, note);
          setState(() {});
        },
      );
    }

    Widget currentBody;
    switch (_currentIndex) {
      case 0:
        currentBody = DashboardScreen(
          todaySales: repo.sales.fold(0.0, (s, i) => s + ((i['total'] as num?)?.toDouble() ?? 0.0)),
          todayProfit: repo.sales.fold(0.0, (s, i) => s + ((i['totalProfit'] as num?)?.toDouble() ?? 0.0)),
          totalReceivable: repo.customers.fold(0.0, (s, c) => s + ((c['balance'] as num?)?.toDouble() ?? 0.0)),
          lowStockCount: repo.products.where((p) => ((p['stock'] as num?)?.toInt() ?? 0) <= ((p['minStock'] as num?)?.toInt() ?? 5)).length,
          recentSales: repo.sales.take(5).toList(),
          onNewSale: () => setState(() => _currentIndex = 1),
          onOpenKhata: () => setState(() => _currentIndex = 2),
          onOpenInventory: () => setState(() => _currentIndex = 3),
          onOpenCashBook: () => setState(() => _currentIndex = 4),
          onOpenExpenses: () => setState(() => _currentIndex = 8),
          onOpenReports: () => setState(() => _currentIndex = 11),
        );
        break;
      case 1:
        currentBody = SalesScreen(
          products: repo.products,
          customers: repo.customers,
          nextInvoiceNumber: (repo.settings['nextInvoiceNumber'] as num?)?.toInt() ?? 1,
          onCompleteSale: (data) async { await repo.recordSale(data); setState(() {}); },
        );
        break;
      case 2:
        currentBody = CustomersListScreen(
          customers: repo.customers,
          onSelectCustomer: (id) => setState(() => _activeCustomerLedgerId = id),
          onAddCustomer: (c) async { await repo.addCustomer(c); setState(() {}); },
        );
        break;
      case 3:
        currentBody = InventoryScreen(
          products: repo.products,
          onSaveProduct: (p) async { await repo.saveProduct(p); setState(() {}); },
          onDeleteProduct: (id) async { await repo.deleteProduct(id); setState(() {}); },
          onAdjustStock: (id, type, qty, note) async { await repo.adjustStock(id, type, qty, note); setState(() {}); },
        );
        break;
      case 4:
        currentBody = CashbookScreen(
          openingBalance: (repo.settings['cashOpeningBalance'] as num?)?.toDouble() ?? 0,
          entries: repo.getCashEntries(),
          onAddManualEntry: (type, amount, note) async { await repo.addCashTransaction(type, amount, note); setState(() {}); },
          onSetOpeningBalance: (value) async { await repo.updateSettings({...repo.settings, 'cashOpeningBalance': value}); setState(() {}); },
        );
        break;
      case 5:
        currentBody = PurchasesScreen(
          purchases: repo.stockPurchases,
          suppliers: repo.suppliers,
          products: repo.products,
          onAddPurchase: (p) async { await repo.addStockPurchase(p); setState(() {}); },
          onOpenBillScanner: () => ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Bill OCR is intentionally disabled in this Flutter build. Manual purchase entry remains available.')),
          ),
        );
        break;
      case 6:
        currentBody = SuppliersScreen(
          suppliers: repo.suppliers,
          onAddSupplier: (s) async { await repo.addSupplier(s); setState(() {}); },
          onPaySupplier: (id, amount, note) async { await repo.paySupplier(id, amount, note); setState(() {}); },
          onCreditPurchase: (id, amount, note) async { await repo.creditPurchaseSupplier(id, amount, note); setState(() {}); },
        );
        break;
      case 7:
        currentBody = _buildInvoicesListView(repo);
        break;
      case 8:
        currentBody = ExpensesScreen(
          expenses: repo.expenses,
          onAddExpense: (e) async { await repo.addExpense(e); setState(() {}); },
          onDeleteExpense: (id) async { await repo.deleteExpense(id); setState(() {}); },
        );
        break;
      case 9:
        currentBody = StaffScreen(
          staffList: repo.staff,
          attendanceRecords: repo.attendance,
          onAddStaff: (s) async { await repo.addStaff(s); setState(() {}); },
          onMarkAttendance: (id, status, date) async { await repo.markAttendance(id, status, date); setState(() {}); },
        );
        break;
      case 10:
        currentBody = RemindersScreen(
          reminders: repo.reminders,
          onAddReminder: (r) async { await repo.addReminder(r); setState(() {}); },
          onToggleComplete: (id, value) async { await repo.toggleReminder(id, value); setState(() {}); },
          onDeleteReminder: (id) async { await repo.deleteReminder(id); setState(() {}); },
        );
        break;
      case 11:
        currentBody = ReportsScreen(stats: repo.calculateReportStats(), dateRangeLabel: 'Today', onFilterChanged: (_) => setState(() {}));
        break;
      case 12:
        currentBody = TeamManagementScreen(
          members: repo.teamMembers,
          onCreateInvite: (code, permissions) async {
            try { await repo.createInvite(code, permissions); if (mounted) setState(() {}); }
            catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Invite could not be created: $e'))); }
          },
          onToggleMemberActive: (id, active) async {
            try { await repo.toggleMemberActive(id, active); if (mounted) setState(() {}); }
            catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not update employee: $e'))); }
          },
        );
        break;
      case 13:
        currentBody = SettingsScreen(
          settings: repo.settings,
          isPinEnabled: _isLocked,
          onUpdateSettings: (s) async { await repo.updateSettings(s); setState(() {}); },
          onExportBackup: () async {
            final json = BackupService.exportToJson(collections: repo.exportCollections(), settings: repo.settings);
            await exportBackupFile(json, BackupService.generateFileName());
            if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Backup file created.')));
          },
          onImportBackup: () async {
            final json = await importBackupFile();
            if (json == null) return;
            try {
              final backup = BackupService.parseAndValidateJson(json);
              await repo.importBackup(backup);
              if (mounted) { setState(() {}); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Backup restored.'))); }
            } catch (e) {
              if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Restore failed: $e')));
            }
          },
          onSetPin: (pin) async { await _lockService.setPin(pin); setState(() {}); },
          onRemovePin: () async { await _lockService.removePin(); setState(() => _isLocked = false); },
          onSignOut: () async { await _authService.signOut(); },
        );
        break;
      default:
        currentBody = const SizedBox.shrink();
    }

    return ResponsiveShell(
      currentIndex: _currentIndex,
      title: _getTitleForIndex(_currentIndex),
      onNavigationChanged: (idx) => setState(() { _currentIndex = idx; _activeCustomerLedgerId = null; _activeInvoiceId = null; }),
      actions: [
        IconButton(
          icon: const Icon(Icons.auto_awesome, color: Colors.amber),
          tooltip: 'AI Shop Assistant (Qwen)',
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AiAssistantScreen(
            onExecuteTool: (call) async {
              if (call.toolName == 'check_stock') {
                final name = (call.arguments['product_name'] ?? '').toString().toLowerCase();
                final found = repo.products.where((p) => (p['name'] as String? ?? '').toLowerCase().contains(name));
                if (found.isEmpty) return 'No product matching "$name" was found in stock.';
                final p = found.first;
                return '${p['name']}: ${p['stock']} in stock. Wholesale: Rs. ${p['wholesalePrice'] ?? p['price']}, Retail: Rs. ${p['retailPrice'] ?? p['price']}.';
              }
              if (call.toolName == 'get_customer_balance') {
                final name = (call.arguments['customer_name'] ?? '').toString().toLowerCase();
                final found = repo.customers.where((c) => (c['name'] as String? ?? '').toLowerCase().contains(name));
                if (found.isEmpty) return 'No customer matching "$name" was found in Khata.';
                final c = found.first;
                return '${c['name']} has an outstanding balance of Rs. ${c['balance']}.';
              }
              if (call.toolName == 'check_daily_report') {
                final stats = repo.calculateReportStats();
                return 'Today: Sales Rs. ${stats.totalSales}, Gross Profit Rs. ${stats.knownProfit}, Expenses Rs. ${stats.totalExpenses}, Net Profit Rs. ${stats.netProfit}.';
              }
              if (call.toolName == 'add_expense') {
                final amount = (call.arguments['amount'] as num).toDouble();
                await repo.addExpense({'amount': amount, 'category': call.arguments['category'] ?? 'General', 'note': call.arguments['note'] ?? 'Via AI', 'date': DateTime.now().toIso8601String()});
                if (mounted) setState(() {});
                return 'Expense recorded: Rs. $amount.';
              }
              if (call.toolName == 'record_customer_payment') {
                final amount = (call.arguments['amount'] as num).toDouble();
                final name = (call.arguments['customer_name'] ?? '').toString().toLowerCase();
                final c = repo.customers.firstWhere((x) => (x['name'] as String? ?? '').toLowerCase().contains(name), orElse: () => {});
                if (c.isEmpty) return 'Customer not found.';
                await repo.recordCustomerPayment(c['id'], amount, call.arguments['note']?.toString() ?? 'Via AI');
                if (mounted) setState(() {});
                return 'Payment recorded for ${c['name']}: Rs. $amount.';
              }
              return 'Tool is not available.';
            },
          ))),
        ),
      ],
      body: currentBody,
    );
  }

  Widget _buildInvoicesListView(BusinessRepository repo) {
    if (repo.sales.isEmpty) return const Center(child: Text('No invoices recorded yet.'));
    return ListView.separated(
      padding: const EdgeInsets.all(16), itemCount: repo.sales.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final s = repo.sales[index];
        final billNo = s['invoiceNumber'] != null ? '#${s['invoiceNumber']}' : '';
        final customer = s['customerName'] ?? 'Walk-in';
        final total = (s['total'] as num?)?.toDouble() ?? 0;
        final due = (s['amountDue'] as num?)?.toDouble() ?? 0;
        return Card(
          child: ListTile(
            onTap: () => setState(() => _activeInvoiceId = s['id']),
            leading: CircleAvatar(backgroundColor: AppColors.tealPrimary.withOpacity(0.12), child: Text(customer.toString().isNotEmpty ? customer.toString()[0].toUpperCase() : 'B', style: const TextStyle(color: AppColors.tealPrimary))),
            title: Text('Bill $billNo - $customer', style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text(due > 0 ? 'Due: Rs. $due' : 'Paid in full', style: TextStyle(color: due > 0 ? AppColors.danger : AppColors.success)),
            trailing: Text('Rs. $total', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ),
        );
      },
    );
  }
}
