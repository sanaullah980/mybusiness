class ProductSaleStat {
  final String id;
  final String name;
  int quantity;
  double revenue;

  ProductSaleStat({
    required this.id,
    required this.name,
    required this.quantity,
    required this.revenue,
  });
}

class BusinessReportStats {
  final double totalSales;
  final double knownProfit;
  final double wholesaleProfit;
  final double retailProfit;
  final int unknownCount;
  final int txCount;
  final double totalExpenses;
  final double netProfit;
  final double returnedAmount;
  final double customerPayments;
  final double newDebt;
  final double outstandingDebt;

  // Advanced section
  final double cashIn;
  final double cashOut;
  final double cashInHand;
  final double stockValueCost;
  final double stockValuePrice;
  final int lowStockCount;
  final int outOfStockCount;
  final double purchasesTotal;
  final double purchasesPaid;
  final double purchasesDue;
  final double totalReceivable;
  final double totalPayable;
  final List<ProductSaleStat> bestSellers;

  BusinessReportStats({
    required this.totalSales,
    required this.knownProfit,
    required this.wholesaleProfit,
    required this.retailProfit,
    required this.unknownCount,
    required this.txCount,
    required this.totalExpenses,
    required this.netProfit,
    required this.returnedAmount,
    required this.customerPayments,
    required this.newDebt,
    required this.outstandingDebt,
    required this.cashIn,
    required this.cashOut,
    required this.cashInHand,
    required this.stockValueCost,
    required this.stockValuePrice,
    required this.lowStockCount,
    required this.outOfStockCount,
    required this.purchasesTotal,
    required this.purchasesPaid,
    required this.purchasesDue,
    required this.totalReceivable,
    required this.totalPayable,
    required this.bestSellers,
  });
}
