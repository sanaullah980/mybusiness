import 'dart:convert';
import 'package:intl/intl.dart';

class BackupService {
  static const int backupVersion = 1;
  static const List<String> collectionNames = [
    'products','customers','sales','expenses','stockPurchases','customerTransactions',
    'stockAdjustments','suppliers','supplierTransactions','cashTransactions','salesReturns',
    'staff','attendance','reminders',
  ];

  static String exportToJson({
    required Map<String, List<Map<String, dynamic>>> collections,
    required Map<String, dynamic> settings,
  }) {
    return const JsonEncoder.withIndent('  ').convert({
      'version': backupVersion,
      'exportedAt': DateTime.now().toIso8601String(),
      'collections': collections,
      'settings': settings,
    });
  }

  static Map<String, dynamic> parseAndValidateJson(String jsonContent) {
    final decoded = jsonDecode(jsonContent);
    if (decoded is! Map) throw const FormatException('Invalid backup: root must be a JSON object.');
    final result = Map<String, dynamic>.from(decoded);
    if (result['version'] != backupVersion || result['collections'] is! Map) {
      throw const FormatException('Invalid or incompatible MyBusiness backup version.');
    }
    return result;
  }

  static String generateFileName() => 'MyBusiness-backup-${DateFormat('yyyy-MM-dd').format(DateTime.now())}.json';
}
