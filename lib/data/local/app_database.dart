import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_database_io.dart' if (dart.library.html) 'app_database_web.dart' as platform;

/// Persistent local-first store.
///
/// Android/iOS/desktop use Drift's SQLite executor. Flutter Web uses the
/// browser's persistent local storage because SQLite files are not available
/// to a browser sandbox. The logical record format is identical on both
/// platforms and preserves the existing Firestore collection/document model.
class AppDatabase {
  final String ownerId;
  late final platform.PlatformDatabase _platform;

  AppDatabase._(this.ownerId, this._platform);

  static Future<AppDatabase> open(String ownerId) async {
    final db = await platform.PlatformDatabase.open(ownerId);
    return AppDatabase._(ownerId, db);
  }

  Future<List<Map<String, dynamic>>> getCollection(String collection) =>
      _platform.getCollection(collection);

  Future<void> upsert(
    String collection,
    String id,
    Map<String, dynamic> data, {
    bool pendingSync = true,
  }) =>
      _platform.upsert(collection, id, data, pendingSync: pendingSync);

  Future<void> delete(String collection, String id, {bool pendingSync = true}) =>
      _platform.delete(collection, id, pendingSync: pendingSync);

  Future<void> replaceCollection(
    String collection,
    List<Map<String, dynamic>> records, {
    bool pendingSync = false,
  }) =>
      _platform.replaceCollection(collection, records, pendingSync: pendingSync);

  Future<List<Map<String, dynamic>>> pendingRecords() => _platform.pendingRecords();

  Future<void> markSynced(String collection, String id) =>
      _platform.markSynced(collection, id);

  Future<void> close() => _platform.close();
}

/// Shared helpers used by the web backend.
String encodeRecord(Map<String, dynamic> value) => jsonEncode(value);
Map<String, dynamic> decodeRecord(String value) =>
    Map<String, dynamic>.from(jsonDecode(value) as Map);
