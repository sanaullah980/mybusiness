import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show QueryExecutor;
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

class PlatformDatabase {
  final QueryExecutor _executor;

  PlatformDatabase._(this._executor);

  static Future<PlatformDatabase> open(String ownerId) async {
    final dir = await getApplicationDocumentsDirectory();
    final safeOwner = ownerId.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final file = File(p.join(dir.path, 'mybusiness_$safeOwner.sqlite'));
    final executor = NativeDatabase(file, logStatements: false);
    final db = PlatformDatabase._(executor);
    db._currentOwnerId = ownerId;
    await db._init();
    return db;
  }

  Future<void> _init() async {
    await _executor.runCustom('''
      CREATE TABLE IF NOT EXISTS records (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        pending_sync INTEGER NOT NULL DEFAULT 0,
        deleted INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (collection, id)
      )
    ''');
    await _executor.runCustom(
      'CREATE INDEX IF NOT EXISTS idx_records_collection_owner ON records(collection, owner_id)',
    );
    await _executor.runCustom(
      'CREATE INDEX IF NOT EXISTS idx_records_pending ON records(pending_sync)',
    );
  }

  Future<List<Map<String, dynamic>>> getCollection(String collection) async {
    final rows = await _executor.runSelect(
      'SELECT payload FROM records WHERE collection = ? AND owner_id = ? AND deleted = 0 ORDER BY updated_at DESC',
      [collection, _ownerId],
    );
    return rows
        .map((row) => Map<String, dynamic>.from(jsonDecode(row['payload'] as String) as Map))
        .toList();
  }

  String get _ownerId => _currentOwnerId;
  late String _currentOwnerId;

  Future<void> upsert(String collection, String id, Map<String, dynamic> data,
      {bool pendingSync = true}) async {
    _currentOwnerId = (data['ownerId'] as String?) ?? _currentOwnerId;
    final now = DateTime.now().millisecondsSinceEpoch;
    final payload = jsonEncode(data);
    await _executor.runInsert(
      '''INSERT INTO records(collection,id,owner_id,payload,updated_at,pending_sync,deleted)
         VALUES(?,?,?,?,?,?,0)
         ON CONFLICT(collection,id) DO UPDATE SET owner_id=excluded.owner_id,payload=excluded.payload,updated_at=excluded.updated_at,pending_sync=excluded.pending_sync,deleted=0''',
      [collection, id, _ownerId, payload, now, pendingSync ? 1 : 0],
    );
  }

  Future<void> delete(String collection, String id, {bool pendingSync = true}) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    await _executor.runUpdate(
      'UPDATE records SET deleted=1, pending_sync=?, updated_at=? WHERE collection=? AND id=? AND owner_id=?',
      [pendingSync ? 1 : 0, now, collection, id, _ownerId],
    );
  }

  Future<void> replaceCollection(String collection, List<Map<String, dynamic>> records,
      {bool pendingSync = false}) async {
    for (final record in records) {
      final id = record['id']?.toString();
      if (id == null || id.isEmpty) continue;
      await upsert(collection, id, record, pendingSync: pendingSync);
    }
  }

  Future<List<Map<String, dynamic>>> pendingRecords() async {
    final rows = await _executor.runSelect(
      'SELECT collection,id,payload,deleted FROM records WHERE owner_id=? AND pending_sync=1',
      [_ownerId],
    );
    return rows
        .map((r) => {
              'collection': r['collection'],
              'id': r['id'],
              'payload': Map<String, dynamic>.from(jsonDecode(r['payload'] as String) as Map),
              'deleted': (r['deleted'] as int) == 1,
            })
        .toList();
  }

  Future<void> markSynced(String collection, String id) async {
    await _executor.runUpdate(
      'UPDATE records SET pending_sync=0 WHERE collection=? AND id=? AND owner_id=?',
      [collection, id, _ownerId],
    );
  }

  Future<void> close() => _executor.close();
}
