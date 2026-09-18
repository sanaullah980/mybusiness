import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';

class FirestoreSyncService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final String ownerId;

  FirestoreSyncService({required this.ownerId});

  /// Subscribes to real-time changes on any collection scoped by ownerId
  Stream<List<Map<String, dynamic>>> subscribeToCollection(String collectionName) {
    return _firestore
        .collection(collectionName)
        .where('ownerId', isEqualTo: ownerId)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) {
        final data = doc.data();
        data['id'] = doc.id;
        return data;
      }).toList();
    });
  }

  /// Pushes local record update to Firestore
  Future<void> pushRecord({
    required String collectionName,
    required String docId,
    required Map<String, dynamic> data,
  }) async {
    final payload = Map<String, dynamic>.from(data);
    payload['ownerId'] = ownerId;
    payload['updatedAt'] = FieldValue.serverTimestamp();

    await _firestore
        .collection(collectionName)
        .doc(docId)
        .set(payload, SetOptions(merge: true));
  }

  /// Deletes record from Firestore
  Future<void> deleteRecord({
    required String collectionName,
    required String docId,
  }) async {
    await _firestore.collection(collectionName).doc(docId).delete();
  }
}
