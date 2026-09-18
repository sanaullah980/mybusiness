import 'dart:async';
import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:uuid/uuid.dart';

import '../../domain/calculations/cashbook_aggregator.dart';
import '../../domain/calculations/report_calculator.dart';
import '../../domain/calculations/return_calculator.dart';
import '../../domain/calculations/sale_calculator.dart';
import '../local/app_database.dart';

class BusinessRepository {
  final String ownerId;
  final FirebaseFirestore firestore;
  final AppDatabase database;
  final _uuid = const Uuid();

  final List<Map<String, dynamic>> _products = [];
  final List<Map<String, dynamic>> _customers = [];
  final List<Map<String, dynamic>> _sales = [];
  final List<Map<String, dynamic>> _expenses = [];
  final List<Map<String, dynamic>> _stockPurchases = [];
  final List<Map<String, dynamic>> _suppliers = [];
  final List<Map<String, dynamic>> _cashTransactions = [];
  final List<Map<String, dynamic>> _customerTransactions = [];
  final List<Map<String, dynamic>> _supplierTransactions = [];
  final List<Map<String, dynamic>> _stockAdjustments = [];
  final List<Map<String, dynamic>> _salesReturns = [];
  final List<Map<String, dynamic>> _staff = [];
  final List<Map<String, dynamic>> _attendance = [];
  final List<Map<String, dynamic>> _reminders = [];
  final List<Map<String, dynamic>> _teamMembers = [];

  Map<String, dynamic> _settings = {
    'shopName': 'My Shop',
    'name': 'My Shop',
    'phone': '',
    'address': '',
    'nextInvoiceNumber': 1,
    'cashOpeningBalance': 0.0,
    'theme': 'teal',
    'darkMode': false,
    'language': 'en',
  };

  BusinessRepository({
    required this.ownerId,
    required this.database,
    FirebaseFirestore? firestore,
  }) : firestore = firestore ?? FirebaseFirestore.instance;

  List<Map<String, dynamic>> get products => List.unmodifiable(_products);
  List<Map<String, dynamic>> get customers => List.unmodifiable(_customers);
  List<Map<String, dynamic>> get sales => List.unmodifiable(_sales);
  List<Map<String, dynamic>> get expenses => List.unmodifiable(_expenses);
  List<Map<String, dynamic>> get stockPurchases => List.unmodifiable(_stockPurchases);
  List<Map<String, dynamic>> get suppliers => List.unmodifiable(_suppliers);
  List<Map<String, dynamic>> get cashTransactions => List.unmodifiable(_cashTransactions);
  List<Map<String, dynamic>> get customerTransactions => List.unmodifiable(_customerTransactions);
  List<Map<String, dynamic>> get supplierTransactions => List.unmodifiable(_supplierTransactions);
  List<Map<String, dynamic>> get stockAdjustments => List.unmodifiable(_stockAdjustments);
  List<Map<String, dynamic>> get salesReturns => List.unmodifiable(_salesReturns);
  List<Map<String, dynamic>> get staff => List.unmodifiable(_staff);
  List<Map<String, dynamic>> get attendance => List.unmodifiable(_attendance);
  List<Map<String, dynamic>> get reminders => List.unmodifiable(_reminders);
  List<Map<String, dynamic>> get teamMembers => List.unmodifiable(_teamMembers);
  Map<String, dynamic> get settings => Map.unmodifiable(_settings);

  static const _collections = <String>[
    'products',
    'customers',
    'sales',
    'expenses',
    'stockPurchases',
    'customerTransactions',
    'stockAdjustments',
    'suppliers',
    'supplierTransactions',
    'cashTransactions',
    'salesReturns',
    'staff',
    'attendance',
    'reminders',
  ];

