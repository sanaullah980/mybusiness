import 'dart:convert';
import 'dart:html' as html;
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';

Future<void> exportBackupFile(Uint8List bytes, String fileName) async {
  final blob = html.Blob([bytes], 'application/json');
  final url = html.Url.createObjectUrlFromBlob(blob);
  html.AnchorElement(href: url)
    ..download = fileName
    ..style.display = 'none'
    ..click();
  html.Url.revokeObjectUrl(url);
}

Future<String?> importBackupFile() async {
  final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['json']);
  if (result == null || result.files.single.bytes == null) return null;
  return utf8.decode(result.files.single.bytes!);
}
