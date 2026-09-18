import 'dart:typed_data';

import 'backup_file_service_io.dart'
    if (dart.library.html) 'backup_file_service_web.dart' as platform;

Future<void> exportBackupFile(String json, String fileName) =>
    platform.exportBackupFile(Uint8List.fromList(json.codeUnits), fileName);

Future<String?> importBackupFile() => platform.importBackupFile();
