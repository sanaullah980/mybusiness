import 'package:flutter/material.dart';
import '../../../core/constants/colors.dart';

class ProductFormScreen extends StatefulWidget {
  final Map<String, dynamic>? product;
  final Function(Map<String, dynamic> product) onSave;

  const ProductFormScreen({super.key, this.product, required this.onSave});

  @override
  State<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends State<ProductFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl;
  late TextEditingController _barcodeCtrl;
  late TextEditingController _costCtrl;
  late TextEditingController _wholesaleCtrl;
  late TextEditingController _retailCtrl;
  late TextEditingController _stockCtrl;
  late TextEditingController _minStockCtrl;

  @override
  void initState() {
    super.initState();
    final p = widget.product;
    _nameCtrl = TextEditingController(text: p?['name'] ?? '');
    _barcodeCtrl = TextEditingController(text: p?['barcode'] ?? '');
    _costCtrl = TextEditingController(text: p?['cost']?.toString() ?? '');
    _wholesaleCtrl = TextEditingController(text: (p?['wholesalePrice'] ?? p?['price'])?.toString() ?? '');
    _retailCtrl = TextEditingController(text: (p?['retailPrice'] ?? p?['price'])?.toString() ?? '');
    _stockCtrl = TextEditingController(text: p?['stock']?.toString() ?? '0');
    _minStockCtrl = TextEditingController(text: p?['minStock']?.toString() ?? '5');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _barcodeCtrl.dispose();
    _costCtrl.dispose();
    _wholesaleCtrl.dispose();
    _retailCtrl.dispose();
    _stockCtrl.dispose();
    _minStockCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;

    final cost = double.parse(_costCtrl.text.trim());
    final wholesale = double.parse(_wholesaleCtrl.text.trim());
    final retail = double.parse(_retailCtrl.text.trim());
    final stock = int.parse(_stockCtrl.text.trim());
    final minStock = int.tryParse(_minStockCtrl.text.trim()) ?? 5;

    final data = {
      if (widget.product?['id'] != null) 'id': widget.product!['id'],
      'name': _nameCtrl.text.trim(),
      'barcode': _barcodeCtrl.text.trim().isEmpty ? null : _barcodeCtrl.text.trim(),
      'cost': cost,
      'price': wholesale,
      'wholesalePrice': wholesale,
      'retailPrice': retail,
      'stock': stock,
      'minStock': minStock,
    };

    widget.onSave(data);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.product != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? 'Edit Product' : 'Add Product'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _nameCtrl,
                decoration: const InputDecoration(labelText: 'Product Name *', border: OutlineInputBorder()),
                validator: (val) => val == null || val.trim().isEmpty ? 'Product name required' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _barcodeCtrl,
                decoration: const InputDecoration(
                  labelText: 'Barcode (Optional)',
                  border: OutlineInputBorder(),
                  suffixIcon: Icon(Icons.qr_code_scanner),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _costCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Cost Price (Rs.) *', border: OutlineInputBorder()),
                      validator: (val) => double.tryParse(val ?? '') == null ? 'Valid number required' : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _wholesaleCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Wholesale Price *', border: OutlineInputBorder()),
                      validator: (val) => double.tryParse(val ?? '') == null ? 'Valid number required' : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _retailCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Retail Price (Rs.) *', border: OutlineInputBorder()),
                validator: (val) => double.tryParse(val ?? '') == null ? 'Valid number required' : null,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _stockCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Initial Stock *', border: OutlineInputBorder()),
                      validator: (val) => int.tryParse(val ?? '') == null ? 'Valid integer required' : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _minStockCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Min Stock Alert', border: OutlineInputBorder()),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.tealPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: _submit,
                  child: Text(
                    isEdit ? 'Update Product' : 'Save Product',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
