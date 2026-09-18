import 'dart:convert';
import 'package:crypto/crypto.dart';

class AppLockService {
  static String hashPin(String pin) {
    final bytes = utf8.encode('$pin|MyBusiness-AppLock');
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  static bool verifyPin(String enteredPin, String storedHash) {
    return hashPin(enteredPin) == storedHash;
  }
}
