import 'package:flutter/material.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../common_widgets/search_bar_widget.dart';

class ProductPickerSheet extends StatefulWidget {
  final List<Map<String, dynamic>> products;
  final String saleType; // 'wholesale' or 'retail'
  final Function(List<Map<String, dynamic>> selectedItems) onApply;

  const ProductPickerSheet({
    super.key,
    required this.products,
    required this.saleType,
    required this.onApply,
  });

  @override
  State<ProductPickerSheet> createState() => _ProductPickerSheetState();
}

class _ProductPickerSheetState extends State<ProductPickerSheet> {
  String _search = '';
  final Map<String, int> _selectedQuantities = {};

  @override
  Widget build(BuildContext context) {
    final filtered = widget.products.where((p) {
      final name = (p['name'] as String? ?? '').toLowerCase();
      final barcode = (p['barcode'] as String? ?? '').toLowerCase();
      return name.contains(_search.toLowerCase()) || barcode.contains(_search.toLowerCase());
    }).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Select Products (${widget.saleType.toUpperCase()})',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SearchBarWidget(
            hintText: 'Search product or barcode...',
            onChanged: (val) => setState(() => _search = val),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: filtered.isEmpty
                ? const Center(child: Text('No matching products found'))
                : ListView.separated(
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final p = filtered[index];
                      final id = p['id'] as String;
                      final name = p['name'] as String;
                      final stock = (p['stock'] as num?)?.toInt() ?? 0;
                      final price = widget.saleType == 'wholesale'
                          ? ((p['wholesalePrice'] ?? p['price']) as num).toDouble()
                          : ((p['retailPrice'] ?? p['price']) as num).toDouble();
                      final cost = (p['cost'] as num?)?.toDouble() ?? 0.0;
                      final qty = _selectedQuantities[id] ?? 0;

                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('Stock: $stock · Price: ${CurrencyFormatter.format(price)}'),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (qty > 0) ...[
                              IconButton(
                                icon: const Icon(Icons.remove_circle_outline, color: AppColors.danger),
                                onPressed: () {
                                  setState(() {
                                    if (qty <= 1) {
                                      _selectedQuantities.remove(id);
                                    } else {
                                      _selectedQuantities[id] = qty - 1;
                                    }
                                  });
                                },
                              ),
                              Text('$qty', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                            ],
                            IconButton(
                              icon: const Icon(Icons.add_circle, color: AppColors.tealPrimary),
                              onPressed: () {
                                setState(() {
                                  _selectedQuantities[id] = qty + 1;
                                });
                              },
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.tealPrimary,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: _selectedQuantities.isEmpty
                  ? null
                  : () {
                      final result = <Map<String, dynamic>>[];
                      _selectedQuantities.forEach((id, qty) {
                        final p = widget.products.firstWhere((item) => item['id'] == id);
                        final price = widget.saleType == 'wholesale'
                            ? ((p['wholesalePrice'] ?? p['price']) as num).toDouble()
                            : ((p['retailPrice'] ?? p['price']) as num).toDouble();
                        final cost = (p['cost'] as num?)?.toDouble() ?? 0.0;
                        result.add({
                          'id': id,
                          'name': p['name'],
                          'cost': cost,
                          'price': price,
                          'qty': qty,
                        });
                      });
                      widget.onApply(result);
                      Navigator.pop(context);
                    },
              child: Text(
                'Add Selected Items (${_selectedQuantities.values.fold(0, (a, b) => a + b)})',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