  List<Map<String, dynamic>> _listFor(String collection) {
    switch (collection) {
      case 'products': return _products;
      case 'customers': return _customers;
      case 'sales': return _sales;
      case 'expenses': return _expenses;
      case 'stockPurchases': return _stockPurchases;
      case 'customerTransactions': return _customerTransactions;
      case 'stockAdjustments': return _stockAdjustments;
      case 'suppliers': return _suppliers;
      case 'supplierTransactions': return _supplierTransactions;
      case 'cashTransactions': return _cashTransactions;
      case 'salesReturns': return _salesReturns;
      case 'staff': return _staff;
      case 'attendance': return _attendance;
      case 'reminders': return _reminders;
      case 'businessMembers': return _teamMembers;
      default: return <Map<String, dynamic>>[];
    }
  }

  Future<void> initialize() async {
    await _loadLocal();
    await syncNow();
  }

  Future<void> _loadLocal() async {
    for (final collection in _collections) {
      final target = _listFor(collection);
      target
        ..clear()
        ..addAll(await database.getCollection(collection));
    }
    _teamMembers
      ..clear()
      ..addAll(await database.getCollection('businessMembers'));

    final settings = await database.getCollection('settings');
    if (settings.isNotEmpty) {
      _settings = {..._settings, ...settings.first};
    }
  }

  Future<void> syncNow() async {
    // First push locally-created/changed records. Firestore failures are kept
    // as pending local records and retried by the next sync.
    try {
      final pending = await database.pendingRecords();
      for (final item in pending) {
        final collection = item['collection'] as String;
        final id = item['id'] as String;
        final deleted = item['deleted'] == true;
        try {
          if (deleted) {
            await firestore.collection(collection).doc(id).delete();
          } else {
            final payload = Map<String, dynamic>.from(item['payload'] as Map);
            payload['ownerId'] = ownerId;
            payload.remove('updatedAt');
            payload.remove('__pendingSync');
            payload.remove('__deleted');
            // The existing Firestore rules intentionally restrict employee
            // product writes to a stock-only diff. Merge preserves all other
            // fields already stored in the document.
            await firestore.collection(collection).doc(id).set(payload, SetOptions(merge: true));
          }
          await database.markSynced(collection, id);
        } catch (_) {
          // Stay offline-first. The pending marker is deliberately preserved.
        }
      }

      for (final collection in _collections) {
        try {
          final snapshot = await firestore
              .collection(collection)
              .where('ownerId', isEqualTo: ownerId)
              .get(const GetOptions(source: Source.server));
          for (final doc in snapshot.docs) {
            final data = _normalizeFirestore(doc.data());
            data['id'] = doc.id;
            data['ownerId'] = ownerId;
            final localPending = (await database.pendingRecords()).any(
              (p) => p['collection'] == collection && p['id'] == doc.id,
            );
            if (!localPending) {
              await database.upsert(collection, doc.id, data, pendingSync: false);
              _replaceInMemory(collection, data);
            }
          }
        } catch (_) {
          // Network/offline cache failure is non-fatal.
        }
      }

      try {
        final settingsDoc = await firestore.collection('settings').doc(ownerId).get(
          const GetOptions(source: Source.server),
        );
        if (settingsDoc.exists) {
          final data = _normalizeFirestore(settingsDoc.data()!);
          data['ownerId'] = ownerId;
          await database.upsert('settings', ownerId, data, pendingSync: false);
          _settings = {..._settings, ...data};
        }
      } catch (_) {}

      try {
        final members = await firestore
            .collection('businessMembers')
            .where('ownerId', isEqualTo: ownerId)
            .get(const GetOptions(source: Source.server));
        for (final doc in members.docs) {
          final data = _normalizeFirestore(doc.data());
          data['id'] = doc.id;
          data['ownerId'] = ownerId;
          await database.upsert('businessMembers', doc.id, data, pendingSync: false);
          _replaceInMemory('businessMembers', data);
        }
      } catch (_) {}
    } catch (_) {
      // Never make local business data unavailable because cloud sync failed.
    }
  }

