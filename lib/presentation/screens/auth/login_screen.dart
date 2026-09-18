import 'package:flutter/material.dart';
import '../../../core/constants/colors.dart';
import '../../../data/remote/firebase_auth_service.dart';

class LoginScreen extends StatefulWidget {
  final FirebaseAuthService authService;
  final VoidCallback onLoginSuccess;

  const LoginScreen({
    super.key,
    required this.authService,
    required this.onLoginSuccess,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = false;
  String? _errorMessage;

  // Login controllers
  final _loginUserCtrl = TextEditingController();
  final _loginPassCtrl = TextEditingController();

  // Register controllers
  final _regUserCtrl = TextEditingController();
  final _regPassCtrl = TextEditingController();
  final _regShopNameCtrl = TextEditingController();
  final _regPhoneCtrl = TextEditingController();
  final _regInviteCodeCtrl = TextEditingController();
  final _regEmployeeNameCtrl = TextEditingController();

  bool _isEmployeeRegistration = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _loginUserCtrl.dispose();
    _loginPassCtrl.dispose();
    _regUserCtrl.dispose();
    _regPassCtrl.dispose();
    _regShopNameCtrl.dispose();
    _regPhoneCtrl.dispose();
    _regInviteCodeCtrl.dispose();
    _regEmployeeNameCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final username = _loginUserCtrl.text.trim();
    final password = _loginPassCtrl.text.trim();
    if (username.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'Please enter both username and password.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await widget.authService.signInWithUsername(username: username, password: password);
      widget.onLoginSuccess();
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceAll('Exception:', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleRegister() async {
    final username = _regUserCtrl.text.trim();
    final password = _regPassCtrl.text.trim();

    if (username.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'Please enter both username and password.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      if (_isEmployeeRegistration) {
        final code = _regInviteCodeCtrl.text.trim();
        final name = _regEmployeeNameCtrl.text.trim();
        if (code.isEmpty || name.isEmpty) {
          throw Exception('Please provide your name and the 8-character invite code.');
        }
        await widget.authService.registerEmployeeWithInvite(
          username: username,
          password: password,
          inviteCode: code,
          displayName: name,
        );
      } else {
        final shop = _regShopNameCtrl.text.trim();
        final phone = _regPhoneCtrl.text.trim();
        if (shop.isEmpty) {
          throw Exception('Shop name is required.');
        }
        await widget.authService.registerOwner(
          username: username,
          password: password,
          shopName: shop,
          phone: phone,
        );
      }
      widget.onLoginSuccess();
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceAll('Exception:', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // App Branding
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.tealPrimary.withOpacity(0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.store, size: 54, color: AppColors.tealPrimary),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'MyBusiness',
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: -0.5),
                  ),
                  const Text(
                    'Offline-First Shop & Khata Management',
                    style: TextStyle(color: Colors.grey, fontSize: 14),
                  ),

                  const SizedBox(height: 24),

                  TabBar(
                    controller: _tabController,
                    indicatorColor: AppColors.tealPrimary,
                    labelColor: AppColors.tealPrimary,
                    unselectedLabelColor: Colors.grey,
                    tabs: const [
                      Tab(text: 'Sign In'),
                      Tab(text: 'Create Account'),
                    ],
                  ),

                  const SizedBox(height: 20),

                  if (_errorMessage != null)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.danger.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(_errorMessage!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
                    ),

                  SizedBox(
                    height: _isEmployeeRegistration && _tabController.index == 1 ? 400 : 340,
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        // Sign In View
                        Column(
                          children: [
                            TextField(
                              controller: _loginUserCtrl,
                              decoration: const InputDecoration(labelText: 'Username', prefixIcon: Icon(Icons.person_outline), border: OutlineInputBorder()),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _loginPassCtrl,
                              obscureText: true,
                              decoration: const InputDecoration(labelText: 'Password', prefixIcon: Icon(Icons.lock_outline), border: OutlineInputBorder()),
                            ),
                            const SizedBox(height: 20),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.tealPrimary,
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                ),
                                onPressed: _isLoading ? null : _handleLogin,
                                child: _isLoading
                                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                    : const Text('Sign In', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                              ),
                            ),
                          ],
                        ),

                        // Create Account View
                        SingleChildScrollView(
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: RadioListTile<bool>(
                                      title: const Text('Shop Owner', style: TextStyle(fontSize: 13)),
                                      value: false,
                                      groupValue: _isEmployeeRegistration,
                                      onChanged: (v) => setState(() => _isEmployeeRegistration = v!),
                                      contentPadding: EdgeInsets.zero,
                                    ),
                                  ),
                                  Expanded(
                                    child: RadioListTile<bool>(
                                      title: const Text('Staff (Invite)', style: TextStyle(fontSize: 13)),
                                      value: true,
                                      groupValue: _isEmployeeRegistration,
                                      onChanged: (v) => setState(() => _isEmployeeRegistration = v!),
                                      contentPadding: EdgeInsets.zero,
                                    ),
                                  ),
                                ],
                              ),
                              TextField(
                                controller: _regUserCtrl,
                                decoration: const InputDecoration(labelText: 'Choose Username', border: OutlineInputBorder(), isDense: true),
                              ),
                              const SizedBox(height: 10),
                              TextField(
                                controller: _regPassCtrl,
                                obscureText: true,
                                decoration: const InputDecoration(labelText: 'Choose Password', border: OutlineInputBorder(), isDense: true),
                              ),
                              const SizedBox(height: 10),
                              if (!_isEmployeeRegistration) ...[
                                TextField(
                                  controller: _regShopNameCtrl,
                                  decoration: const InputDecoration(labelText: 'Shop / Business Name', border: OutlineInputBorder(), isDense: true),
                                ),
                                const SizedBox(height: 10),
                                TextField(
                                  controller: _regPhoneCtrl,
                                  keyboardType: TextInputType.phone,
                                  decoration: const InputDecoration(labelText: 'Phone Number', border: OutlineInputBorder(), isDense: true),
                                ),
                              ] else ...[
                                TextField(
                                  controller: _regEmployeeNameCtrl,
                                  decoration: const InputDecoration(labelText: 'Your Full Name', border: OutlineInputBorder(), isDense: true),
                                ),
                                const SizedBox(height: 10),
                                TextField(
                                  controller: _regInviteCodeCtrl,
                                  textCapitalization: TextCapitalization.characters,
                                  decoration: const InputDecoration(labelText: '8-Character Invite Code', border: OutlineInputBorder(), isDense: true),
                                ),
                              ],
                              const SizedBox(height: 16),
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.tealPrimary,
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                  ),
                                  onPressed: _isLoading ? null : _handleRegister,
                                  child: _isLoading
                                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                      : Text(
                                          _isEmployeeRegistration ? 'Join Shop Team' : 'Create Business Account',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                        ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
