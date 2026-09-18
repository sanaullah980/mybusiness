class AiToolDefinition {
  final String name;
  final String description;
  final Map<String, dynamic> parameters;
  final bool requiresUserConfirmation;

  AiToolDefinition({
    required this.name,
    required this.description,
    required this.parameters,
    required this.requiresUserConfirmation,
  });
}

class AiToolCall {
  final String toolName;
  final Map<String, dynamic> arguments;
  final bool requiresConfirmation;
  final String humanReadableSummary;

  AiToolCall({
    required this.toolName,
    required this.arguments,
    required this.requiresConfirmation,
    required this.humanReadableSummary,
  });
}

class AiToolRegistry {
  static final List<AiToolDefinition> tools = [
    AiToolDefinition(
      name: 'check_stock',
      description: 'Check stock quantity, cost, and price of a product.',
      parameters: {
        'type': 'object',
        'properties': {
          'product_name': {'type': 'string', 'description': 'The name or barcode of the product'}
        },
        'required': ['product_name']
      },
      requiresUserConfirmation: false,
    ),
    AiToolDefinition(
      name: 'get_customer_balance',
      description: 'Retrieve current outstanding debt balance and details for a customer.',
      parameters: {
        'type': 'object',
        'properties': {
          'customer_name': {'type': 'string', 'description': 'Customer full or partial name'}
        },
        'required': ['customer_name']
      },
      requiresUserConfirmation: false,
    ),
    AiToolDefinition(
      name: 'record_sale',
      description: 'Record a new retail or wholesale sale. FINANCIAL ACTION: requires user confirmation.',
      parameters: {
        'type': 'object',
        'properties': {
          'customer_name': {'type': 'string'},
          'items': {'type': 'array', 'items': {'type': 'object'}},
          'amount_paid': {'type': 'number'},
          'sale_type': {'type': 'string', 'enum': ['retail', 'wholesale']}
        },
        'required': ['items', 'amount_paid', 'sale_type']
      },
      requiresUserConfirmation: true,
    ),
    AiToolDefinition(
      name: 'record_customer_payment',
      description: 'Record a cash payment from a customer towards their debt. FINANCIAL ACTION: requires confirmation.',
      parameters: {
        'type': 'object',
        'properties': {
          'customer_name': {'type': 'string'},
          'amount': {'type': 'number'},
          'note': {'type': 'string'}
        },
        'required': ['customer_name', 'amount']
      },
      requiresUserConfirmation: true,
    ),
    AiToolDefinition(
      name: 'check_daily_report',
      description: 'Get today\'s sales, profit, and expense summary.',
      parameters: {
        'type': 'object',
        'properties': {}
      },
      requiresUserConfirmation: false,
    ),
    AiToolDefinition(
      name: 'add_expense',
      description: 'Log an operating expense. FINANCIAL ACTION: requires confirmation.',
      parameters: {
        'type': 'object',
        'properties': {
          'amount': {'type': 'number'},
          'category': {'type': 'string'},
          'note': {'type': 'string'}
        },
        'required': ['amount', 'category']
      },
      requiresUserConfirmation: true,
    ),
  ];
}
