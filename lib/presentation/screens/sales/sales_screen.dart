import 'package:flutter/material.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../domain/calculations/sale_calculator.dart';
import 'product_picker_sheet.dart';

class SalesScreen extends StatefulWidget {
  final List<Map<String, dynamic>> products;
  final List<Map<String, dynamic>> customers;
  final int nextInvoiceNumber;
  final Function(Map<String, dynamic> saleData) onCompleteSale;

  const SalesScreen({
    super.key,
    required this.products,
    required this.customers,
    required this.nextInvoiceNumber,
    required this.onCompleteSale,
  });

  @override
  State<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends State<SalesScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<SaleItemDraft> _cart = [];
  String? _selectedCustomerId;
  final TextEditingController _discountController = TextEditingController(text: '0');
  final TextEditingController _paidController = TextEditingController();
  final TextEditingController _manualNameController = TextEditingController();
  final TextEditingController _manualAmountController = TextEditingController();
  final TextEditingController _manualProfitController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      setState(() {});
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _discountController.dispose();
    _paidController.dispose();
    _manualNameController.dispose();
    _manualAmountController.dispose();
    _manualProfitController.dispose();
    super.dispose();
  }

  SaleCalculationResult _calculateCurrentSale() {
    final discount = double.tryParse(_discountController.text) ?? 0.0;
    final paid = double.tryParse(_paidController.text) ?? 0.0;

    if (_tabController.index == 0) {
      // Wholesale
      return SaleCalculator.calculateWholesale(
        items: _cart,
        discountInput: discount,
        paidInput: _paidController.text.isEmpty
            ? _cart.fold(0.0, (s, i) => s + i.lineTotal) - discount
            : paid,
      );
    } else if (_tabController.index == 1) {
      // Retail: Strict Rule: never creates customer debt
      return SaleCalculator.calculateRetail(
        items: _cart,
        paidInput: _paidController.text.isEmpty
            ? _cart.fold(0.0, (s, i) => s + i.lineTotal)
            : paid,
      );
    } else {
      // Manual
      final total = double.tryParse(_manualAmountController.text) ?? 0.0;
      final amountPaid = _paidController.text.isEmpty ? total : paid;
      final profit = double.tryParse(_manualProfitController.text) ?? (total * 0.2);
      return SaleCalculationResult(
        subtotal: total,
        discount: 0.0,
        total: total,
        amountPaid: amountPaid,
        amountDue: total - amountPaid,
        totalProfit: profit,
        profitKnown: true,
      );
    }
  }

  void _openProductPicker() {
    final saleType = _tabController.index == 0 ? 'wholesale' : 'retail';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => ProductPickerSheet(
        products: widget.products,
        saleType: saleType,
        onApply: (selectedItems) {
          setState(() {
            for (final item in selectedItems) {
              final existingIndex = _cart.indexWhere((c) => c.id == item['id']);
              if (existingIndex >= 0) {
                final old = _cart[existingIndex];
                _cart[existingIndex] = SaleItemDraft(
                  id: old.id,
                  name: old.name,
                  cost: old.cost,
                  price: old.price,
                  qty: old.qty + (item['qty'] as int),
                );
              } else {
                _cart.add(SaleItemDraft(
                  id: item['id'] as String,
                  name: item['name'] as String,
                  cost: (item['cost'] as num).toDouble(),
                  price: (item['price'] as num).toDouble(),
                  qty: item['qty'] as int,
                ));
              }
            }
          });
        },
      ),
    );
  }

  void _submitSale() {
    final isManual = _tabController.index == 2;
    if (!isManual && _cart.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cart is empty. Add products to continue.')),
      );
      return;
    }

    if (isManual && _manualNameController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter an item name for manual sale.')),
      );
      return;
    }

    final calc = _calculateCurrentSale();
    final customer = widget.customers.firstWhere(
      (c) => c['id'] == _selectedCustomerId,
      orElse: () => {'name': 'Walk-in', 'id': null},
    );

    final saleType = _tabController.index == 0
        ? 'wholesale'
        : (_tabController.index == 1 ? 'retail' : 'manual');

    final saleData = {
      'saleType': saleType,
      'invoiceNumber': widget.nextInvoiceNumber,
      'date': DateTime.now().toIso8601String(),
      'customerId': customer['id'],
      'customerName': customer['name'],
      'items': _cart.map((i) => i.toJson()).toList(),
      'subtotal': calc.subtotal,
      'discount': calc.discount,
      'total': calc.total,
      'amountPaid': calc.amountPaid,
      'amountDue': calc.amountDue,
      'totalProfit': calc.totalProfit,
      'profitKnown': calc.profitKnown,
      'note': isManual ? _manualNameController.text.trim() : null,
    };

    widget.onCompleteSale(saleData);

    setState(() {
      _cart.clear();
      _selectedCustomerId = null;
      _discountController.text = '0';
      _paidController.clear();
      _manualNameController.clear();
      _manualAmountController.clear();
      _manualProfitController.clear();
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: AppColors.success,
        content: Text('Bill #${widget.nextInvoiceNumber} completed successfully!'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final calc = _calculateCurrentSale();

    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(48),
        child: Container(
          color: Theme.of(context).cardColor,
          child: TabBar(
            controller: _tabController,
            indicatorColor: AppColors.tealPrimary,
            labelColor: AppColors.tealPrimary,
            unselectedLabelColor: Colors.grey,
            tabs: const [
              Tab(text: 'Wholesale'),
              Tab(text: 'Retail'),
              Tab(text: 'Manual'),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          // Customer selection row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String?>(
                    value: _selectedCustomerId,
                    decoration: InputDecoration(
                      labelText: 'Customer (Khata)',
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('Walk-in Customer')),
                      ...widget.customers.map((c) => DropdownMenuItem(
                            value: c['id'] as String,
                            child: Text('${c['name']} (${CurrencyFormatter.format(c['balance'] ?? 0)})'),
                          )),
                    ],
                    onChanged: (val) => setState(() => _selectedCustomerId = val),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Bill #${widget.nextInvoiceNumber}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),

          // Main content: Cart or Manual form
          Expanded(
            child: _tabController.index == 2
                ? Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextField(
                          controller: _manualNameController,
                          decoration: const InputDecoration(
                            labelText: 'Item / Service Description *',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _manualAmountController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Total Sale Amount (Rs.) *',
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _manualProfitController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Estimated Profit (Rs.)',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ],
                    ),
                  )
                : Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Cart Items (${_cart.length})',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.tealPrimary,
                                foregroundColor: Colors.white,
                              ),
                              onPressed: _openProductPicker,
                              icon: const Icon(Icons.add, size: 18),
                              label: const Text('Add Products'),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Expanded(
                        child: _cart.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.shopping_cart_outlined, size: 48, color: Colors.grey),
                                    const SizedBox(height: 8),
                                    const Text('No products in cart', style: TextStyle(color: Colors.grey)),
                                    const SizedBox(height: 8),
                                    OutlinedButton(
                                      onPressed: _openProductPicker,
                                      child: const Text('+ Pick Products'),
                                    ),
                                  ],
                                ),
                              )
                            : ListView.separated(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                itemCount: _cart.length,
                                separatorBuilder: (_, __) => const Divider(height: 1),
                                itemBuilder: (context, index) {
                                  final item = _cart[index];
                                  return ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(item.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                                    subtitle: Text(
                                      '${CurrencyFormatter.format(item.price)} × ${item.qty} = ${CurrencyFormatter.format(item.lineTotal)}',
                                    ),
                                    trailing: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        IconButton(
                                          icon: const Icon(Icons.remove, size: 18),
                                          onPressed: () {
                                            setState(() {
                                              if (item.qty <= 1) {
                                                _cart.removeAt(index);
                                              } else {
                                                _cart[index] = SaleItemDraft(
                                                  id: item.id,
                                                  name: item.name,
                                                  cost: item.cost,
                                                  price: item.price,
                                                  qty: item.qty - 1,
                                                );
                                              }
                                            });
                                          },
                                        ),
                                        Text('${item.qty}', style: const TextStyle(fontWeight: FontWeight.bold)),
                                        IconButton(
                                          icon: const Icon(Icons.add, size: 18),
                                          onPressed: () {
                                            setState(() {
                                              _cart[index] = SaleItemDraft(
                                                id: item.id,
                                                name: item.name,
                                                cost: item.cost,
                                                price: item.price,
                                                qty: item.qty + 1,
                                              );
                                            });
                                          },
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.delete_outline, color: AppColors.danger, size: 20),
                                          onPressed: () => setState(() => _cart.removeAt(index)),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
          ),

          // Checkout Panel
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -2)),
              ],
            ),
            child: Column(
              children: [
                if (_tabController.index == 0) // Wholesale supports discount input
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _discountController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Discount (Rs.)',
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _paidController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Amount Paid (Rs.)',
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                    ],
                  )
                else
                  TextField(
                    controller: _paidController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Cash Received (Rs.)',
                      hintText: CurrencyFormatter.format(calc.subtotal),
                      isDense: true,
                      border: const OutlineInputBorder(),
                    ),
                    onChanged: (_) => setState(() {}),
                  ),

                const SizedBox(height: 12),

                // Calculation summary row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Total: ${CurrencyFormatter.format(calc.total)}',
                            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                        if (calc.amountDue > 0)
                          Text('Due to Khata: ${CurrencyFormatter.format(calc.amountDue)}',
                              style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600, fontSize: 13))
                        else
                          const Text('Fully Paid',
                              style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w600, fontSize: 13)),
                      ],
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.tealPrimary,
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                      ),
                      onPressed: _submitSale,
                      child: const Text(
                        'Complete Sale',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
