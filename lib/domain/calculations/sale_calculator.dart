import 'dart:math';

class SaleItemDraft {
  final String id;
  final String name;
  final double cost;
  final double price;
  final int qty;
  final int returnedQty;

  SaleItemDraft({
    required this.id,
    required this.name,
    required this.cost,
    required this.price,
    required this.qty,
    this.returnedQty = 0,
  });

  double get lineTotal => price * qty;
  double get lineProfit => (price - cost) * qty;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'cost': cost,
        'price': price,
        'qty': qty,
        'returnedQty': returnedQty,
      };

  factory SaleItemDraft.fromJson(Map<String, dynamic> json) => SaleItemDraft(
        id: json['id'] as String,
        name: json['name'] as String,
        cost: (json['cost'] as num).toDouble(),
        price: (json['price'] as num).toDouble(),
        qty: json['qty'] as int,
        returnedQty: (json['returnedQty'] as int?) ?? 0,
      );
}

class SaleCalculationResult {
  final double subtotal;
  final double discount;
  final double total;
  final double amountPaid;
  final double amountDue;
  final double totalProfit;
  final bool profitKnown;

  SaleCalculationResult({
    required this.subtotal,
    required this.discount,
    required this.total,
    required this.amountPaid,
    required this.amountDue,
    required this.totalProfit,
    required this.profitKnown,
  });
}

class SaleCalculator {
  /// Wholesale Sale: Accepts discounts and partial payments.
  /// Any unpaid amount creates debt for the customer.
  static SaleCalculationResult calculateWholesale({
    required List<SaleItemDraft> items,
    required double discountInput,
    required double paidInput,
  }) {
    final subtotal = items.fold<double>(0.0, (sum, i) => sum + i.lineTotal);
    final appliedDiscount = min(max(0.0, discountInput), subtotal);
    final total = max(0.0, subtotal - appliedDiscount);
    final amountPaid = min(max(0.0, paidInput), total);
    final amountDue = max(0.0, total - amountPaid);
    final grossProfit = items.fold<double>(0.0, (sum, i) => sum + i.lineProfit);
    final totalProfit = grossProfit - appliedDiscount;

    return SaleCalculationResult(
      subtotal: subtotal,
      discount: appliedDiscount,
      total: total,
      amountPaid: amountPaid,
      amountDue: amountDue,
      totalProfit: totalProfit,
      profitKnown: true,
    );
  }

  /// Retail Sale: Strict Business Rule:
  /// Retail sales NEVER create customer debt.
  /// Any difference between subtotal and paid amount is treated as an automatic discount.
  /// Total is adjusted so amountDue is always 0.
  static SaleCalculationResult calculateRetail({
    required List<SaleItemDraft> items,
    required double paidInput,
  }) {
    final subtotal = items.fold<double>(0.0, (sum, i) => sum + i.lineTotal);
    final amountPaid = min(subtotal, max(0.0, paidInput));
    final appliedDiscount = subtotal - amountPaid;
    final total = amountPaid;
    const double amountDue = 0.0;
    final grossProfit = items.fold<double>(0.0, (sum, i) => sum + i.lineProfit);
    final totalProfit = grossProfit - appliedDiscount;

    return SaleCalculationResult(
      subtotal: subtotal,
      discount: appliedDiscount,
      total: total,
      amountPaid: amountPaid,
      amountDue: amountDue,
      totalProfit: totalProfit,
      profitKnown: true,
    );
  }
}