  Map<String, dynamic> _normalizeFirestore(Map<String, dynamic> data) {
    return data.map((key, value) {
      if (value is Timestamp) return MapEntry(key, value.toDate().toIso8601String());
      if (value is GeoPoint) return MapEntry(key, {'latitude': value.latitude, 'longitude': value.longitude});
      return MapEntry(key, value);
    });
  }

  void _replaceInMemory(String collection, Map<String, dynamic> data) {
    final list = _listFor(collection);
    final id = data['id'];
    if (id == null) return;
    final index = list.indexWhere((e) => e['id'] == id);
    if (index >= 0) list[index] = Map<String, dynamic>.from(data);
    else list.add(Map<String, dynamic>.from(data));
  }

  Future<void> _save(String collection, Map<String, dynamic> data) async {
    final id = data['id']?.toString();
    if (id == null || id.isEmpty) throw ArgumentError('A record id is required.');
    final record = {
      ...data,
      'id': id,
      'ownerId': ownerId,
      'updatedAt': DateTime.now().toIso8601String(),
    };
    await database.upsert(collection, id, record, pendingSync: true);
    _replaceInMemory(collection, record);
    unawaited(syncNow());
  }

  Future<void> _delete(String collection, String id) async {
    await database.delete(collection, id, pendingSync: true);
    _listFor(collection).removeWhere((e) => e['id'] == id);
    unawaited(syncNow());
  }

  String _id(String prefix) => '${prefix}_${_uuid.v4()}';

  // ---------- Products / stock ----------
  Future<void> saveProduct(Map<String, dynamic> product) async {
    final id = (product['id'] ?? _id('prod')).toString();
    await _save('products', {...product, 'id': id});
  }

  Future<void> deleteProduct(String productId) => _delete('products', productId);

  Future<void> adjustStock(String productId, String type, int qty, String note) async {
    final index = _products.indexWhere((p) => p['id'] == productId);
    if (index < 0 || qty <= 0) return;
    final current = (_products[index]['stock'] as num?)?.toInt() ?? 0;
    final updated = type == 'add' ? current + qty : (current - qty).clamp(0, 1 << 30);
    _products[index]['stock'] = updated;
    await _save('products', _products[index]);
    await _save('stockAdjustments', {
      'id': _id('adj'),
      'productId': productId,
      'type': type,
      'quantity': qty,
      'date': DateTime.now().toIso8601String(),
      'note': note,
    });
  }

  // ---------- Customers / Khata ----------
  Future<void> addCustomer(Map<String, dynamic> customer) async {
    await _save('customers', {
      ...customer,
      'id': (customer['id'] ?? _id('cust')).toString(),
      'balance': (customer['balance'] as num?)?.toDouble() ?? 0.0,
      'createdAt': customer['createdAt'] ?? DateTime.now().toIso8601String(),
    });
  }

  Future<void> deleteCustomer(String customerId) => _delete('customers', customerId);

  Future<void> recordCustomerPayment(String customerId, double amount, String note) async {
    if (amount <= 0) return;
    final index = _customers.indexWhere((c) => c['id'] == customerId);
    if (index < 0) return;
    final balance = (_customers[index]['balance'] as num?)?.toDouble() ?? 0.0;
    final next = (balance - amount).clamp(0.0, double.infinity);
    _customers[index]['balance'] = next;
    await _save('customers', _customers[index]);
    await _save('customerTransactions', {
      'id': _id('ctx'),
      'customerId': customerId,
      'type': 'payment',
      'amount': amount,
      'creditAmount': amount,
      'balanceAfter': next,
      'note': note.isNotEmpty ? note : 'Cash payment received',
      'date': DateTime.now().toIso8601String(),
    });
  }

  Future<void> recordCustomerDebt(String customerId, double amount, String note) async {
    if (amount <= 0) return;
    final index = _customers.indexWhere((c) => c['id'] == customerId);
    if (index < 0) return;
    final balance = (_customers[index]['balance'] as num?)?.toDouble() ?? 0.0;
    final next = balance + amount;
    _customers[index]['balance'] = next;
    await _save('customers', _customers[index]);
    await _save('customerTransactions', {
      'id': _id('ctx'),
      'customerId': customerId,
      'type': 'manual_debt',
      'amount': amount,
      'debitAmount': amount,
      'balanceAfter': next,
      'note': note.isNotEmpty ? note : 'Credit added',
      'date': DateTime.now().toIso8601String(),
    });
  }

