import 'dart:io';
import 'dart:typed_data';
import 'dart:convert';

import 'package:path_provider/path_provider.dart';
import 'package:file_picker/file_picker.dart';
import 'package:share_plus/share_plus.dart';

Future<void> exportBackupFile(Uint8List bytes, String fileName) async {
  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}/$fileName');
  await file.writeAsBytes(bytes, flush: true);
  await Share.shareXFiles([XFile(file.path, mimeType: 'application/json')], text: 'MyBusiness backup');
}

Future<String?> importBackupFile() async {
  final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['json'], withData: true);
  if (result == null) return null;
  final bytes = result.files.single.bytes;
  if (bytes != null) return utf8.decode(bytes);
  final path = result.files.single.path;
  if (path == null) return null;
  return File(path).readAsString();
}
