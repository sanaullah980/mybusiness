import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class FirebaseAuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  static const String pseudoDomain = '@mybusiness.local';

  static String normalizeUsername(String username) {
    return username.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9_]'), '');
  }

  static String usernameToEmail(String username) {
    final clean = normalizeUsername(username);
    return '$clean$pseudoDomain';
  }

  User? get currentUser => _auth.currentUser;
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  Future<UserCredential> signInWithUsername({
    required String username,
    required String password,
  }) async {
    final email = usernameToEmail(username);
    return await _auth.signInWithEmailAndPassword(email: email, password: password);
  }

  Future<UserCredential> registerOwner({
    required String username,
    required String password,
    required String shopName,
    required String phone,
  }) async {
    final email = usernameToEmail(username);
    final cred = await _auth.createUserWithEmailAndPassword(email: email, password: password);
    final uid = cred.user!.uid;

    final batch = _firestore.batch();
    batch.set(_firestore.collection('businessMembers').doc(uid), {
      'ownerId': uid,
      'role': 'admin',
      'displayName': shopName,
      'username': normalizeUsername(username),
      'phone': phone,
      'active': true,
      'permissions': {
        'sales': true,
        'customers': true,
        'payments': true,
        'suppliers': true,
      },
      'createdAt': FieldValue.serverTimestamp(),
    });

    batch.set(_firestore.collection('settings').doc(uid), {
      'ownerId': uid,
      'shopName': shopName,
      'phone': phone,
      'nextInvoiceNumber': 1,
      'cashOpeningBalance': 0.0,
      'theme': 'teal',
      'darkMode': false,
      'language': 'en',
    });

    await batch.commit();
    return cred;
  }

  Future<UserCredential> registerEmployeeWithInvite({
    required String username,
    required String password,
    required String inviteCode,
    required String displayName,
  }) async {
    final cleanCode = inviteCode.trim().toUpperCase();
    final inviteDoc = await _firestore.collection('businessInvites').doc(cleanCode).get();

    if (!inviteDoc.exists) {
      throw Exception('Invalid invite code. Please check with your business owner.');
    }

    final inviteData = inviteDoc.data()!;
    if (inviteData['status'] != 'pending') {
      throw Exception('This invite code has already been claimed or expired.');
    }

    final ownerId = inviteData['ownerId'] as String;
    final permissions = inviteData['permissions'] ?? {
      'sales': true,
      'customers': true,
      'payments': true,
      'suppliers': false,
    };

    final email = usernameToEmail(username);
    final cred = await _auth.createUserWithEmailAndPassword(email: email, password: password);
    final uid = cred.user!.uid;

    final batch = _firestore.batch();
    batch.set(_firestore.collection('businessMembers').doc(uid), {
      'ownerId': ownerId,
      'role': 'employee',
      'displayName': displayName,
      'username': normalizeUsername(username),
      'active': true,
      'permissions': permissions,
      'inviteId': cleanCode,
      'createdAt': FieldValue.serverTimestamp(),
    });

    batch.update(_firestore.collection('businessInvites').doc(cleanCode), {
      'status': 'claimed',
      'claimedBy': uid,
      'claimedAt': FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return cred;
  }

  Future<String> resolveOwnerId() async {
    final user = _auth.currentUser;
    if (user == null) throw StateError('No authenticated Firebase user.');
    try {
      final doc = await _firestore.collection('businessMembers').doc(user.uid).get();
      final data = doc.data();
      final owner = data?['ownerId'];
      if (owner is String && owner.isNotEmpty) return owner;
    } catch (_) {
      // If the member document is only available from offline cache, the
      // caller can still use the owner uid for an owner account.
    }
    return user.uid;
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }
}