  // ---------- Sales ----------
  Future<void> recordSale(Map<String, dynamic> saleData) async {
    final id = (saleData['id'] ?? _id('sale')).toString();
    final items = ((saleData['items'] as List?) ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    final due = (saleData['amountDue'] as num?)?.toDouble() ?? 0.0;
    final customerId = saleData['customerId']?.toString();

    final sale = {
      ...saleData,
      'id': id,
      'ownerId': ownerId,
      'createdBy': saleData['createdBy'] ?? FirebaseAuth.instance.currentUser?.uid,
      'createdByName': saleData['createdByName'] ?? FirebaseAuth.instance.currentUser?.displayName,
      'items': items,
      'date': saleData['date'] ?? DateTime.now().toIso8601String(),
    };
    await _save('sales', sale);

    for (final item in items) {
      final productId = item['id']?.toString();
      final qty = (item['qty'] as num?)?.toInt() ?? 0;
      if (productId == null || qty <= 0) continue;
      final p = _products.firstWhere((x) => x['id'] == productId, orElse: () => {});
      if (p.isEmpty) continue;
      final current = (p['stock'] as num?)?.toInt() ?? 0;
      p['stock'] = (current - qty).clamp(0, 1 << 30);
      await _save('products', p);
    }

    if (due > 0 && customerId != null && customerId.isNotEmpty) {
      final c = _customers.firstWhere((x) => x['id'] == customerId, orElse: () => {});
      if (c.isNotEmpty) {
        final next = ((_customerBalance(c)) + due);
        c['balance'] = next;
        await _save('customers', c);
        await _save('customerTransactions', {
          'id': _id('ctx'),
          'customerId': customerId,
          'saleId': id,
          'type': 'sale_debt',
          'amount': due,
          'debitAmount': due,
          'amountPaid': sale['amountPaid'] ?? 0,
          'amountDue': due,
          'balanceAfter': next,
          'billNo': sale['invoiceNumber'],
          'note': 'Bill #${sale['invoiceNumber']}',
          'date': sale['date'],
        });
      }
    }

    final nextInvoice = ((_settings['nextInvoiceNumber'] as num?)?.toInt() ?? 1) + 1;
    await updateSettings({..._settings, 'nextInvoiceNumber': nextInvoice});
  }

  double _customerBalance(Map<String, dynamic> c) => (c['balance'] as num?)?.toDouble() ?? 0.0;

  // ---------- Purchases / suppliers ----------
  Future<void> addStockPurchase(Map<String, dynamic> purchase) async {
    final id = (purchase['id'] ?? _id('purch')).toString();
    final record = {...purchase, 'id': id, 'date': purchase['date'] ?? DateTime.now().toIso8601String()};
    await _save('stockPurchases', record);

    final items = ((purchase['items'] as List?) ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map));
    for (final item in items) {
      final productId = item['productId']?.toString();
      final qty = (item['qty'] as num?)?.toInt() ?? 0;
      if (productId == null || qty <= 0) continue;
      final p = _products.firstWhere((x) => x['id'] == productId, orElse: () => {});
      if (p.isEmpty) continue;
      p['stock'] = ((_pStock(p)) + qty);
      if (item['unitCost'] != null) p['cost'] = (item['unitCost'] as num).toDouble();
      await _save('products', p);
    }

    final due = (purchase['amountDue'] as num?)?.toDouble() ?? 0.0;
    final supplierId = purchase['supplierId']?.toString();
    if (due > 0 && supplierId != null && supplierId.isNotEmpty) {
      await creditPurchaseSupplier(supplierId, due, 'Purchase #$id');
      await _save('supplierTransactions', {
        'id': _id('stx'),
        'supplierId': supplierId,
        'type': 'purchase_debt',
        'amount': due,
        'purchaseId': id,
        'date': record['date'],
        'note': 'Stock purchase',
      });
    }
  }

