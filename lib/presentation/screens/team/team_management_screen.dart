import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/constants/colors.dart';

class TeamManagementScreen extends StatelessWidget {
  final List<Map<String, dynamic>> members;
  final Function(String inviteCode, Map<String, bool> permissions) onCreateInvite;
  final Function(String memberId, bool active) onToggleMemberActive;

  const TeamManagementScreen({
    super.key,
    required this.members,
    required this.onCreateInvite,
    required this.onToggleMemberActive,
  });

  static String generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final random = Random();
    return List.generate(8, (_) => chars[random.nextInt(chars.length)]).join();
  }

  void _openCreateInviteDialog(BuildContext context) {
    final permissions = <String, bool>{
      'sales': true,
      'customers': true,
      'payments': true,
      'suppliers': false,
    };

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: const Text('Invite Staff / Employee'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Generate an 8-character invite code for your employee. They will enter this code on the signup screen to join your shop.',
                style: TextStyle(fontSize: 13, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              const Text('Employee Permissions:', style: TextStyle(fontWeight: FontWeight.bold)),
              CheckboxListTile(
                title: const Text('Record Sales (POS)'),
                value: permissions['sales'],
                onChanged: (val) => setModalState(() => permissions['sales'] = val ?? true),
                dense: true,
              ),
              CheckboxListTile(
                title: const Text('View & Add Customers (Khata)'),
                value: permissions['customers'],
                onChanged: (val) => setModalState(() => permissions['customers'] = val ?? true),
                dense: true,
              ),
              CheckboxListTile(
                title: const Text('Record Debt & Payments'),
                value: permissions['payments'],
                onChanged: (val) => setModalState(() => permissions['payments'] = val ?? true),
                dense: true,
              ),
              CheckboxListTile(
                title: const Text('Manage Suppliers & Purchases'),
                value: permissions['suppliers'],
                onChanged: (val) => setModalState(() => permissions['suppliers'] = val ?? false),
                dense: true,
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.tealPrimary, foregroundColor: Colors.white),
              onPressed: () {
                final code = generateInviteCode();
                onCreateInvite(code, permissions);
                Navigator.pop(ctx);

                showDialog(
                  context: context,
                  builder: (_) => AlertDialog(
                    title: const Text('Invite Code Created!'),
                    content: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('Share this code with your employee:'),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: SelectableText(
                            code,
                            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: 4),
                          ),
                        ),
                      ],
                    ),
                    actions: [
                      ElevatedButton.icon(
                        icon: const Icon(Icons.copy, size: 18),
                        label: const Text('Copy Code'),
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: code));
                          Navigator.pop(context);
                        },
                      ),
                    ],
                  ),
                );
              },
              child: const Text('Generate Code'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.tealPrimary,
        foregroundColor: Colors.white,
        onPressed: () => _openCreateInviteDialog(context),
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('Invite Employee'),
      ),
      body: members.isEmpty
          ? const Center(child: Text('No team members found.'))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: members.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final m = members[index];
                final name = m['displayName'] ?? m['username'] ?? 'User';
                final role = (m['role'] as String? ?? 'employee').toUpperCase();
                final isAdmin = m['role'] == 'admin';
                final isActive = m['active'] != false;

                return Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: isAdmin ? AppColors.tealPrimary : Colors.blueGrey,
                      foregroundColor: Colors.white,
                      child: Icon(isAdmin ? Icons.admin_panel_settings : Icons.badge),
                    ),
                    title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('Role: $role · ${isActive ? 'Active' : 'Disabled'}'),
                    trailing: !isAdmin
                        ? Switch(
                            value: isActive,
                            activeColor: AppColors.tealPrimary,
                            onChanged: (val) => onToggleMemberActive(m['id'] as String, val),
                          )
                        : null,
                  ),
                );
              },
            ),
    );
  }
}
