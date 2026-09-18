import 'package:flutter/material.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../common_widgets/search_bar_widget.dart';
import 'product_form_screen.dart';

class InventoryScreen extends StatefulWidget {
  final List<Map<String, dynamic>> products;
  final Function(Map<String, dynamic> product) onSaveProduct;
  final Function(String productId) onDeleteProduct;
  final Function(String productId, String type, int qty, String note) onAdjustStock;

  const InventoryScreen({
    super.key,
    required this.products,
    required this.onSaveProduct,
    required this.onDeleteProduct,
    required this.onAdjustStock,
  });

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  String _search = '';

  void _openStockAdjustDialog(Map<String, dynamic> product) {
    String type = 'add';
    final qtyCtrl = TextEditingController(text: '1');
    final noteCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: Text('Adjust Stock: ${product['name']}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Current Stock: ${product['stock'] ?? 0}', style: const TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: type,
                decoration: const InputDecoration(labelText: 'Action', border: OutlineInputBorder()),
                items: const [
                  DropdownMenuItem(value: 'add', child: Text('Add Stock (+)')),
                  DropdownMenuItem(value: 'remove', child: Text('Remove Stock (-)')),
                ],
                onChanged: (val) => setModalState(() => type = val!),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: qtyCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Quantity *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteCtrl,
                decoration: const InputDecoration(labelText: 'Reason / Note', border: OutlineInputBorder()),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.tealPrimary, foregroundColor: Colors.white),
              onPressed: () {
                final qty = int.tryParse(qtyCtrl.text.trim()) ?? 0;
                if (qty <= 0) return;
                widget.onAdjustStock(product['id'] as String, type, qty, noteCtrl.text.trim());
                Navigator.pop(ctx);
              },
              child: const Text('Save Adjustment'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = widget.products.where((p) {
      final name = (p['name'] as String? ?? '').toLowerCase();
      final barcode = (p['barcode'] as String? ?? '').toLowerCase();
      return name.contains(_search.toLowerCase()) || barcode.contains(_search.toLowerCase());
    }).toList();

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.tealPrimary,
        foregroundColor: Colors.white,
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ProductFormScreen(
                onSave: (prod) => widget.onSaveProduct(prod),
              ),
            ),
          );
        },
        icon: const Icon(Icons.add),
        label: const Text('Add Product'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: SearchBarWidget(
              hintText: 'Search products by name or barcode...',
              onChanged: (val) => setState(() => _search = val),
            ),
          ),
          Expanded(
            child: filtered.isEmpty
                ? const Center(child: Text('No products in inventory.'))
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final p = filtered[index];
                      final stock = (p['stock'] as num?)?.toInt() ?? 0;
                      final minStock = (p['minStock'] as num?)?.toInt() ?? 5;
                      final isLow = stock <= minStock;
                      final wholesale = ((p['wholesalePrice'] ?? p['price']) as num?)?.toDouble() ?? 0.0;
                      final retail = ((p['retailPrice'] ?? p['price']) as num?)?.toDouble() ?? 0.0;
                      final cost = (p['cost'] as num?)?.toDouble() ?? 0.0;

                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      p['name'] as String? ?? '',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: (isLow ? AppColors.warning : AppColors.success).withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      isLow ? 'Low Stock: $stock' : 'Stock: $stock',
                                      style: TextStyle(
                                        color: isLow ? AppColors.warning : AppColors.success,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Cost: ${CurrencyFormatter.format(cost)} · Wholesale: ${CurrencyFormatter.format(wholesale)} · Retail: ${CurrencyFormatter.format(retail)}',
                                style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                              ),
                              if (p['barcode'] != null && (p['barcode'] as String).isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text('Barcode: ${p['barcode']}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                              ],
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  TextButton.icon(
                                    onPressed: () => _openStockAdjustDialog(p),
                                    icon: const Icon(Icons.sync_alt, size: 16),
                                    label: const Text('Adjust'),
                                  ),
                                  TextButton.icon(
                                    onPressed: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) => ProductFormScreen(
                                            product: p,
                                            onSave: (updated) => widget.onSaveProduct(updated),
                                          ),
                                        ),
                                      );
                                    },
                                    icon: const Icon(Icons.edit, size: 16),
                                    label: const Text('Edit'),
                                  ),
                                  TextButton.icon(
                                    style: TextButton.styleFrom(foregroundColor: AppColors.danger),
                                    onPressed: () => widget.onDeleteProduct(p['id'] as String),
                                    icon: const Icon(Icons.delete_outline, size: 16),
                                    label: const Text('Delete'),
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