  int _pStock(Map<String, dynamic> p) => (p['stock'] as num?)?.toInt() ?? 0;

  Future<void> addSupplier(Map<String, dynamic> supplier) async {
    await _save('suppliers', {
      ...supplier,
      'id': (supplier['id'] ?? _id('sup')).toString(),
      'balance': (supplier['balance'] as num?)?.toDouble() ?? 0.0,
      'createdAt': supplier['createdAt'] ?? DateTime.now().toIso8601String(),
    });
  }

  Future<void> paySupplier(String supplierId, double amount, String note) async {
    if (amount <= 0) return;
    final s = _suppliers.firstWhere((x) => x['id'] == supplierId, orElse: () => {});
    if (s.isEmpty) return;
    s['balance'] = maxDouble(0, ((s['balance'] as num?)?.toDouble() ?? 0) - amount);
    await _save('suppliers', s);
    await _save('supplierTransactions', {
      'id': _id('stx'),
      'supplierId': supplierId,
      'type': 'payment',
      'amount': amount,
      'balanceAfter': s['balance'],
      'date': DateTime.now().toIso8601String(),
      'note': note,
    });
  }

  Future<void> creditPurchaseSupplier(String supplierId, double amount, String note) async {
    if (amount <= 0) return;
    final s = _suppliers.firstWhere((x) => x['id'] == supplierId, orElse: () => {});
    if (s.isEmpty) return;
    s['balance'] = ((s['balance'] as num?)?.toDouble() ?? 0) + amount;
    await _save('suppliers', s);
  }

  static double maxDouble(double a, double b) => a > b ? a : b;

  // ---------- Expenses / cashbook ----------
  Future<void> addExpense(Map<String, dynamic> expense) async {
    await _save('expenses', {
      ...expense,
      'id': (expense['id'] ?? _id('exp')).toString(),
      'date': expense['date'] ?? DateTime.now().toIso8601String(),
    });
  }

  Future<void> deleteExpense(String expenseId) => _delete('expenses', expenseId);

  Future<void> addCashTransaction(String type, double amount, String note) async {
    if (amount <= 0) return;
    await _save('cashTransactions', {
      'id': _id('cash'),
      'type': type,
      'amount': amount,
      'date': DateTime.now().toIso8601String(),
      'note': note,
    });
  }

  List<CashEntry> getCashEntries() {
    final entries = <CashEntry>[];
    for (final s in _sales) {
      final paid = (s['amountPaid'] as num?)?.toDouble() ?? 0.0;
      if (paid > 0) {
        entries.add(CashEntry(
          date: _date(s['date']), type: CashFlowType.inFlow, amount: paid,
          label: 'Bill #${s['invoiceNumber']} (${s['customerName'] ?? 'Walk-in'})', source: 'sale',
        ));
      }
    }
    for (final ct in _customerTransactions.where((x) => x['type'] == 'payment')) {
      entries.add(CashEntry(
        date: _date(ct['date']), type: CashFlowType.inFlow,
        amount: (ct['amount'] as num?)?.toDouble() ?? 0,
        label: 'Khata Payment: ${ct['note'] ?? ''}', source: 'customer_payment',
      ));
    }
    for (final st in _supplierTransactions.where((x) => x['type'] == 'payment')) {
      entries.add(CashEntry(
        date: _date(st['date']), type: CashFlowType.outFlow,
        amount: (st['amount'] as num?)?.toDouble() ?? 0,
        label: 'Supplier Payment: ${st['note'] ?? ''}', source: 'supplier_payment',
      ));
    }
    for (final e in _expenses) {
      entries.add(CashEntry(
        date: _date(e['date']), type: CashFlowType.outFlow,
        amount: (e['amount'] as num?)?.toDouble() ?? 0,
        label: 'Expense: ${e['category']} - ${e['note'] ?? ''}', source: 'expense',
      ));
    }
    for (final p in _stockPurchases) {
      final paid = (p['amountPaid'] as num?)?.toDouble() ?? 0.0;
      if (paid > 0) {
        entries.add(CashEntry(
          date: _date(p['date']), type: CashFlowType.outFlow, amount: paid,
          label: 'Stock Purchase: ${p['supplierName'] ?? p['supplier'] ?? 'Cash'}', source: 'stock_purchase',
        ));
      }
    }
    for (final r in _salesReturns) {
      final refund = (r['cashRefund'] as num?)?.toDouble() ?? 0.0;
      if (refund > 0) {
        entries.add(CashEntry(
          date: _date(r['date']), type: CashFlowType.outFlow, amount: refund,
          label: 'Sales Return', source: 'sales_return',
        ));
      }
    }
    for (final c in _cashTransactions) {
      entries.add(CashEntry(
        date: _date(c['date']),
        type: c['type'] == 'income' ? CashFlowType.inFlow : CashFlowType.outFlow,
        amount: (c['amount'] as num?)?.toDouble() ?? 0,
        label: c['note'] ?? 'Manual cash entry', source: 'cash_transaction',
      ));
    }
    return entries..sort((a, b) => b.date.compareTo(a.date));
  }

