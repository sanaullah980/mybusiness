import 'package:intl/intl.dart';

class CurrencyFormatter {
  static final NumberFormat _formatter = NumberFormat.currency(
    symbol: 'Rs. ',
    decimalDigits: 0,
    locale: 'en_PK',
  );

  static String format(num? amount) {
    if (amount == null || amount.isNaN) return 'Rs. 0';
    return _formatter.format(amount);
  }

  static String formatWithDecimals(num? amount) {
    if (amount == null || amount.isNaN) return 'Rs. 0.00';
    return NumberFormat.currency(symbol: 'Rs. ', decimalDigits: 2, locale: 'en_PK').format(amount);
  }
}
