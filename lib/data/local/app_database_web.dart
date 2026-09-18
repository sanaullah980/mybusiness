import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class PlatformDatabase {
  final String ownerId;
  final SharedPreferences prefs;
  static const _prefix = 'mybusiness.web.v1';

  PlatformDatabase._(this.ownerId, this.prefs);

  static Future<PlatformDatabase> open(String ownerId) async {
    return PlatformDatabase._(ownerId, await SharedPreferences.getInstance());
  }

  String _key(String collection) => '$_prefix.$ownerId.$collection';

  Future<List<Map<String, dynamic>>> getCollection(String collection) async {
    final raw = prefs.getString(_key(collection));
    if (raw == null) return [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded
        .map((e) => Map<String, dynamic>.from(e as Map))
        .where((e) => e['__deleted'] != true)
        .toList();
  }

  Future<void> upsert(String collection, String id, Map<String, dynamic> data,
      {bool pendingSync = true}) async {
    final list = await getCollection(collection);
    final record = {...data, 'id': id, '__pendingSync': pendingSync};
    final idx = list.indexWhere((e) => e['id'] == id);
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.add(record);
    }
    await prefs.setString(_key(collection), jsonEncode(list));
  }

  Future<void> delete(String collection, String id, {bool pendingSync = true}) async {
    final list = await getCollection(collection);
    final idx = list.indexWhere((e) => e['id'] == id);
    if (idx < 0) return;
    list[idx] = {...list[idx], '__deleted': true, '__pendingSync': pendingSync};
    await prefs.setString(_key(collection), jsonEncode(list));
  }

  Future<void> replaceCollection(String collection, List<Map<String, dynamic>> records,
      {bool pendingSync = false}) async {
    final normalized = records.map((r) => {...r, '__pendingSync': pendingSync}).toList();
    await prefs.setString(_key(collection), jsonEncode(normalized));
  }

  Future<List<Map<String, dynamic>>> pendingRecords() async {
    final result = <Map<String, dynamic>>[];
    // Pending records are discovered from the known collection list.
    const collections = [
      'products','customers','sales','expenses','stockPurchases','customerTransactions',
      'stockAdjustments','suppliers','supplierTransactions','cashTransactions','salesReturns',
      'staff','attendance','reminders','businessMembers','settings',
    ];
    for (final collection in collections) {
      final raw = prefs.getString(_key(collection));
      if (raw == null) continue;
      final list = (jsonDecode(raw) as List).cast<dynamic>();
      for (final item in list) {
        final record = Map<String, dynamic>.from(item as Map);
        if (record['__pendingSync'] == true && record['id'] != null) {
          result.add({
            'collection': collection,
            'id': record['id'],
            'payload': {...record}..remove('__pendingSync')..remove('__deleted'),
            'deleted': record['__deleted'] == true,
          });
        }
      }
    }
    return result;
  }

  Future<void> markSynced(String collection, String id) async {
    final raw = prefs.getString(_key(collection));
    if (raw == null) return;
    final list = (jsonDecode(raw) as List).cast<dynamic>();
    for (var i = 0; i < list.length; i++) {
      final record = Map<String, dynamic>.from(list[i] as Map);
      if (record['id'] == id) {
        record['__pendingSync'] = false;
        list[i] = record;
      }
    }
    await prefs.setString(_key(collection), jsonEncode(list));
  }

  Future<void> close() async {}
}