  DateTime _date(dynamic value) => DateTime.tryParse(value?.toString() ?? '') ?? DateTime.now();

  // ---------- Returns ----------
  Future<void> processSaleReturn(
    String saleId,
    List<SaleItemDraft> returnedItems,
    String note,
  ) async {
    final sale = _sales.firstWhere((x) => x['id'] == saleId, orElse: () => {});
    if (sale.isEmpty || returnedItems.isEmpty) return;

    final result = ReturnCalculator.calculateReturn(
      returnedItems: returnedItems,
      originalSubtotal: (sale['subtotal'] as num?)?.toDouble() ?? 0,
      originalDiscount: (sale['discount'] as num?)?.toDouble() ?? 0,
      existingSaleDue: (sale['amountDue'] as num?)?.toDouble() ?? 0,
    );

    final saleItems = ((sale['items'] as List?) ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map)).toList();
    for (final returned in returnedItems) {
      final item = saleItems.firstWhere((x) => x['id'] == returned.id, orElse: () => {});
      if (item.isEmpty) continue;
      final originalQty = (item['qty'] as num?)?.toInt() ?? 0;
      final oldReturned = (item['returnedQty'] as num?)?.toInt() ?? 0;
      final newReturned = (oldReturned + returned.qty).clamp(0, originalQty);
      item['returnedQty'] = newReturned;

      final product = _products.firstWhere((x) => x['id'] == returned.id, orElse: () => {});
      if (product.isNotEmpty) {
        product['stock'] = _pStock(product) + returned.qty;
        await _save('products', product);
      }
    }

    sale['items'] = saleItems;
    sale['returnedAmount'] = ((sale['returnedAmount'] as num?)?.toDouble() ?? 0) + result.refundAmount;
    sale['returnedProfit'] = ((sale['returnedProfit'] as num?)?.toDouble() ?? 0) + result.profitReversal;
    sale['amountDue'] = maxDouble(0, ((sale['amountDue'] as num?)?.toDouble() ?? 0) - result.dueReduction);
    await _save('sales', sale);

    if (result.dueReduction > 0 && sale['customerId'] != null) {
      final c = _customers.firstWhere((x) => x['id'] == sale['customerId'], orElse: () => {});
      if (c.isNotEmpty) {
        c['balance'] = maxDouble(0, _customerBalance(c) - result.dueReduction);
        await _save('customers', c);
        await _save('customerTransactions', {
          'id': _id('ctx'), 'customerId': sale['customerId'], 'saleId': saleId,
          'type': 'return_credit', 'amount': result.dueReduction,
          'creditAmount': result.dueReduction, 'balanceAfter': c['balance'],
          'note': note.isEmpty ? 'Sales return' : note, 'date': DateTime.now().toIso8601String(),
        });
      }
    }

