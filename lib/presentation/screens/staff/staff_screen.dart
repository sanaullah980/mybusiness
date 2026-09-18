import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';

class StaffScreen extends StatefulWidget {
  final List<Map<String, dynamic>> staffList;
  final List<Map<String, dynamic>> attendanceRecords;
  final Function(Map<String, dynamic> staff) onAddStaff;
  final Function(String staffId, String status, String date) onMarkAttendance;

  const StaffScreen({
    super.key,
    required this.staffList,
    required this.attendanceRecords,
    required this.onAddStaff,
    required this.onMarkAttendance,
  });

  @override
  State<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends State<StaffScreen> {
  DateTime _selectedDate = DateTime.now();

  void _openAddStaffDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final roleCtrl = TextEditingController();
    final salaryCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Staff Member'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Staff Name *')),
            const SizedBox(height: 8),
            TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
            const SizedBox(height: 8),
            TextField(controller: roleCtrl, decoration: const InputDecoration(labelText: 'Role / Designation')),
            const SizedBox(height: 8),
            TextField(controller: salaryCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Monthly Salary (Rs.)')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.tealPrimary, foregroundColor: Colors.white),
            onPressed: () {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) return;
              widget.onAddStaff({
                'name': name,
                'phone': phoneCtrl.text.trim(),
                'role': roleCtrl.text.trim(),
                'salary': double.tryParse(salaryCtrl.text.trim()) ?? 0.0,
                'joinDate': DateTime.now().toIso8601String(),
              });
              Navigator.pop(ctx);
            },
            child: const Text('Save Staff'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dateKey = DateFormat('yyyy-MM-dd').format(_selectedDate);

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.tealPrimary,
        foregroundColor: Colors.white,
        onPressed: _openAddStaffDialog,
        icon: const Icon(Icons.person_add),
        label: const Text('Add Staff'),
      ),
      body: Column(
        children: [
          // Date selector bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: Theme.of(context).cardColor,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Date: ${DateFormat('dd MMMM yyyy').format(_selectedDate)}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                TextButton.icon(
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _selectedDate,
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now(),
                    );
                    if (picked != null) setState(() => _selectedDate = picked);
                  },
                  icon: const Icon(Icons.calendar_today, size: 16),
                  label: const Text('Change Date'),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          Expanded(
            child: widget.staffList.isEmpty
                ? const Center(child: Text('No staff members registered yet.'))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: widget.staffList.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final staff = widget.staffList[index];
                      final staffId = staff['id'] as String;
                      final name = staff['name'] as String;
                      final salary = (staff['salary'] as num?)?.toDouble() ?? 0.0;

                      final attendance = widget.attendanceRecords.firstWhere(
                        (a) => a['staffId'] == staffId && a['date'] == dateKey,
                        orElse: () => {'status': 'none'},
                      );
                      final status = attendance['status'] as String;

                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                      Text(
                                        'Salary: ${CurrencyFormatter.format(salary)}/mo',
                                        style: const TextStyle(color: Colors.grey, fontSize: 13),
                                      ),
                                    ],
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: (status == 'present'
                                              ? AppColors.success
                                              : (status == 'absent' ? AppColors.danger : Colors.grey))
                                          .withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      status.toUpperCase(),
                                      style: TextStyle(
                                        color: status == 'present'
                                            ? AppColors.success
                                            : (status == 'absent' ? AppColors.danger : Colors.grey),
                                        fontWeight: FontWeight.bold,
                                        fontSize: 11,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                                children: [
                                  ChoiceChip(
                                    label: const Text('Present'),
                                    selected: status == 'present',
                                    selectedColor: AppColors.success.withOpacity(0.2),
                                    onSelected: (_) => widget.onMarkAttendance(staffId, 'present', dateKey),
                                  ),
                                  ChoiceChip(
                                    label: const Text('Absent'),
                                    selected: status == 'absent',
                                    selectedColor: AppColors.danger.withOpacity(0.2),
                                    onSelected: (_) => widget.onMarkAttendance(staffId, 'absent', dateKey),
                                  ),
                                  ChoiceChip(
                                    label: const Text('Half Day'),
                                    selected: status == 'half_day',
                                    selectedColor: Colors.orange.withOpacity(0.2),
                                    onSelected: (_) => widget.onMarkAttendance(staffId, 'half_day', dateKey),
                                  ),
                                  ChoiceChip(
                                    label: const Text('Leave'),
                                    selected: status == 'leave',
                                    selectedColor: Colors.blue.withOpacity(0.2),
                                    onSelected: (_) => widget.onMarkAttendance(staffId, 'leave', dateKey),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
