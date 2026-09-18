enum CashFlowType { inFlow, outFlow }

class CashEntry {
  final DateTime date;
  final CashFlowType type;
  final double amount;
  final String label;
  final String source;

  CashEntry({
    required this.date,
    required this.type,
    required this.amount,
    required this.label,
    required this.source,
  });
}

class CashBookSummary {
  final double openingBalance;
  final double totalIn;
  final double totalOut;
  final double cashInHand;
  final List<CashEntry> entries;

  CashBookSummary({
    required this.openingBalance,
    required this.totalIn,
    required this.totalOut,
    required this.cashInHand,
    required this.entries,
  });
}

class CashBookAggregator {
  static CashBookSummary buildSummary({
    required double openingBalance,
    required List<CashEntry> entries,
  }) {
    // Sort chronologically ascending
    final sorted = List<CashEntry>.from(entries)
      ..sort((a, b) => a.date.compareTo(b.date));

    double totalIn = 0.0;
    double totalOut = 0.0;

    for (final e in sorted) {
      if (e.type == CashFlowType.inFlow) {
        totalIn += e.amount;
      } else {
        totalOut += e.amount;
      }
    }

    final cashInHand = openingBalance + totalIn - totalOut;

    return CashBookSummary(
      openingBalance: openingBalance,
      totalIn: totalIn,
      totalOut: totalOut,
      cashInHand: cashInHand,
      entries: sorted,
    );
  }
}
