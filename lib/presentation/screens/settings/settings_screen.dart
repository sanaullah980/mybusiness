import 'package:flutter/material.dart';
import '../../../core/constants/colors.dart';

class SettingsScreen extends StatefulWidget {
  final Map<String, dynamic> settings;
  final Function(Map<String, dynamic> updatedSettings) onUpdateSettings;
  final VoidCallback onExportBackup;
  final VoidCallback onImportBackup;
  final Function(String newPin) onSetPin;
  final VoidCallback onRemovePin;
  final bool isPinEnabled;
  final VoidCallback onSignOut;

  const SettingsScreen({
    super.key,
    required this.settings,
    required this.onUpdateSettings,
    required this.onExportBackup,
    required this.onImportBackup,
    required this.onSetPin,
    required this.onRemovePin,
    required this.isPinEnabled,
    required this.onSignOut,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late TextEditingController _shopNameCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _addressCtrl;
  late TextEditingController _invoiceNoCtrl;
  late String _selectedTheme;
  late bool _darkMode;

  @override
  void initState() {
    super.initState();
    final s = widget.settings;
    _shopNameCtrl = TextEditingController(text: s['shopName'] ?? 'My Shop');
    _phoneCtrl = TextEditingController(text: s['phone'] ?? '');
    _addressCtrl = TextEditingController(text: s['address'] ?? '');
    _invoiceNoCtrl = TextEditingController(text: (s['nextInvoiceNumber'] ?? 1).toString());
    _selectedTheme = s['theme'] ?? 'teal';
    _darkMode = s['darkMode'] == true;
  }

  @override
  void dispose() {
    _shopNameCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _invoiceNoCtrl.dispose();
    super.dispose();
  }

  void _saveShopProfile() {
    widget.onUpdateSettings({
      ...widget.settings,
      'shopName': _shopNameCtrl.text.trim(),
      'phone': _phoneCtrl.text.trim(),
      'address': _addressCtrl.text.trim(),
      'nextInvoiceNumber': int.tryParse(_invoiceNoCtrl.text.trim()) ?? 1,
      'theme': _selectedTheme,
      'darkMode': _darkMode,
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(backgroundColor: AppColors.success, content: Text('Settings saved successfully!')),
    );
  }

  void _openPinDialog() {
    final pinCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Set 4-Digit Security PIN'),
        content: TextField(
          controller: pinCtrl,
          keyboardType: TextInputType.number,
          obscureText: true,
          maxLength: 4,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Enter 4-Digit PIN', border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.tealPrimary, foregroundColor: Colors.white),
            onPressed: () {
              if (pinCtrl.text.length == 4) {
                widget.onSetPin(pinCtrl.text);
                Navigator.pop(ctx);
              }
            },
            child: const Text('Set PIN'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Shop Profile & Invoicing', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    TextField(controller: _shopNameCtrl, decoration: const InputDecoration(labelText: 'Shop / Business Name *', border: OutlineInputBorder())),
                    const SizedBox(height: 12),
                    TextField(controller: _phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Contact Phone Number', border: OutlineInputBorder())),
                    const SizedBox(height: 12),
                    TextField(controller: _addressCtrl, decoration: const InputDecoration(labelText: 'Shop Address', border: OutlineInputBorder())),
                    const SizedBox(height: 12),
                    TextField(controller: _invoiceNoCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Next Bill / Invoice Number', border: OutlineInputBorder())),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.tealPrimary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onPressed: _saveShopProfile,
                        child: const Text('Save Shop Details'),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),

            // App Security & Lock PIN
            const Text('Security & App Lock', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                leading: const Icon(Icons.lock_outline, color: AppColors.tealPrimary),
                title: const Text('4-Digit Security PIN'),
                subtitle: Text(widget.isPinEnabled ? 'PIN Lock is active' : 'No PIN set (Open access)'),
                trailing: widget.isPinEnabled
                    ? OutlinedButton(
                        style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
                        onPressed: widget.onRemovePin,
                        child: const Text('Disable PIN'),
                      )
                    : ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.tealPrimary, foregroundColor: Colors.white),
                        onPressed: _openPinDialog,
                        child: const Text('Set PIN'),
                      ),
              ),
            ),

            const SizedBox(height: 24),

            // Full Backup & Restore
            const Text('Backup & Data Preservation', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Export an offline JSON backup of all 14 business collections (Products, Customers, Sales, Expenses, Staff, etc.). You can restore it at any time.',
                      style: TextStyle(fontSize: 13, color: Colors.grey),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.tealPrimary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            onPressed: widget.onExportBackup,
                            icon: const Icon(Icons.download, size: 18),
                            label: const Text('Export JSON'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            onPressed: widget.onImportBackup,
                            icon: const Icon(Icons.upload_file, size: 18),
                            label: const Text('Restore Backup'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 32),

            // Sign out
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.danger,
                  side: const BorderSide(color: AppColors.danger),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: widget.onSignOut,
                icon: const Icon(Icons.logout),
                label: const Text('Sign Out of MyBusiness'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
