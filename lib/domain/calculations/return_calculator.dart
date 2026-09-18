import 'dart:math';
import 'sale_calculator.dart';

class ReturnCalculationResult {
  final double returnedSubtotal;
  final double refundAmount;
  final double profitReversal;
  final double dueReduction;
  final double cashRefund;

  ReturnCalculationResult({
    required this.returnedSubtotal,
    required this.refundAmount,
    required this.profitReversal,
    required this.dueReduction,
    required this.cashRefund,
  });
}

class ReturnCalculator {
  static ReturnCalculationResult calculateReturn({
    required List<SaleItemDraft> returnedItems,
    required double originalSubtotal,
    required double originalDiscount,
    required double existingSaleDue,
  }) {
    final returnedSubtotal = returnedItems.fold<double>(
      0.0,
      (sum, i) => sum + (i.price * i.qty),
    );
    final returnedProfitRaw = returnedItems.fold<double>(
      0.0,
      (sum, i) => sum + ((i.price - i.cost) * i.qty),
    );

    final discountRatio = originalSubtotal > 0
        ? min(1.0, max(0.0, originalDiscount) / originalSubtotal)
        : 0.0;

    final refundAmount = returnedSubtotal * (1.0 - discountRatio);
    final profitReversal = returnedProfitRaw * (1.0 - discountRatio);

    // 1. First reduces whatever debt was outstanding on the sale
    final dueReduction = min(existingSaleDue, refundAmount);

    // 2. Whatever refund remains beyond existing debt is paid out as CASH
    final cashRefund = max(0.0, refundAmount - dueReduction);

    return ReturnCalculationResult(
      returnedSubtotal: returnedSubtotal,
      refundAmount: refundAmount,
      profitReversal: profitReversal,
      dueReduction: dueReduction,
      cashRefund: cashRefund,
    );
  }
}