    await _save('salesReturns', {
      'id': _id('ret'), 'saleId': saleId, 'customerId': sale['customerId'],
      'items': returnedItems.map((i) => i.toJson()).toList(),
      'refundAmount': result.refundAmount, 'profitReversal': result.profitReversal,
      'dueReduction': result.dueReduction, 'cashRefund': result.cashRefund,
      'date': DateTime.now().toIso8601String(), 'note': note,
    });
  }

  // ---------- Staff / attendance ----------
  Future<void> addStaff(Map<String, dynamic> staff) async {
    await _save('staff', {
      ...staff,
      'id': (staff['id'] ?? _id('staff')).toString(),
      'createdAt': staff['createdAt'] ?? DateTime.now().toIso8601String(),
    });
  }

  Future<void> markAttendance(String staffId, String status, String dateStr) async {
    final id = '${staffId}_$dateStr';
    await _save('attendance', {
      'id': id,
      'staffId': staffId,
      'dateStr': dateStr,
      'status': status,
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  // ---------- Reminders ----------
  Future<void> addReminder(Map<String, dynamic> reminder) async {
    await _save('reminders', {
      ...reminder,
      'id': (reminder['id'] ?? _id('rem')).toString(),
      'completed': reminder['completed'] == true,
      'createdAt': reminder['createdAt'] ?? DateTime.now().toIso8601String(),
    });
  }

  Future<void> toggleReminder(String id, bool completed) async {
    final r = _reminders.firstWhere((x) => x['id'] == id, orElse: () => {});
    if (r.isEmpty) return;
    r['completed'] = completed;
    r['completedAt'] = completed ? DateTime.now().toIso8601String() : null;
    await _save('reminders', r);
  }

  Future<void> deleteReminder(String id) => _delete('reminders', id);

  // ---------- Team / invites ----------
  Future<String> createInvite(String code, Map<String, bool> permissions) async {
    final payload = {
      'ownerId': ownerId,
      'status': 'pending',
      'permissions': permissions,
      'createdAt': FieldValue.serverTimestamp(),
    };
    await firestore.collection('businessInvites').doc(code).set(payload);
    return code;
  }

  Future<void> toggleMemberActive(String memberId, bool active) async {
    await firestore.collection('businessMembers').doc(memberId).update({'active': active});
    final member = _teamMembers.firstWhere((x) => x['id'] == memberId, orElse: () => {});
    if (member.isNotEmpty) {
      member['active'] = active;
      await database.upsert('businessMembers', memberId, member, pendingSync: false);
    }
  }

  // ---------- Settings ----------
  Future<void> updateSettings(Map<String, dynamic> newSettings) async {
    _settings = {..._settings, ...newSettings, 'ownerId': ownerId};
    await database.upsert('settings', ownerId, _settings, pendingSync: true);
    try {
      await firestore.collection('settings').doc(ownerId).set({
        ..._settings,
        'ownerId': ownerId,
      }, SetOptions(merge: true));
      await database.markSynced('settings', ownerId);
    } catch (_) {}
  }

  // ---------- Backup / restore ----------
  Map<String, List<Map<String, dynamic>>> exportCollections() {
    return {
      for (final c in _collections) c: _listFor(c).map((e) => Map<String, dynamic>.from(e)).toList(),
    };
  }

  String exportBackupJson() => const JsonEncoder.withIndent('  ').convert({
        'version': 1,
        'exportedAt': DateTime.now().toIso8601String(),
        'collections': exportCollections(),
        'settings': _settings,
      });

  Future<void> importBackup(Map<String, dynamic> backup) async {
    final collections = Map<String, dynamic>.from(backup['collections'] as Map);
    for (final collection in _collections) {
      final values = collections[collection];
      if (values is! List) continue;
      for (final raw in values) {
        final record = Map<String, dynamic>.from(raw as Map);
        if (record['ownerId'] != null && record['ownerId'] != ownerId) continue;
        record['ownerId'] = ownerId;
        if (record['id'] == null) continue;
        await database.upsert(collection, record['id'].toString(), record, pendingSync: true);
      }
    }
    final settings = backup['settings'];
    if (settings is Map) await updateSettings(Map<String, dynamic>.from(settings));
    await _loadLocal();
    unawaited(syncNow());
  }

  // ---------- Reporting ----------
  BusinessReportStats calculateReportStats() {
    double totalSales = 0;
    double knownProfit = 0;
    double wholesaleProfit = 0;
    double retailProfit = 0;
    for (final s in _sales) {
      totalSales += (s['total'] as num?)?.toDouble() ?? 0;
      final profit = (s['totalProfit'] as num?)?.toDouble() ?? 0;
      knownProfit += profit;
      if (s['saleType'] == 'wholesale') wholesaleProfit += profit; else retailProfit += profit;
    }
    final totalExpenses = _expenses.fold<double>(0, (sum, e) => sum + ((e['amount'] as num?)?.toDouble() ?? 0));
    final netProfit = knownProfit - totalExpenses;
    double stockValCost = 0, stockValPrice = 0;
    int lowCount = 0, outCount = 0;
    for (final p in _products) {
      final qty = _pStock(p);
      final minStock = (p['minStock'] as num?)?.toInt() ?? 5;
      final cost = (p['cost'] as num?)?.toDouble() ?? 0;
      final price = ((p['retailPrice'] ?? p['price']) as num?)?.toDouble() ?? 0;
      stockValCost += cost * qty;
      stockValPrice += price * qty;
      if (qty <= 0) outCount++; else if (qty <= minStock) lowCount++;
    }
    final cashSummary = CashBookAggregator.buildSummary(
      openingBalance: (_settings['cashOpeningBalance'] as num?)?.toDouble() ?? 0,
      entries: getCashEntries(),
    );
    return BusinessReportStats(
      totalSales: totalSales,
      knownProfit: knownProfit,
      wholesaleProfit: wholesaleProfit,
      retailProfit: retailProfit,
      unknownCount: 0,
      txCount: _sales.length,
      totalExpenses: totalExpenses,
      netProfit: netProfit,
      returnedAmount: _salesReturns.fold(0, (s, r) => s + ((r['refundAmount'] as num?)?.toDouble() ?? 0)),
      customerPayments: _customerTransactions.where((x) => x['type'] == 'payment').fold(0, (s, x) => s + ((x['amount'] as num?)?.toDouble() ?? 0)),
      newDebt: _customerTransactions.where((x) => x['type'] == 'sale_debt' || x['type'] == 'manual_debt').fold(0, (s, x) => s + ((x['amount'] as num?)?.toDouble() ?? 0)),
      outstandingDebt: _customers.fold(0, (s, c) => s + _customerBalance(c)),
      cashIn: cashSummary.totalIn,
      cashOut: cashSummary.totalOut,
      cashInHand: cashSummary.cashInHand,
      stockValueCost: stockValCost,
      stockValuePrice: stockValPrice,
      lowStockCount: lowCount,
      outOfStockCount: outCount,
      purchasesTotal: _stockPurchases.fold(0, (s, p) => s + ((p['amount'] as num?)?.toDouble() ?? 0)),
      purchasesPaid: _stockPurchases.fold(0, (s, p) => s + ((p['amountPaid'] as num?)?.toDouble() ?? 0)),
      purchasesDue: _stockPurchases.fold(0, (s, p) => s + ((p['amountDue'] as num?)?.toDouble() ?? 0)),
      totalReceivable: _customers.fold(0, (s, c) => s + _customerBalance(c)),
      totalPayable: _suppliers.fold(0, (s, p) => s + ((p['balance'] as num?)?.toDouble() ?? 0)),
      bestSellers: [],
    );
  }
}
