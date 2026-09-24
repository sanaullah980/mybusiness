/*
 * MyBusiness Local AI Agent
 *
 * Deterministic business-action layer for the local Qwen-powered assistant.
 *
 * Public API:
 *   handleAgentCommand(input)
 *   agentContext()
 *   getAgentState()
 */

/* -------------------------------------------------------------------------- */
/* CENTRALIZED ALIAS / VOCABULARY DICTIONARY                                  */
/* -------------------------------------------------------------------------- */

export const WORDS = {
  price: [
    'price', 'prices', 'rate', 'rates', 'cost', 'amount',
    'qeemat', 'keemat', 'kemat', 'kimat', 'qimat', 'bhao', 'bhaw', 'bhau',
    'rupay', 'rupees', 'rupee', 'rs', 'pkr',
    'قیمت', 'رقم', 'ریٹ', 'دام', 'بھاؤ'
  ],

  sale: [
    'sale', 'sell', 'selling', 'sales', 'sel', 'sal',
    'sale karo', 'sell karo', 'sale kar do', 'sell kar do',
    'becho', 'bech do', 'bechna', 'bech', 'bik gaya', 'bika',
    'sale kr', 'sale kardo', 'sell krdo', 'sel karo', 'sel kro', 'sal kro',
    'farokht karo', 'farokht', 'make a sale', 'sell it',
    'فروخت', 'فروخت کرو', 'بیچو', 'بیچ دو', 'فروخت کر دو', 'سیل'
  ],

  wholesale: [
    'wholesale', 'whole sale', 'holsel', 'wholsale', 'تھوک'
  ],

  addStock: [
    'stock add', 'add stock', 'add', 'increase', 'restock', 'refill',
    'add karo', 'add kar do', 'add kro', 'add krdo',
    'stock mein add karo', 'stock me add karo',
    'stock mein add kro', 'stock me add kro',
    'maal add karo', 'saman add karo',
    'khareeda', 'khareed', 'khareed liya',
    'purchase', 'purchased', 'lena', 'le liya',
    'dal', 'daal', 'dal do', 'daal do',
    'jama', 'jama karo', 'barha do', 'barhao', 'barhado',
    'خرید', 'خریداری', 'اسٹاک', 'اسٹاک میں شامل کرو',
    'شامل کرو', 'مال', 'سامان', 'جمع', 'اضافہ', 'بڑھاؤ'
  ],

  removeStock: [
    'remove', 'decrease', 'minus', 'reduce', 'deduct',
    'kam', 'kamm', 'nikal', 'nikal do', 'nikalo',
    'ghata do', 'ghatao', 'ghatado',
    'کم', 'منہا', 'نکال', 'گھٹاؤ'
  ],

  receiveCustomer: [
    'receive', 'received', 'receiving', 'collect', 'collected',
    'got', 'get',
    'wapas', 'wapis', 'wasool', 'wasol', 'vasol', 'vasool', 'wusool',
    'wasool karo', 'vasool karo',
    'wasool kar liya', 'vasool kar liya',
    'liya', 'le liya', 'le lia',
    'mil gaya', 'mil gaye', 'mila', 'mile',
    'paisay wasool', 'payment receive',
    'payment received', 'amount received',
    'paise mil gaye', 'paisay mil gaye',
    'وصول', 'وصولی', 'وصول کرو', 'وصول کیا',
    'رقم وصول', 'پیسے وصول', 'لیا', 'ملا', 'ملے'
  ],

  giveCustomer: [
    'give', 'gave', 'giving', 'credit', 'add debt',
    'owe', 'owes',
    'udhaar', 'udhar', 'qarz',
    'diya', 'de diya', 'de dia',
    'da do', 'dado', 'dade', 'dedo', 'de do',
    'دیا', 'ادھار', 'واجب', 'قرض'
  ],

  supplierPayment: [
    'pay', 'paid', 'paying', 'payment',
    'pay supplier', 'give supplier',
    'ada', 'ada kiya', 'ada kar diya', 'adaigi',
    'ادا', 'ادائیگی', 'ادا کر دیا'
  ],

  supplierDebt: [
    'credit', 'debt', 'owe', 'owes',
    'udhaar', 'udhar', 'qarz', 'purchase debt',
    'ادھار', 'واجب', 'قرض'
  ],

  expense: [
    'expense', 'expenses', 'spent', 'spend', 'cost',
    'kharcha', 'kharch', 'kharcha kiya', 'kharch kiya',
    'خرچہ', 'اخراجات', 'خرچ'
  ],

  addCustomer: [
    'add customer', 'create customer', 'new customer',
    'add', 'create', 'new', 'banao', 'banayen',
    'بناؤ', 'بنائیں', 'شامل'
  ],

  addProduct: [
    'add product', 'create product', 'new product',
    'add', 'create', 'new', 'banao', 'banayen',
    'بناؤ', 'بنائیں', 'شامل'
  ]
};

/* -------------------------------------------------------------------------- */
/* NORMALIZATION                                                              */
/* -------------------------------------------------------------------------- */

export const norm = value =>
  String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[؟?!.،,؛;:*#_~`"'\(\)\[\]\{\}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const money = value =>
  window.formatCurrency
    ? window.formatCurrency(Number(value) || 0)
    : `Rs. ${(Number(value) || 0).toLocaleString()}`;

export const ownerId = () =>
  window.currentUserId ||
  window.authUserId ||
  null;

export function requireUser() {
  if (!ownerId()) {
    throw new Error('Please log in again before using the AI agent.');
  }
}

/* -------------------------------------------------------------------------- */
/* NUMBER WORDS                                                               */
/* -------------------------------------------------------------------------- */

export const NUMBER_WORDS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,

  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,

  ek: 1,
  aik: 1,
  yk: 1,

  do: 2,
  doo: 2,

  teen: 3,
  tin: 3,

  char: 4,
  chaar: 4,

  panch: 5,
  paanch: 5,

  chhe: 6,
  che: 6,
  chay: 6,
  chhay: 6,

  saat: 7,
  sat: 7,

  aath: 8,
  ath: 8,

  nau: 9,
  no: 9,
  now: 9,

  das: 10,

  gyarah: 11,
  gyara: 11,
  gyaarah: 11,

  barah: 12,
  bara: 12,

  terah: 13,
  tera: 13,

  chaudah: 14,
  chauda: 14,

  pandrah: 15,
  pandra: 15,

  solah: 16,
  sola: 16,

  satrah: 17,
  satra: 17,

  atharah: 18,
  athara: 18,

  unnees: 19,
  unnis: 19,

  bees: 20,
  bis: 20,

  ikkis: 21,
  ikees: 21,

  bais: 22,

  teis: 23,
  taees: 23,

  chaubees: 24,
  chaubis: 24,

  pachees: 25,
  pachis: 25,

  chabbis: 26,
  chhabees: 26,

  satais: 27,
  sattees: 27,

  athais: 28,
  athaees: 28,

  untees: 29,
  untis: 29,

  tees: 30,
  tis: 30,

  chalis: 40,
  chalees: 40,

  pachas: 50,
  pachaas: 50,

  saath: 60,
  sath: 60,

  sattar: 70,

  assi: 80,
  asee: 80,

  nabbe: 90,
  navve: 90,

  'صفر': 0,
  'ایک': 1,
  'دو': 2,
  'تین': 3,
  'چار': 4,
  'پانچ': 5,
  'چھ': 6,
  'سات': 7,
  'آٹھ': 8,
  'نو': 9,
  'دس': 10,
  'گیارہ': 11,
  'بارہ': 12,
  'تیرہ': 13,
  'چودہ': 14,
  'پندرہ': 15,
  'سولہ': 16,
  'سترہ': 17,
  'اٹھارہ': 18,
  'انیس': 19,
  'بیس': 20,
  'اکیس': 21,
  'بائیس': 22,
  'تیئیس': 23,
  'چوبیس': 24,
  'پچیس': 25,
  'چھبیس': 26,
  'ستائیس': 27,
  'اٹھائیس': 28,
  'انتیس': 29,
  'تیس': 30,
  'چالیس': 40,
  'پچاس': 50,
  'ساٹھ': 60,
  'ستر': 70,
  'اسی': 80,
  'نوے': 90,
  'سو': 100,
  'ہزار': 1000,
  'لاکھ': 100000
};

export const MULTIPLIER_WORDS = {
  hundred: 100,
  sau: 100,
  so: 100,
  'سو': 100,

  thousand: 1000,
  hazar: 1000,
  hazaar: 1000,
  'ہزار': 1000,

  lakh: 100000,
  lac: 100000,
  'لاکھ': 100000
};

/* -------------------------------------------------------------------------- */
/* COMPOUND NUMBER PARSER                                                     */
/* -------------------------------------------------------------------------- */

export function parseCompoundNumberWords(text) {
  const words = norm(text).split(/\s+/).filter(Boolean);
  if (!words.length) return NaN;

  let total = 0;
  let currentVal = 0;
  let hasNumber = false;

  for (const w of words) {
    if (/^\d+(?:\.\d+)?$/.test(w)) {
      currentVal += Number(w);
      hasNumber = true;
      continue;
    }

    if (MULTIPLIER_WORDS[w] !== undefined) {
      const mult = MULTIPLIER_WORDS[w];
      const base = currentVal === 0 ? 1 : currentVal;

      if (mult >= 1000) {
        total += base * mult;
        currentVal = 0;
      } else {
        currentVal = base * mult;
      }

      hasNumber = true;
      continue;
    }

    if (NUMBER_WORDS[w] !== undefined) {
      currentVal += NUMBER_WORDS[w];
      hasNumber = true;
      continue;
    }

    return NaN;
  }

  total += currentVal;
  return hasNumber ? total : NaN;
}

export function numberFrom(value) {
  const text = String(value || '').replace(/,/g, '');

  const match = text.match(
    /(?:rs\.?|rs|rupees?|₨|pkr)?\s*(-?\d+(?:\.\d+)?)/i
  );

  return match ? Number(match[1]) : NaN;
}

export function amountFrom(value) {
  const numeric = numberFrom(value);
  if (Number.isFinite(numeric)) return numeric;

  return parseCompoundNumberWords(value);
}

export function qtyFrom(value) {
  const text = norm(value);

  const explicit = text.match(
    /(\d+(?:\.\d+)?)\s*(?:x|pcs?|pieces?|piece|units?|unit|items?|item|qty|quantity|پیس|عدد)\b/i
  );

  if (explicit) {
    return Math.max(1, Math.floor(Number(explicit[1])));
  }

  const digits = text.match(/\b(\d+(?:\.\d+)?)\b/);

  if (digits) {
    return Math.max(1, Math.floor(Number(digits[1])));
  }

  const wordVal = parseCompoundNumberWords(text);

  if (Number.isFinite(wordVal) && wordVal > 0) {
    return Math.floor(wordVal);
  }

  return 1;
}

/* -------------------------------------------------------------------------- */
/* REGEX HELPERS                                                              */
/* -------------------------------------------------------------------------- */

export function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rx(words) {
  const sorted = [...words]
    .filter(Boolean)
    .sort((a, b) => String(b).length - String(a).length);

  return new RegExp(
    '(?:^|\\s)(?:' +
      sorted
        .map(word => escapeRegex(word).replace(/\s+/g, '\\s*'))
        .join('|') +
    ')(?=\\s|$)',
    'i'
  );
}

export const RX = {
  stock: /(?:stock|inventory|stok|maal|saman|سٹاک|اسٹاک|ذخیرہ|مال|سامان)/i,

  quantity:
    /(?:pcs?|pieces?|piece|units?|unit|items?|item|qty|quantity|پیس|عدد)/i,

  customer:
    /(?:customer|cust|custmer|client|grahak|gاہک|گاہک)/i,

  supplier:
    /(?:supplier|supllier|vendor|سپلائر|فراہم کنندہ)/i,

  balance:
    /(?:balance|due|debt|owe|owes|udhaar|udhar|qarz|kitna|kitne|how much|واجب|ادھار|قرض|کتنا|کتنے)/i,

  sale: rx(WORDS.sale),

  profit:
    /(?:profit|profet|munafa|منافع|منافعہ)/i,

  expense:
    rx(WORDS.expense),

  today:
    /(?:today|aaj|آج)/i,

  yesterday:
    /(?:yesterday|kal|گزشتہ کل|کل)/i,

  tomorrow:
    /(?:tomorrow|kal|کل)/i,

  lowStock:
    /(?:low stock|low inventory|kam stock|کم اسٹاک|کم سٹاک)/i,

  productsList:
    /(?:all products|product list|products list|show products|تمام پروڈکٹس|پروڈکٹس دکھاؤ)/i,

  confirm:
    /^(?:yes|y|haan|han|جی|ہاں|ok|okay|confirm|confirmed|kar do|kardo|kr do|krdo|do it|جی ہاں)$/i,

  cancel:
    /^(?:no|n|nah|nahi|نہیں|cancel|cancel it|mat karo|rehne do|رہنے دو)$/i
};

/* -------------------------------------------------------------------------- */
/* FUZZY & ENTITY MATCHING                                                    */
/* -------------------------------------------------------------------------- */

export function levenshtein(a, b) {
  const left = String(a || '');
  const right = String(b || '');

  if (left === right) return 0;

  const prev = new Array(right.length + 1);

  for (let j = 0; j <= right.length; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= left.length; i++) {
    const current = new Array(right.length + 1);
    current[0] = i;

    for (let j = 1; j <= right.length; j++) {
      current[j] =
        left[i - 1] === right[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(
              prev[j - 1],
              prev[j],
              current[j - 1]
            );
    }

    for (let j = 0; j <= right.length; j++) {
      prev[j] = current[j];
    }
  }

  return prev[right.length];
}

export function findMentionedAll(list, sentence) {
  const text = norm(sentence);

  if (!Array.isArray(list) || !list.length) {
    return [];
  }

  const exact = list.filter(item => {
    if (!item?.name) return false;

    const name = norm(item.name);

    return (
      text === name ||
      text.includes(` ${name} `) ||
      text.startsWith(`${name} `) ||
      text.endsWith(` ${name}`)
    );
  });

  if (exact.length) {
    return exact;
  }

  const words = text.split(/\s+/).filter(Boolean);
  const candidates = [];

  for (const item of list) {
    if (!item?.name) continue;

    const name = norm(item.name);
    const nameWords = name.split(/\s+/).length;

    for (let i = 0; i < words.length; i++) {
      const window = words
        .slice(i, i + nameWords)
        .join(' ');

      if (!window) continue;

      const distance = levenshtein(window, name);
      const limit = Math.max(
        1,
        Math.floor(name.length * 0.25)
      );

      if (distance <= limit) {
        candidates.push({
          item,
          distance
        });
      }
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);

  if (!candidates.length) {
    return [];
  }

  const bestDistance = candidates[0].distance;

  return candidates
    .filter(x => x.distance === bestDistance)
    .map(x => x.item);
}

export function resolveEntity(list, sentence, label) {
  const matches = findMentionedAll(list, sentence);

  if (!matches.length) {
    return {
      found: false,
      ambiguous: false,
      item: null,
      matches: []
    };
  }

  if (matches.length === 1) {
    return {
      found: true,
      ambiguous: false,
      item: matches[0],
      matches
    };
  }

  return {
    found: true,
    ambiguous: true,
    item: null,
    matches,
    question:
      `I found more than one ${label} matching that name: ` +
      matches
        .slice(0, 8)
        .map(x => x.name)
        .join(', ') +
      '. Which one do you mean?'
  };
}

export function names(list, max = 30) {
  return list
    .slice(0, max)
    .map(x => x?.name)
    .filter(Boolean)
    .join(', ');
}

/* -------------------------------------------------------------------------- */
/* SHORT-TERM CONVERSATION CONTEXT                                            */
/* -------------------------------------------------------------------------- */

const CONTEXT_KEY = '__myBusinessAiContext';

export function getContext() {
  if (!window[CONTEXT_KEY]) {
    window[CONTEXT_KEY] = {
      product: null,
      customer: null,
      supplier: null,
      lastAction: null,
      lastText: '',
      timestamp: 0
    };
  }

  return window[CONTEXT_KEY];
}

export function clearOldContext() {
  const context = getContext();

  if (
    context.timestamp &&
    Date.now() - context.timestamp > 5 * 60 * 1000
  ) {
    context.product = null;
    context.customer = null;
    context.supplier = null;
    context.lastAction = null;
    context.lastText = '';
  }
}

export function rememberContext({
  product = undefined,
  customer = undefined,
  supplier = undefined,
  action = undefined,
  text = undefined
}) {
  const context = getContext();

  if (product !== undefined) {
    context.product = product;
  }

  if (customer !== undefined) {
    context.customer = customer;
  }

  if (supplier !== undefined) {
    context.supplier = supplier;
  }

  if (action !== undefined) {
    context.lastAction = action;
  }

  if (text !== undefined) {
    context.lastText = text;
  }

  context.timestamp = Date.now();
}

export function contextProduct() {
  clearOldContext();
  return getContext().product || null;
}

export function contextCustomer() {
  clearOldContext();
  return getContext().customer || null;
}

export function contextSupplier() {
  clearOldContext();
  return getContext().supplier || null;
}

/* -------------------------------------------------------------------------- */
/* CONFIRMATION                                                               */
/* -------------------------------------------------------------------------- */

export function confirmationText(action) {
  window.__myBusinessAiPending = action;

  rememberContext({
    product: action.product ?? undefined,
    customer: action.customer ?? undefined,
    supplier: action.supplier ?? undefined,
    action
  });

  return (
    `${action.summary}\n\n` +
    `Confirm? Reply "yes" to perform it or "no" to cancel.`
  );
}

export function isYes(value) {
  const text = norm(value);

  return (
    RX.confirm.test(text) ||
    /^(?:yes|haan|han|جی ہاں|ہاں)\s+(?:please|kar do|kardo|krdo|کر دو|کردو)$/i.test(text)
  );
}

export function isNo(value) {
  const text = norm(value);

  return (
    RX.cancel.test(text) ||
    /^(?:no|nahin|nahi|نہیں)\s+(?:please|mat karo|cancel)$/i.test(text)
  );
}

/* -------------------------------------------------------------------------- */
/* DATE & SAFE DATA HELPERS                                                   */
/* -------------------------------------------------------------------------- */

export function localDate(value = new Date()) {
  if (window.getLocalDateStr) {
    return window.getLocalDateStr(
      value instanceof Date ? value : new Date(value)
    );
  }

  const d =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(d.getTime())) {
    return '';
  }

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

export function dateMatches(value, target) {
  return localDate(value) === target;
}

export function todayDate() {
  return localDate(new Date());
}

export function yesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDate(d);
}

export function dataSet(name) {
  const data = window.data || {};

  return Array.isArray(data[name])
    ? data[name]
    : [];
}

export function products() {
  return dataSet('products');
}

export function customers() {
  return dataSet('customers');
}

export function suppliers() {
  return dataSet('suppliers');
}

export function sales() {
  return dataSet('sales');
}

export function expenses() {
  return dataSet('expenses');
}

/* -------------------------------------------------------------------------- */
/* ACTION REGISTRY                                                            */
/* -------------------------------------------------------------------------- */

export const ACTIONS = Object.freeze({
  addStock: {
    purpose: 'Increase product stock',
    required: ['product', 'qty'],
    confirmation: true
  },

  addStockBatch: {
    purpose: 'Add multiple stock items and create missing products',
    required: ['items'],
    confirmation: true
  },

  removeStock: {
    purpose: 'Decrease product stock',
    required: ['product', 'qty'],
    confirmation: true
  },

  receiveCustomer: {
    purpose: 'Receive payment from customer',
    required: ['customer', 'amount'],
    confirmation: true
  },

  giveCustomer: {
    purpose: 'Add customer credit/debt',
    required: ['customer', 'amount'],
    confirmation: true
  },

  addCustomer: {
    purpose: 'Create customer',
    required: ['name'],
    confirmation: true
  },

  addProduct: {
    purpose: 'Create product',
    required: ['name'],
    confirmation: true
  },

  supplierPayment: {
    purpose: 'Pay supplier',
    required: ['supplier', 'amount'],
    confirmation: true
  },

  supplierDebt: {
    purpose: 'Add supplier payable',
    required: ['supplier', 'amount'],
    confirmation: true
  },

  expense: {
    purpose: 'Record expense',
    required: ['amount'],
    confirmation: true
  },

  sellProduct: {
    purpose: 'Sell single product',
    required: ['product', 'qty'],
    confirmation: true
  },

  sellProductBatch: {
    purpose: 'Sell multiple products with custom prices',
    required: ['items'],
    confirmation: true
  }
});

export function isRegisteredAction(type) {
  return Boolean(
    type &&
    Object.prototype.hasOwnProperty.call(ACTIONS, type)
  );
}

/* -------------------------------------------------------------------------- */
/* VALIDATION                                                                 */
/* -------------------------------------------------------------------------- */

export function validateAction(action) {
  if (!action || !isRegisteredAction(action.type)) {
    return {
      valid: false,
      error: 'Unsupported agent action.'
    };
  }

  if (action.product && !action.product.id) {
    return {
      valid: false,
      error: 'The selected product is missing its ID.'
    };
  }

  if (action.customer && !action.customer.id) {
    return {
      valid: false,
      error: 'The selected customer is missing its ID.'
    };
  }

  if (action.supplier && !action.supplier.id) {
    return {
      valid: false,
      error: 'The selected supplier is missing its ID.'
    };
  }

  if (
    ['addStock', 'removeStock', 'sellProduct'].includes(action.type)
  ) {
    if (
      !Number.isFinite(Number(action.qty)) ||
      Number(action.qty) <= 0
    ) {
      return {
        valid: false,
        error: 'Quantity must be greater than zero.'
      };
    }
  }

  if (action.type === 'addStockBatch') {
    if (
      !Array.isArray(action.items) ||
      !action.items.length
    ) {
      return {
        valid: false,
        error: 'At least one stock item is required.'
      };
    }

    for (const item of action.items) {
      if (!String(item?.name || '').trim()) {
        return {
          valid: false,
          error: 'Each stock item needs a product name.'
        };
      }

      if (
        !Number.isFinite(Number(item?.qty)) ||
        Number(item.qty) <= 0
      ) {
        return {
          valid: false,
          error:
            `Quantity for ${item?.name || 'product'} must be greater than zero.`
        };
      }

      if (
        !Number.isFinite(Number(item?.price)) ||
        Number(item.price) < 0
      ) {
        return {
          valid: false,
          error:
            `Price for ${item?.name || 'product'} must be valid.`
        };
      }
    }
  }

  if (action.type === 'sellProductBatch') {
    if (
      !Array.isArray(action.items) ||
      !action.items.length
    ) {
      return {
        valid: false,
        error: 'At least one sale item is required.'
      };
    }

    for (const item of action.items) {
      if (!item?.product || !item.product.id) {
        return {
          valid: false,
          error:
            `Product "${item?.name || 'unknown'}" is missing.`
        };
      }

      if (
        !Number.isFinite(Number(item?.qty)) ||
        Number(item.qty) <= 0
      ) {
        return {
          valid: false,
          error:
            `Quantity for ${item.name} must be greater than zero.`
        };
      }

      if (
        item.unitPrice !== undefined &&
        (
          !Number.isFinite(Number(item.unitPrice)) ||
          Number(item.unitPrice) < 0
        )
      ) {
        return {
          valid: false,
          error:
            `Price for ${item.name} must be valid.`
        };
      }
    }
  }

  if (
    [
      'receiveCustomer',
      'giveCustomer',
      'supplierPayment',
      'supplierDebt',
      'expense'
    ].includes(action.type)
  ) {
    if (
      !Number.isFinite(Number(action.amount)) ||
      Number(action.amount) <= 0
    ) {
      return {
        valid: false,
        error: 'Amount must be greater than zero.'
      };
    }
  }

  return {
    valid: true
  };
}

/* -------------------------------------------------------------------------- */
/* MULTI-ITEM NORMALIZATION HELPERS                                           */
/* -------------------------------------------------------------------------- */

const FILLER_AND_LINK_WORDS = new Set([
  'aur',
  'or',
  'and',
  'اور',

  'mein',
  'me',
  'main',
  'ma',
  'میں',

  'ka',
  'ki',
  'ke',
  'kay',
  'kaa',
  'کا',
  'کی',
  'کے',

  'ko',
  'سے',
  'se',
  'کو',

  'karo',
  'kro',
  'kar',
  'kr',
  'krdo',
  'kardo',
  'کرو',
  'کر',
  'دو',

  'hai',
  'he',
  'hy',
  'hain',
  'ہے',
  'ہیں',

  'bhai',
  'yaar',
  'please',
  'plz',
  'zara',
  'ab',

  'it',
  'itna',
  'bas',
  'just',

  'do'
]);

const PRICE_INDICATOR_WORDS = new Set(
  WORDS.price.map(w => norm(w))
);

const SALE_WORDS_SET = new Set(
  WORDS.sale.map(w => norm(w))
);

const STOCK_ACTION_WORDS_SET = new Set(
  WORDS.addStock
    .concat(WORDS.removeStock)
    .map(w => norm(w))
);

function isNumberToken(token) {
  if (!token) return false;

  if (/^\d+(?:\.\d+)?$/.test(token)) {
    return true;
  }

  return (
    NUMBER_WORDS[token] !== undefined ||
    MULTIPLIER_WORDS[token] !== undefined
  );
}

function evaluateNumberTokens(tokens) {
  if (!Array.isArray(tokens) || !tokens.length) {
    return NaN;
  }

  return parseCompoundNumberWords(
    tokens.join(' ')
  );
}

function isSaleWord(token) {
  return SALE_WORDS_SET.has(norm(token));
}

function isStockActionWord(token) {
  return STOCK_ACTION_WORDS_SET.has(norm(token));
}

function isFiller(token) {
  return FILLER_AND_LINK_WORDS.has(norm(token));
}

function isPriceIndicator(token) {
  return PRICE_INDICATOR_WORDS.has(norm(token));
}

/*
 * Returns the longest exact product-name match starting at index.
 *
 * This is important for multi-item sales:
 *
 *   1 mobile charger 3 photo frame 2 lamp
 *
 * It makes "mobile charger" one product instead of two words.
 */
function findProductStartingAt(tokens, index, allProducts) {
  if (!Array.isArray(allProducts) || !allProducts.length) {
    return null;
  }

  const maxWords = Math.min(
    12,
    tokens.length - index
  );

  for (let len = maxWords; len >= 1; len--) {
    const candidate = tokens
      .slice(index, index + len)
      .join(' ');

    const normalizedCandidate = norm(candidate);

    const found = allProducts.find(
      p => norm(p?.name) === normalizedCandidate
    );

    if (found) {
      return {
        product: found,
        length: len
      };
    }
  }

  return null;
}

/*
 * Find whether tokens beginning at index represent a known product
 * after an optional quantity.
 */
function nextKnownProduct(tokens, index, allProducts) {
  let start = index;

  while (
    start < tokens.length &&
    isFiller(tokens[start])
  ) {
    start++;
  }

  return findProductStartingAt(
    tokens,
    start,
    allProducts
  );
}

/*
 * Remove repeated/duplicate product items from a batch.
 *
 * Example:
 *   2 lamp 3 lamp stock add
 *
 * becomes:
 *   lamp qty = 5
 */
function mergeStockItems(items, allProducts) {
  const map = new Map();

  for (const item of items) {
    const key = norm(
      item.product?.name || item.name
    );

    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, {
        ...item
      });
    } else {
      const existing = map.get(key);

      existing.qty =
        Number(existing.qty || 0) +
        Number(item.qty || 0);

      /*
       * If a later item explicitly gives a price,
       * use that price.
       */
      if (
        Number.isFinite(Number(item.price)) &&
        Number(item.price) >= 0
      ) {
        existing.price = Number(item.price);
      }
    }
  }

  return [...map.values()].map(item => {
    if (!item.product) {
      const found = allProducts.find(
        p => norm(p.name) === norm(item.name)
      );

      if (found) {
        item.product = found;
        item.name = found.name;
      }
    }

    return item;
  });
}

function mergeSaleItems(items) {
  const map = new Map();

  for (const item of items) {
    if (!item?.product?.id) continue;

    const key = String(item.product.id);

    if (!map.has(key)) {
      map.set(key, {
        ...item
      });
      continue;
    }

    const existing = map.get(key);

    existing.qty =
      Number(existing.qty || 0) +
      Number(item.qty || 0);

    /*
     * If the second occurrence has a custom price,
     * retain that explicit price.
     */
    if (item.unitPrice !== undefined) {
      existing.unitPrice = Number(item.unitPrice);
    }
  }

  return [...map.values()];
}

/* -------------------------------------------------------------------------- */
/* STOCK MULTI-ITEM PARSER                                                    */
/* -------------------------------------------------------------------------- */

/*
 * Supported examples:
 *
 * 50 lamp 300 50 frame 600 stock mein add karo
 *
 * 50 lamp price 300 and 50 frame price 600 add stock
 *
 * 50 lamp 300 20 mobile charger 800 stock add
 *
 * Unknown products are allowed because stock commands can create products.
 */
export function parseMultiStockItems(body, allProducts) {
  const rawTokens = norm(body)
    .split(/\s+/)
    .filter(Boolean);

  const items = [];
  let i = 0;

  while (i < rawTokens.length) {
    /* Skip command/filler words */
    while (
      i < rawTokens.length &&
      (
        isFiller(rawTokens[i]) ||
        isPriceIndicator(rawTokens[i]) ||
        isStockActionWord(rawTokens[i])
      )
    ) {
      i++;
    }

    if (i >= rawTokens.length) break;

    /* -------------------------------------------------------------- */
    /* Quantity                                                        */
    /* -------------------------------------------------------------- */

    const qtyTokens = [];

    while (
      i < rawTokens.length &&
      isNumberToken(rawTokens[i])
    ) {
      qtyTokens.push(rawTokens[i]);
      i++;
    }

    if (!qtyTokens.length) {
      i++;
      continue;
    }

    const qty = evaluateNumberTokens(qtyTokens);

    if (!Number.isFinite(qty) || qty <= 0) {
      return [];
    }

    /* -------------------------------------------------------------- */
    /* Product name                                                    */
    /* -------------------------------------------------------------- */

    const knownProduct = findProductStartingAt(
      rawTokens,
      i,
      allProducts
    );

    let product = null;
    let productName = '';

    if (knownProduct) {
      product = knownProduct.product;
      productName = product.name;
      i += knownProduct.length;
    } else {
      /*
       * Unknown product:
       *
       * Gather words until the next number or command word.
       */
      const nameTokens = [];

      while (i < rawTokens.length) {
        const token = rawTokens[i];

        if (isNumberToken(token)) {
          break;
        }

        if (
          isStockActionWord(token) ||
          isPriceIndicator(token)
        ) {
          break;
        }

        if (
          isFiller(token) &&
          nameTokens.length > 0
        ) {
          /*
           * "lamp and 50 frame"
           *
           * Stop before "and" when the next token starts
           * the next item.
           */
          if (
            i + 1 < rawTokens.length &&
            isNumberToken(rawTokens[i + 1])
          ) {
            break;
          }
        }

        nameTokens.push(token);
        i++;
      }

      productName = nameTokens.join(' ').trim();

      if (!productName) {
        break;
      }

      const exact = allProducts.find(
        p => norm(p.name) === norm(productName)
      );

      if (exact) {
        product = exact;
        productName = exact.name;
      }
    }

    if (!productName) {
      break;
    }

    /* -------------------------------------------------------------- */
    /* Price                                                           */
    /* -------------------------------------------------------------- */

    while (
      i < rawTokens.length &&
      (
        isPriceIndicator(rawTokens[i]) ||
        isFiller(rawTokens[i])
      )
    ) {
      /*
       * Do not consume "and" if it starts the next item.
       */
      if (
        isFiller(rawTokens[i]) &&
        i + 1 < rawTokens.length &&
        isNumberToken(rawTokens[i + 1])
      ) {
        break;
      }

      i++;
    }

    const priceTokens = [];

    while (
      i < rawTokens.length &&
      isNumberToken(rawTokens[i])
    ) {
      /*
       * For stock format, after product the first numeric value
       * is the price.
       *
       * Once one price has been captured, stop so the next number
       * can become the next item's quantity.
       */
      if (priceTokens.length) {
        break;
      }

      priceTokens.push(rawTokens[i]);
      i++;
    }

    let price = NaN;

    if (priceTokens.length) {
      price = evaluateNumberTokens(priceTokens);
    }

    /*
     * Existing product with no explicit price:
     * preserve existing cost.
     *
     * New product without price:
     * use 0.
     */
    const finalPrice = Number.isFinite(price)
      ? price
      : (
          product
            ? Number(product.cost || 0)
            : 0
        );

    items.push({
      name: productName,
      product: product || null,
      qty: Math.floor(qty),
      price: Math.max(0, Number(finalPrice) || 0)
    });
  }

  return mergeStockItems(items, allProducts);
}

/* -------------------------------------------------------------------------- */
/* SALE MULTI-ITEM PARSER                                                     */
/* -------------------------------------------------------------------------- */

/*
 * IMPORTANT:
 *
 * The old parser had this problem:
 *
 *   1 gop 3 frame 4 lamp 5 soap
 *
 * It could treat "3" as the price of gop.
 *
 * This parser first checks whether the number after a product is actually
 * the quantity of the NEXT known product.
 *
 * Therefore:
 *
 *   1 gop 3 frame 4 lamp
 *
 * becomes:
 *   gop   qty 1
 *   frame qty 3
 *   lamp  qty 4
 *
 * While:
 *
 *   1 gop 500 3 frame 700
 *
 * becomes:
 *   gop   qty 1 price 500
 *   frame qty 3 price 700
 */
export function parseMultiSaleItems(body, allProducts) {
  const rawTokens = norm(body)
    .split(/\s+/)
    .filter(Boolean);

  const items = [];
  let i = 0;

  while (i < rawTokens.length) {
    /* -------------------------------------------------------------- */
    /* Skip fillers and sale words                                     */
    /* -------------------------------------------------------------- */

    while (
      i < rawTokens.length &&
      (
        isFiller(rawTokens[i]) ||
        isSaleWord(rawTokens[i]) ||
        isPriceIndicator(rawTokens[i])
      )
    ) {
      i++;
    }

    if (i >= rawTokens.length) break;

    /* -------------------------------------------------------------- */
    /* Quantity                                                        */
    /* -------------------------------------------------------------- */

    let qty = 1;

    const qtyTokens = [];

    while (
      i < rawTokens.length &&
      isNumberToken(rawTokens[i])
    ) {
      qtyTokens.push(rawTokens[i]);
      i++;
    }

    if (qtyTokens.length) {
      const parsedQty =
        evaluateNumberTokens(qtyTokens);

      if (
        Number.isFinite(parsedQty) &&
        parsedQty > 0
      ) {
        qty = Math.floor(parsedQty);
      }
    }

    /* -------------------------------------------------------------- */
    /* Known product matching                                          */
    /* -------------------------------------------------------------- */

    let matchedProduct = null;

    const productMatch =
      findProductStartingAt(
        rawTokens,
        i,
        allProducts
      );

    if (productMatch) {
      matchedProduct = productMatch.product;
      i += productMatch.length;
    } else {
      /*
       * Unknown products cannot safely be sold.
       *
       * Gather a fallback name so the caller can return a useful
       * "product not found" message instead of silently doing
       * something else.
       */
      const nameTokens = [];

      while (i < rawTokens.length) {
        const token = rawTokens[i];

        if (isNumberToken(token)) {
          break;
        }

        if (
          isSaleWord(token) ||
          isPriceIndicator(token)
        ) {
          break;
        }

        if (
          isFiller(token) &&
          nameTokens.length > 0
        ) {
          if (
            i + 1 < rawTokens.length &&
            isNumberToken(rawTokens[i + 1])
          ) {
            break;
          }
        }

        nameTokens.push(token);
        i++;
      }

      const fallbackName =
        nameTokens.join(' ').trim();

      if (!fallbackName) {
        break;
      }

      const exact = allProducts.find(
        p => norm(p.name) === norm(fallbackName)
      );

      if (exact) {
        matchedProduct = exact;
      } else {
        items.push({
          name: fallbackName,
          product: null,
          qty,
          unitPrice: undefined
        });

        continue;
      }
    }

    if (!matchedProduct) {
      break;
    }

    /* -------------------------------------------------------------- */
    /* Determine whether next number is PRICE or NEXT QUANTITY         */
    /* -------------------------------------------------------------- */

    while (
      i < rawTokens.length &&
      isFiller(rawTokens[i])
    ) {
      /*
       * Stop before:
       *
       * "3 frame"
       *
       * because 3 belongs to the next product.
       */
      if (
        i + 1 < rawTokens.length &&
        isNumberToken(rawTokens[i + 1])
      ) {
        break;
      }

      i++;
    }

    while (
      i < rawTokens.length &&
      isPriceIndicator(rawTokens[i])
    ) {
      i++;
    }

    let customUnitPrice;

    if (
      i < rawTokens.length &&
      isNumberToken(rawTokens[i])
    ) {
      /*
       * Look ahead.
       *
       * Example:
       *
       *   1 gop 3 frame
       *
       * Current number = 3.
       * If token after 3 begins a known product, then 3 is
       * the NEXT quantity, not gop's price.
       */
      const possibleNextQtyIndex = i;

      const nextProduct =
        findProductStartingAt(
          rawTokens,
          possibleNextQtyIndex + 1,
          allProducts
        );

      if (!nextProduct) {
        /*
         * No known product after the number.
         * Treat the number as a custom price.
         */
        const priceTokens = [rawTokens[i]];
        const parsedPrice =
          evaluateNumberTokens(priceTokens);

        if (
          Number.isFinite(parsedPrice) &&
          parsedPrice >= 0
        ) {
          customUnitPrice = parsedPrice;
          i++;
        }
      }

      /*
       * If a known product follows the number,
       * leave the number untouched.
       *
       * The next loop will use it as quantity.
       */
    }

    items.push({
      name: matchedProduct.name,
      product: matchedProduct,
      qty,
      unitPrice: customUnitPrice
    });
  }

  return mergeSaleItems(items);
}

/* -------------------------------------------------------------------------- */
/* EXECUTION                                                                  */
/* -------------------------------------------------------------------------- */

export async function execute(action) {
  requireUser();

  const validation = validateAction(action);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const db = window.db;
  const doc = window.doc;
  const collection = window.collection;

  if (!db || !doc || !collection) {
    throw new Error(
      'The database interface is not available.'
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Single Stock Add / Remove                                               */
  /* ---------------------------------------------------------------------- */

  if (
    action.type === 'addStock' ||
    action.type === 'removeStock'
  ) {
    const ref = doc(
      db,
      'products',
      action.product.id
    );

    let newStock = 0;

    await window.runAtomicOrOffline(async tx => {
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        throw new Error(
          'Product no longer exists.'
        );
      }

      const data = snap.data();

      if (data.ownerId !== ownerId()) {
        throw new Error(
          'Unauthorized product.'
        );
      }

      const current =
        Number(data.stock) || 0;

      newStock =
        action.type === 'addStock'
          ? current + Number(action.qty)
          : current - Number(action.qty);

      if (newStock < 0) {
        throw new Error(
          `Not enough stock. Available: ${current}, requested: ${action.qty}.`
        );
      }

      tx.update(ref, {
        stock: newStock,
        updatedAt: new Date().toISOString()
      });

      const adjustmentRef =
        doc(collection(db, 'stockAdjustments'));

      tx.set(adjustmentRef, {
        ownerId: ownerId(),
        productId: action.product.id,
        type:
          action.type === 'addStock'
            ? 'add'
            : 'remove',
        quantity: Number(action.qty),
        date: new Date().toISOString(),
        note: 'AI agent'
      });
    });

    rememberContext({
      product: action.product,
      action
    });

    return (
      `Done. ${action.product.name} stock ` +
      `${action.type === 'addStock' ? 'increased' : 'decreased'} ` +
      `by ${action.qty}. New stock: ${newStock}.`
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Batch Stock Add / Auto-Create Missing Products                           */
  /* ---------------------------------------------------------------------- */

  if (action.type === 'addStockBatch') {
    const results = [];

    /*
     * Re-merge here as a final safety measure.
     */
    const mergedItems = mergeStockItems(
      action.items,
      products()
    );

    await window.runAtomicOrOffline(async tx => {
      /*
       * Maintain a local map so repeated items in the same batch
       * cannot overwrite each other's stock.
       */
      const productState = new Map();

      for (const item of mergedItems) {
        const name =
          String(item.name || '').trim();

        const qty =
          Number(item.qty);

        const price =
          Number(item.price);

        if (!name) {
          throw new Error(
            'A stock item has no product name.'
          );
        }

        if (
          !Number.isFinite(qty) ||
          qty <= 0
        ) {
          throw new Error(
            `Invalid quantity for ${name}.`
          );
        }

        if (
          !Number.isFinite(price) ||
          price < 0
        ) {
          throw new Error(
            `Invalid price for ${name}.`
          );
        }

        let existing =
          products().find(
            p => norm(p.name) === norm(name)
          );

        /*
         * If a product has already been created during this
         * transaction, use that state.
         */
        const existingKey =
          existing
            ? String(existing.id)
            : `new:${norm(name)}`;

        if (existing) {
          const ref = doc(
            db,
            'products',
            existing.id
          );

          let state =
            productState.get(existingKey);

          if (!state) {
            const snap =
              await tx.get(ref);

            if (!snap.exists()) {
              throw new Error(
                `Product ${name} no longer exists.`
              );
            }

            const data = snap.data();

            if (
              data.ownerId !== ownerId()
            ) {
              throw new Error(
                `Unauthorized product ${name}.`
              );
            }

            state = {
              ref,
              name: data.name || name,
              stock: Number(data.stock) || 0,
              cost: Number(data.cost) || 0,
              price: Number(data.price) || 0,
              wholesalePrice:
                Number(
                  data.wholesalePrice ??
                  data.price ??
                  0
                ),
              retailPrice:
                Number(
                  data.retailPrice ??
                  data.price ??
                  0
                )
            };

            productState.set(
              existingKey,
              state
            );
          }

          state.stock += qty;

          /*
           * If an explicit price was supplied, update all
           * price fields consistently.
           */
          const updates = {
            stock: state.stock,
            updatedAt:
              new Date().toISOString()
          };

          if (price > 0) {
            state.cost = price;
            state.price = price;
            state.wholesalePrice = price;
            state.retailPrice = price;

            updates.cost = price;
            updates.price = price;
            updates.wholesalePrice = price;
            updates.retailPrice = price;
          }

          tx.update(
            state.ref,
            updates
          );

          const adjustmentRef =
            doc(collection(db, 'stockAdjustments'));

          tx.set(adjustmentRef, {
            ownerId: ownerId(),
            productId: existing.id,
            type: 'add',
            quantity: qty,
            price,
            date:
              new Date().toISOString(),
            note:
              'AI agent batch stock add'
          });

          results.push(
            `${state.name}: +${qty} stock ` +
            `(new stock: ${state.stock}) ` +
            `at ${money(price)}`
          );

        } else {
          /*
           * Create missing product.
           */
          const productRef =
            doc(collection(db, 'products'));

          tx.set(productRef, {
            name,
            barcode: '',

            /*
             * All price fields intentionally use the
             * supplied price for AI auto-created products.
             */
            cost: price,
            price,
            wholesalePrice: price,
            retailPrice: price,

            minStock: 5,
            stock: qty,
            ownerId: ownerId(),
            createdAt:
              new Date().toISOString(),
            updatedAt:
              new Date().toISOString()
          });

          const adjustmentRef =
            doc(collection(db, 'stockAdjustments'));

          tx.set(adjustmentRef, {
            ownerId: ownerId(),
            productId: productRef.id,
            type: 'add',
            quantity: qty,
            price,
            date:
              new Date().toISOString(),
            note:
              'AI agent product auto-creation'
          });

          /*
           * Register newly-created item so a duplicate
           * within the same batch cannot create another product.
           */
          productState.set(
            `new:${norm(name)}`,
            {
              ref: productRef,
              name,
              stock: qty
            }
          );

          results.push(
            `${name}: created with ${qty} stock ` +
            `at ${money(price)}`
          );
        }
      }
    });

    return (
      `Added to stock successfully:\n` +
      results
        .map(r => `• ${r}`)
        .join('\n')
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Single Product Sale                                                     */
  /* ---------------------------------------------------------------------- */

  if (action.type === 'sellProduct') {
    const items = [
      {
        product: action.product,
        qty: Number(action.qty),
        unitPrice:
          action.unitPrice !== undefined
            ? Number(action.unitPrice)
            : undefined
      }
    ];

    return await executeBatchSale({
      items,
      customer:
        action.customer || null,
      saleType:
        action.saleType || 'retail'
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Batch Sale                                                              */
  /* ---------------------------------------------------------------------- */

  if (action.type === 'sellProductBatch') {
    return await executeBatchSale(action);
  }

  /* ---------------------------------------------------------------------- */
  /* Customer Payment / Debt                                                 */
  /* ---------------------------------------------------------------------- */

  if (
    action.type === 'receiveCustomer' ||
    action.type === 'giveCustomer'
  ) {
    const ref = doc(
      db,
      'customers',
      action.customer.id
    );

    const transactionRef =
      doc(collection(db, 'customerTransactions'));

    let newBalance = 0;

    await window.runAtomicOrOffline(async tx => {
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        throw new Error(
          'Customer no longer exists.'
        );
      }

      const data = snap.data();

      if (data.ownerId !== ownerId()) {
        throw new Error(
          'Unauthorized customer.'
        );
      }

      const current =
        Math.max(
          0,
          Number(data.balance) || 0
        );

      if (
        action.type === 'receiveCustomer' &&
        Number(action.amount) > current
      ) {
        throw new Error(
          `Amount exceeds customer due of ${money(current)}.`
        );
      }

      newBalance =
        action.type === 'receiveCustomer'
          ? Math.max(
              0,
              current - Number(action.amount)
            )
          : current + Number(action.amount);

      tx.update(ref, {
        balance: newBalance,
        updatedAt:
          new Date().toISOString()
      });

      tx.set(transactionRef, {
        ownerId: ownerId(),
        customerId:
          action.customer.id,

        type:
          action.type === 'receiveCustomer'
            ? 'payment'
            : 'manual_debt',

        amount:
          Number(action.amount),

        amountPaid:
          action.type === 'receiveCustomer'
            ? Number(action.amount)
            : 0,

        debitAmount:
          action.type === 'receiveCustomer'
            ? 0
            : Number(action.amount),

        creditAmount:
          action.type === 'receiveCustomer'
            ? Number(action.amount)
            : 0,

        balanceAfter:
          newBalance,

        date:
          new Date().toISOString(),

        note: 'AI agent',

        createdBy:
          window.authUserId ||
          window.currentUserId
      });
    });

    rememberContext({
      customer: action.customer,
      action
    });

    return (
      `Done. ${money(action.amount)} ` +
      `${action.type === 'receiveCustomer' ? 'received from' : 'added to'} ` +
      `${action.customer.name}. ` +
      `New due: ${money(newBalance)}.`
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Add Customer                                                            */
  /* ---------------------------------------------------------------------- */

  if (action.type === 'addCustomer') {
    const existing =
      customers().filter(
        c =>
          norm(c.name) ===
          norm(action.name)
      );

    if (existing.length) {
      return (
        `Customer "${action.name}" already exists. ` +
        `No duplicate customer was created.`
      );
    }

    await window.addDoc(
      collection(db, 'customers'),
      {
        name: action.name,
        phone: action.phone || '',
        address: '',
        notes: '',
        dueDate: null,
        balance: 0,
        createdAt:
          new Date().toISOString(),
        ownerId: ownerId()
      }
    );

    rememberContext({
      customer: {
        name: action.name
      },
      action
    });

    return (
      `Done. Customer "${action.name}" ` +
      `added successfully.`
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Add Product                                                             */
  /* ---------------------------------------------------------------------- */

  if (action.type === 'addProduct') {
    const existing =
      products().filter(
        p =>
          norm(p.name) ===
          norm(action.name)
      );

    if (existing.length) {
      return (
        `Product "${action.name}" already exists. ` +
        `No duplicate product was created.`
      );
    }

    const cost =
      Number(action.cost) || 0;

    const wholesalePrice =
      Number(action.wholesalePrice) ||
      cost;

    const retailPrice =
      Number(action.retailPrice) ||
      wholesalePrice;

    await window.addDoc(
      collection(db, 'products'),
      {
        name: action.name,
        barcode: action.barcode || '',
        cost,
        price: wholesalePrice,
        wholesalePrice,
        retailPrice,
        minStock:
          Number(action.minStock) || 5,
        stock:
          Number(action.stock) || 0,
        ownerId: ownerId()
      }
    );

    return (
      `Done. Product "${action.name}" ` +
      `added with stock ${Number(action.stock) || 0}.`
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Supplier Payment / Debt                                                 */
  /* ---------------------------------------------------------------------- */

  if (
    action.type === 'supplierPayment' ||
    action.type === 'supplierDebt'
  ) {
    const ref = doc(
      db,
      'suppliers',
      action.supplier.id
    );

    const transactionRef =
      doc(collection(db, 'supplierTransactions'));

    let newBalance = 0;

    await window.runAtomicOrOffline(async tx => {
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        throw new Error(
          'Supplier no longer exists.'
        );
      }

      const data = snap.data();

      if (data.ownerId !== ownerId()) {
        throw new Error(
          'Unauthorized supplier.'
        );
      }

      const current =
        Math.max(
          0,
          Number(data.balance) || 0
        );

      if (
        action.type === 'supplierPayment' &&
        Number(action.amount) > current
      ) {
        throw new Error(
          `Payment exceeds supplier payable of ${money(current)}.`
        );
      }

      newBalance =
        action.type === 'supplierPayment'
          ? Math.max(
              0,
              current - Number(action.amount)
            )
          : current + Number(action.amount);

      tx.update(ref, {
        balance: newBalance,
        updatedAt:
          new Date().toISOString()
      });

      tx.set(transactionRef, {
        ownerId: ownerId(),
        supplierId:
          action.supplier.id,

        type:
          action.type === 'supplierPayment'
            ? 'payment'
            : 'manual_debt',

        amount:
          Number(action.amount),

        balanceAfter:
          newBalance,

        date:
          new Date().toISOString(),

        note: 'AI agent'
      });
    });

    rememberContext({
      supplier: action.supplier,
      action
    });

    return (
      `Done. ${money(action.amount)} ` +
      `${action.type === 'supplierPayment' ? 'paid to' : 'added as payable to'} ` +
      `${action.supplier.name}. ` +
      `New payable: ${money(newBalance)}.`
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Expense                                                                 */
  /* ---------------------------------------------------------------------- */

  if (action.type === 'expense') {
    await window.addDoc(
      collection(db, 'expenses'),
      {
        amount:
          Number(action.amount),

        date:
          new Date().toISOString(),

        category:
          action.category || 'AI expense',

        note:
          action.note ||
          'Added by AI agent',

        ownerId: ownerId()
      }
    );

    return (
      `Done. Expense of ${money(action.amount)} ` +
      `recorded` +
      (
        action.category
          ? ` under ${action.category}.`
          : '.'
      )
    );
  }

  throw new Error(
    'Unsupported agent action.'
  );
}

/* -------------------------------------------------------------------------- */
/* ATOMIC BATCH SALE                                                         */
/* -------------------------------------------------------------------------- */

async function executeBatchSale(action) {
  requireUser();

  const db = window.db;
  const doc = window.doc;
  const collection = window.collection;

  if (!db || !doc || !collection) {
    throw new Error(
      'The database interface is not available.'
    );
  }

  if (
    !Array.isArray(action.items) ||
    !action.items.length
  ) {
    throw new Error(
      'No sale items were provided.'
    );
  }

  /*
   * Merge duplicate products before execution.
   */
  const mergedItems =
    mergeSaleItems(action.items);

  if (!mergedItems.length) {
    throw new Error(
      'No valid sale products were provided.'
    );
  }

  const customerRef =
    action.customer
      ? doc(
          db,
          'customers',
          action.customer.id
        )
      : null;

  const isWholesale =
    action.saleType === 'wholesale';

  let grandTotal = 0;
  let grandProfit = 0;

  const summaryLines = [];
  const saleItems = [];

  await window.runAtomicOrOffline(async tx => {
    /*
     * Store all product states first.
     *
     * This guarantees that ALL products are checked before
     * any business data is changed.
     */
    const productStates = [];

    for (const item of mergedItems) {
      if (!item?.product?.id) {
        throw new Error(
          `Product "${item?.name || 'unknown'}" could not be identified.`
        );
      }

      const pRef =
        doc(
          db,
          'products',
          item.product.id
        );

      const pSnap =
        await tx.get(pRef);

      if (!pSnap.exists()) {
        throw new Error(
          `Product ${item.product.name} no longer exists.`
        );
      }

      const pData =
        pSnap.data();

      if (
        pData.ownerId !== ownerId()
      ) {
        throw new Error(
          `Unauthorized product ${item.product.name}.`
        );
      }

      const availableStock =
        Number(pData.stock) || 0;

      const requestedQty =
        Number(item.qty);

      if (
        !Number.isFinite(requestedQty) ||
        requestedQty <= 0
      ) {
        throw new Error(
          `Invalid quantity for ${pData.name}.`
        );
      }

      if (
        requestedQty > availableStock
      ) {
        throw new Error(
          `Not enough stock for ${pData.name}. ` +
          `Available: ${availableStock}, requested: ${requestedQty}.`
        );
      }

      const normalRetail =
        Number(
          pData.retailPrice ??
          pData.price ??
          0
        );

      const normalWholesale =
        Number(
          pData.wholesalePrice ??
          pData.price ??
          0
        );

      const cost =
        Number(pData.cost) || 0;

      const normalPrice =
        isWholesale
          ? normalWholesale
          : normalRetail;

      let unitPrice =
        item.unitPrice !== undefined
          ? Number(item.unitPrice)
          : normalPrice;

      if (
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        throw new Error(
          `Invalid selling price for ${pData.name}.`
        );
      }

      const itemTotal =
        unitPrice * requestedQty;

      const itemCostTotal =
        cost * requestedQty;

      const itemProfit =
        itemTotal - itemCostTotal;

      const discountPerUnit =
        !isWholesale
          ? Math.max(
              0,
              normalRetail - unitPrice
            )
          : Math.max(
              0,
              normalWholesale - unitPrice
            );

      const itemDiscount =
        discountPerUnit *
        requestedQty;

      productStates.push({
        item,
        pRef,
        pData,
        availableStock,
        requestedQty,
        unitPrice,
        normalPrice,
        cost,
        itemTotal,
        itemCostTotal,
        itemProfit,
        itemDiscount
      });
    }

    /*
     * Calculate totals only after every product has been validated.
     */
    for (const state of productStates) {
      grandTotal += state.itemTotal;
      grandProfit += state.itemProfit;

      saleItems.push({
        id: state.item.product.id,
        name: state.pData.name,
        price: state.unitPrice,
        normalPrice: state.normalPrice,
        cost: state.cost,
        qty: state.requestedQty,
        discount: state.itemDiscount,
        returnedQty: 0
      });

      summaryLines.push(
        `${state.requestedQty} × ${state.pData.name} ` +
        `at ${money(state.unitPrice)} each ` +
        `= ${money(state.itemTotal)}`
      );
    }

    /*
     * Now that ALL products are valid, update their stock.
     */
    for (const state of productStates) {
      tx.update(
        state.pRef,
        {
          stock:
            state.availableStock -
            state.requestedQty,

          updatedAt:
            new Date().toISOString()
        }
      );
    }

    /* -------------------------------------------------------------- */
    /* Customer                                                        */
    /* -------------------------------------------------------------- */

    let newCustomerBalance = 0;

    if (customerRef) {
      const cSnap =
        await tx.get(customerRef);

      if (!cSnap.exists()) {
        throw new Error(
          'Customer no longer exists.'
        );
      }

      const cData =
        cSnap.data();

      if (
        cData.ownerId !== ownerId()
      ) {
        throw new Error(
          'Unauthorized customer.'
        );
      }

      const currentBalance =
        Math.max(
          0,
          Number(cData.balance) || 0
        );

      newCustomerBalance =
        currentBalance +
        grandTotal;

      tx.update(
        customerRef,
        {
          balance:
            newCustomerBalance,

          updatedAt:
            new Date().toISOString()
        }
      );
    }

    /* -------------------------------------------------------------- */
    /* Invoice Number                                                  */
    /* -------------------------------------------------------------- */

    const invoiceNumbers =
      sales()
        .map(x =>
          parseInt(
            x.invoiceNumber,
            10
          )
        )
        .filter(Number.isFinite);

    const billNumber =
      Math.max(
        0,
        ...invoiceNumbers
      ) + 1;

    const saleRef =
      doc(collection(db, 'sales'));

    const totalDiscount =
      saleItems.reduce(
        (acc, item) =>
          acc +
          (Number(item.discount) || 0),
        0
      );

    /*
     * Keep the existing sale structure.
     *
     * subtotal is the actual entered sale subtotal,
     * total is the amount charged.
     */
    tx.set(
      saleRef,
      {
        ownerId: ownerId(),

        createdBy:
          window.authUserId ||
          window.currentUserId,

        createdByName:
          window.currentMemberName ||
          'Business Owner',

        customerId:
          action.customer
            ? action.customer.id
            : null,

        customerName:
          action.customer
            ? action.customer.name
            : 'Walk-in',

        saleType:
          isWholesale
            ? 'wholesale'
            : 'retail',

        date:
          new Date().toISOString(),

        items: saleItems,

        subtotal:
          grandTotal,

        discount:
          totalDiscount,

        discountType:
          'amount',

        total:
          grandTotal,

        amountPaid:
          action.customer
            ? 0
            : grandTotal,

        amountDue:
          action.customer
            ? grandTotal
            : 0,

        totalProfit:
          grandProfit,

        profitKnown:
          true,

        note:
          'AI agent',

        returnedAmount:
          0,

        returnedProfit:
          0,

        invoiceNumber:
          billNumber
      }
    );

    /* -------------------------------------------------------------- */
    /* Customer Transaction                                             */
    /* -------------------------------------------------------------- */

    if (customerRef) {
      const transactionRef =
        doc(
          collection(db, 'customerTransactions')
        );

      tx.set(
        transactionRef,
        {
          ownerId: ownerId(),

          customerId:
            action.customer.id,

          type:
            'sale_debt',

          amount:
            grandTotal,

          amountPaid:
            0,

          debitAmount:
            grandTotal,

          creditAmount:
            0,

          balanceAfter:
            newCustomerBalance,

          date:
            new Date().toISOString(),

          note:
            `Bill No. ${billNumber}`,

          billNo:
            String(billNumber),

          saleId:
            saleRef.id,

          createdBy:
            window.authUserId ||
            window.currentUserId
        }
      );
    }

    /* -------------------------------------------------------------- */
    /* Invoice Counter                                                  */
    /* -------------------------------------------------------------- */

    tx.set(
      doc(
        db,
        'settings',
        ownerId()
      ),
      {
        nextInvoiceNumber:
          billNumber + 1
      },
      {
        merge: true
      }
    );
  });

  rememberContext({
    customer:
      action.customer || undefined,
    action
  });

  return (
    `Done. Sold:\n` +
    summaryLines
      .map(s => `• ${s}`)
      .join('\n') +
    `\nTotal: ${money(grandTotal)}` +
    ` | Total Profit: ${money(grandProfit)}` +
    (
      action.customer
        ? ` (Added to ${action.customer.name}'s balance)`
        : ' (Walk-in)'
    )
  );
}

/* -------------------------------------------------------------------------- */
/* INFORMATION COMMANDS                                                       */
/* -------------------------------------------------------------------------- */

export function parseInformationCommand(input) {
  const text = norm(input);

  const allProducts = products();
  const allCustomers = customers();
  const allSales = sales();

  const productResult =
    resolveEntity(
      allProducts,
      text,
      'product'
    );

  if (
    productResult.ambiguous &&
    RX.stock.test(text)
  ) {
    return {
      kind: 'clarification',
      text: productResult.question
    };
  }

  if (
    productResult.found &&
    RX.stock.test(text) &&
    !rx(
      WORDS.addStock
        .concat(WORDS.removeStock)
        .concat(WORDS.sale)
    ).test(text)
  ) {
    rememberContext({
      product: productResult.item
    });

    return {
      kind: 'answer',
      text:
        `${productResult.item.name}: ` +
        `current stock ` +
        `${Number(productResult.item.stock) || 0}.`
    };
  }

  if (RX.lowStock.test(text)) {
    const low =
      allProducts.filter(
        p =>
          Number(p.stock || 0) <=
          Number(p.minStock || 5)
      );

    return {
      kind: 'answer',
      text: low.length
        ? `Low stock: ${low
            .map(
              p =>
                `${p.name} (${p.stock})`
            )
            .join(', ')}`
        : 'No low-stock products found.'
    };
  }

  if (RX.productsList.test(text)) {
    return {
      kind: 'answer',
      text: allProducts.length
        ? allProducts
            .map(
              p =>
                `${p.name}: ${p.stock} in stock`
            )
            .join('\n')
        : 'No products found.'
    };
  }

  const customerResult =
    resolveEntity(
      allCustomers,
      text,
      'customer'
    );

  if (
    customerResult.ambiguous &&
    RX.balance.test(text)
  ) {
    return {
      kind: 'clarification',
      text: customerResult.question
    };
  }

  if (
    customerResult.found &&
    RX.balance.test(text) &&
    !Number.isFinite(amountFrom(text))
  ) {
    rememberContext({
      customer:
        customerResult.item
    });

    return {
      kind: 'answer',
      text:
        `${customerResult.item.name}: due ` +
        `${money(customerResult.item.balance || 0)}.`
    };
  }

  if (
    (
      RX.customer.test(text) &&
      RX.balance.test(text)
    ) ||
    (
      RX.balance.test(text) &&
      /(?:udhaar|udhar|واجب|ادھار)/i.test(text)
    )
  ) {
    const due =
      allCustomers.filter(
        c =>
          Number(c.balance || 0) > 0
      );

    return {
      kind: 'answer',
      text: due.length
        ? due
            .map(
              c =>
                `${c.name}: ${money(c.balance)}`
            )
            .join('\n')
        : 'No customer dues found.'
    };
  }

  if (
    RX.sale.test(text) &&
    RX.today.test(text)
  ) {
    const date = todayDate();

    const rows =
      allSales.filter(
        s =>
          dateMatches(
            s.date,
            date
          )
      );

    const total =
      rows.reduce(
        (sum, s) =>
          sum +
          Number(s.total || 0),
        0
      );

    return {
      kind: 'answer',
      text:
        `Today's sales: ${rows.length} sale(s), ` +
        `total ${money(total)}.`
    };
  }

  if (
    RX.sale.test(text) &&
    RX.yesterday.test(text)
  ) {
    const date =
      yesterdayDate();

    const rows =
      allSales.filter(
        s =>
          dateMatches(
            s.date,
            date
          )
      );

    const total =
      rows.reduce(
        (sum, s) =>
          sum +
          Number(s.total || 0),
        0
      );

    return {
      kind: 'answer',
      text:
        `Yesterday's sales: ${rows.length} sale(s), ` +
        `total ${money(total)}.`
    };
  }

  if (
    RX.profit.test(text) &&
    RX.today.test(text)
  ) {
    const date =
      todayDate();

    const rows =
      allSales.filter(
        s =>
          dateMatches(
            s.date,
            date
          )
      );

    const profit =
      rows.reduce(
        (sum, s) =>
          sum +
          Number(s.totalProfit || 0),
        0
      );

    return {
      kind: 'answer',
      text:
        `Today's recorded profit: ${money(profit)}.`
    };
  }

  if (
    RX.expense.test(text) &&
    (
      RX.today.test(text) ||
      /total|kitna|how much|amount/i.test(text)
    )
  ) {
    let rows =
      expenses();

    if (RX.today.test(text)) {
      const today =
        todayDate();

      rows =
        rows.filter(
          e =>
            dateMatches(
              e.date,
              today
            )
        );
    }

    const total =
      rows.reduce(
        (sum, e) =>
          sum +
          Number(e.amount || 0),
        0
      );

    return {
      kind: 'answer',
      text:
        `Total expenses: ${money(total)}.`
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* MAIN COMMAND PARSER                                                        */
/* -------------------------------------------------------------------------- */

export function parseCommand(input) {
  const original =
    String(input || '').trim();

  const text =
    norm(original);

  if (!text) {
    return null;
  }

  const allProducts =
    products();

  const allCustomers =
    customers();

  const allSuppliers =
    suppliers();

  clearOldContext();

  const info =
    parseInformationCommand(original);

  if (info) {
    return info;
  }

  let productResult =
    resolveEntity(
      allProducts,
      text,
      'product'
    );

  let customerResult =
    resolveEntity(
      allCustomers,
      text,
      'customer'
    );

  let supplierResult =
    resolveEntity(
      allSuppliers,
      text,
      'supplier'
    );

  const hasProductVerb =
    rx(
      WORDS.addStock
        .concat(WORDS.removeStock)
        .concat(WORDS.sale)
    ).test(text);

  if (
    !productResult.found &&
    hasProductVerb &&
    contextProduct()
  ) {
    const product =
      contextProduct();

    productResult = {
      found: true,
      ambiguous: false,
      item: product,
      matches: [product]
    };
  }

  if (
    !customerResult.found &&
    (
      rx(
        WORDS.receiveCustomer
          .concat(WORDS.giveCustomer)
      ).test(text) ||
      /(?:same customer|this customer|that customer|usi customer|is customer|اس گاہک|اسی گاہک)/i.test(text)
    ) &&
    contextCustomer()
  ) {
    const customer =
      contextCustomer();

    customerResult = {
      found: true,
      ambiguous: false,
      item: customer,
      matches: [customer]
    };
  }

  if (
    !supplierResult.found &&
    rx(
      WORDS.supplierPayment
        .concat(WORDS.supplierDebt)
    ).test(text) &&
    contextSupplier()
  ) {
    const supplier =
      contextSupplier();

    supplierResult = {
      found: true,
      ambiguous: false,
      item: supplier,
      matches: [supplier]
    };
  }

  if (
    productResult.ambiguous &&
    (
      hasProductVerb ||
      RX.stock.test(text)
    )
  ) {
    return {
      kind: 'clarification',
      text:
        productResult.question
    };
  }

  if (
    customerResult.ambiguous &&
    (
      RX.balance.test(text) ||
      rx(
        WORDS.receiveCustomer
          .concat(WORDS.giveCustomer)
      ).test(text)
    )
  ) {
    return {
      kind: 'clarification',
      text:
        customerResult.question
    };
  }

  if (
    supplierResult.ambiguous &&
    rx(
      WORDS.supplierPayment
        .concat(WORDS.supplierDebt)
    ).test(text)
  ) {
    return {
      kind: 'clarification',
      text:
        supplierResult.question
    };
  }

  /* ------------------------------------------------------------------------ */
  /* MULTI-ITEM STOCK ADD                                                     */
  /* ------------------------------------------------------------------------ */

  const isStockIntent =
    (
      rx(WORDS.addStock).test(text) &&
      (
        RX.stock.test(text) ||
        /(?:keemat|qeemat|price|rate|قیمت)/i.test(text)
      )
    ) ||
    (
      RX.stock.test(text) &&
      /(?:add|dalo|daal|shamil|شامل)/i.test(text)
    );

  if (isStockIntent) {
    let cleanBody =
      text
        .replace(
          rx(WORDS.addStock),
          ' '
        )
        .replace(
          RX.stock,
          ' '
        )
        .replace(
          /\s+/g,
          ' '
        )
        .trim();

    const stockItems =
      parseMultiStockItems(
        cleanBody,
        allProducts
      );

    if (stockItems.length > 0) {
      const summaryItems =
        stockItems.map(item => {
          const pDesc =
            item.product
              ? `${item.product.name} ` +
                `(current stock ${Number(item.product.stock) || 0})`
              : `${item.name} (new product)`;

          return (
            `• ${item.qty} × ${pDesc} ` +
            `at ${money(item.price)}`
          );
        });

      return {
        kind: 'confirm',

        action: {
          type: 'addStockBatch',

          items: stockItems,

          summary:
            `Add stock for ${stockItems.length} ` +
            `product${stockItems.length > 1 ? 's' : ''}?\n` +
            summaryItems.join('\n')
        }
      };
    }
  }

  /* ------------------------------------------------------------------------ */
  /* MULTI-ITEM SALE                                                          */
  /* ------------------------------------------------------------------------ */

  const isSaleIntent =
    rx(WORDS.sale).test(text) &&
    !rx(WORDS.addStock).test(text);

  if (isSaleIntent) {
    const isWholesale =
      rx(WORDS.wholesale).test(text);

    const saleType =
      isWholesale
        ? 'wholesale'
        : 'retail';

    let cleanBody =
      text
        .replace(
          rx(WORDS.sale),
          ' '
        )
        .replace(
          rx(WORDS.wholesale),
          ' '
        )
        .replace(
          /\s+/g,
          ' '
        )
        .trim();

    const saleItems =
      parseMultiSaleItems(
        cleanBody,
        allProducts
      );

    if (saleItems.length > 0) {
      for (const item of saleItems) {
        if (!item.product) {
          return {
            kind: 'answer',
            text:
              `I couldn't find the product ` +
              `"${item.name}" in your inventory.`
          };
        }
      }

      let totalAmount = 0;
      const lines = [];

      for (const item of saleItems) {
        const prod =
          item.product;

        const available =
          Number(prod.stock) || 0;

        if (item.qty > available) {
          return {
            kind: 'answer',
            text:
              `Not enough stock for ${prod.name}. ` +
              `Available: ${available}, ` +
              `requested: ${item.qty}.`
          };
        }

        const normalPrice =
          saleType === 'wholesale'
            ? Number(
                prod.wholesalePrice ??
                prod.price ??
                0
              )
            : Number(
                prod.retailPrice ??
                prod.price ??
                0
              );

        const unit =
          item.unitPrice !== undefined
            ? Number(item.unitPrice)
            : normalPrice;

        if (
          !Number.isFinite(unit) ||
          unit < 0
        ) {
          return {
            kind: 'answer',
            text:
              `Invalid selling price for ${prod.name}.`
          };
        }

        const lineTotal =
          unit * item.qty;

        totalAmount += lineTotal;

        lines.push(
          `• ${item.qty} × ${prod.name} ` +
          `at ${money(unit)} each ` +
          `= ${money(lineTotal)}`
        );
      }

      const customer =
        customerResult.found
          ? customerResult.item
          : null;

      rememberContext({
        customer:
          customer || undefined
      });

      return {
        kind: 'confirm',

        action: {
          type: 'sellProductBatch',

          items: saleItems,

          customer,

          saleType,

          summary:
            `Confirm ${saleType} sale:\n` +
            lines.join('\n') +
            `\nTotal: ${money(totalAmount)}` +
            (
              customer
                ? ` (Customer: ${customer.name})`
                : ' (Walk-in)'
            )
        }
      };
    }
  }

  /* ------------------------------------------------------------------------ */
  /* SINGLE STOCK REMOVE                                                      */
  /* ------------------------------------------------------------------------ */

  if (
    productResult.found &&
    rx(WORDS.removeStock).test(text) &&
    (
      RX.stock.test(text) ||
      RX.quantity.test(text)
    )
  ) {
    const product =
      productResult.item;

    const qty =
      qtyFrom(text);

    if (
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      return {
        kind: 'clarification',
        text:
          `How many ${product.name} should I remove?`
      };
    }

    rememberContext({
      product
    });

    return {
      kind: 'confirm',

      action: {
        type: 'removeStock',

        product,

        qty,

        summary:
          `Remove ${qty} from ${product.name} stock? ` +
          `Current stock: ${Number(product.stock) || 0}.`
      }
    };
  }

  /* ------------------------------------------------------------------------ */
  /* CUSTOMER PAYMENT                                                         */
  /* ------------------------------------------------------------------------ */

  const receiveWords =
    rx(WORDS.receiveCustomer);

  const giveWords =
    rx(WORDS.giveCustomer);

  const isCreditPhrase =
    /(?:udhaar|udhar|qarz|ادھار|قرض)/i.test(text);

  if (
    customerResult.found &&
    receiveWords.test(text) &&
    !isCreditPhrase
  ) {
    const amount =
      amountFrom(text);

    if (!Number.isFinite(amount)) {
      return {
        kind: 'clarification',
        text:
          `How much should I receive from ${customerResult.item.name}?`
      };
    }

    const current =
      Math.max(
        0,
        Number(
          customerResult.item.balance
        ) || 0
      );

    if (amount > current) {
      return {
        kind: 'answer',
        text:
          `${customerResult.item.name}'s current due is ` +
          `${money(current)}. ` +
          `The requested payment of ${money(amount)} ` +
          `is greater than the due.`
      };
    }

    rememberContext({
      customer:
        customerResult.item
    });

    return {
      kind: 'confirm',

      action: {
        type: 'receiveCustomer',

        customer:
          customerResult.item,

        amount,

        summary:
          `Receive ${money(amount)} from ` +
          `${customerResult.item.name}? ` +
          `Current due: ${money(current)}.`
      }
    };
  }

  /* ------------------------------------------------------------------------ */
  /* CUSTOMER CREDIT / DEBT                                                   */
  /* ------------------------------------------------------------------------ */

  if (
    customerResult.found &&
    giveWords.test(text)
  ) {
    const amount =
      amountFrom(text);

    if (!Number.isFinite(amount)) {
      return {
        kind: 'clarification',
        text:
          `How much credit should I add to ${customerResult.item.name}?`
      };
    }

    const current =
      Math.max(
        0,
        Number(
          customerResult.item.balance
        ) || 0
      );

    rememberContext({
      customer:
        customerResult.item
    });

    return {
      kind: 'confirm',

      action: {
        type: 'giveCustomer',

        customer:
          customerResult.item,

        amount,

        summary:
          `Add ${money(amount)} to ` +
          `${customerResult.item.name}'s due? ` +
          `Current due: ${money(current)}.`
      }
    };
  }

  /* ------------------------------------------------------------------------ */
  /* SUPPLIER PAYMENT                                                         */
  /* ------------------------------------------------------------------------ */

  if (
    supplierResult.found &&
    rx(WORDS.supplierPayment).test(text)
  ) {
    const amount =
      amountFrom(text);

    if (!Number.isFinite(amount)) {
      return {
        kind: 'clarification',
        text:
          `How much should I pay ${supplierResult.item.name}?`
      };
    }

    const current =
      Math.max(
        0,
        Number(
          supplierResult.item.balance
        ) || 0
      );

    if (amount > current) {
      return {
        kind: 'answer',
        text:
          `${supplierResult.item.name}'s current payable is ` +
          `${money(current)}. ` +
          `The requested payment is ${money(amount)}.`
      };
    }

    rememberContext({
      supplier:
        supplierResult.item
    });

    return {
      kind: 'confirm',

      action: {
        type: 'supplierPayment',

        supplier:
          supplierResult.item,

        amount,

        summary:
          `Pay ${money(amount)} to ` +
          `${supplierResult.item.name}? ` +
          `Current payable: ${money(current)}.`
      }
    };
  }

  /* ------------------------------------------------------------------------ */
  /* SUPPLIER DEBT                                                            */
  /* ------------------------------------------------------------------------ */

  if (
    supplierResult.found &&
    rx(WORDS.supplierDebt).test(text)
  ) {
    const amount =
      amountFrom(text);

    if (!Number.isFinite(amount)) {
      return {
        kind: 'clarification',
        text:
          `How much payable should I add for ${supplierResult.item.name}?`
      };
    }

    const current =
      Math.max(
        0,
        Number(
          supplierResult.item.balance
        ) || 0
      );

    rememberContext({
      supplier:
        supplierResult.item
    });

    return {
      kind: 'confirm',

      action: {
        type: 'supplierDebt',

        supplier:
          supplierResult.item,

        amount,

        summary:
          `Add ${money(amount)} payable to ` +
          `${supplierResult.item.name}? ` +
          `Current payable: ${money(current)}.`
      }
    };
  }

  /* ------------------------------------------------------------------------ */
  /* EXPENSE                                                                  */
  /* ------------------------------------------------------------------------ */

  if (
    rx(WORDS.expense).test(text)
  ) {
    const amount =
      amountFrom(text);

    if (!Number.isFinite(amount)) {
      return {
        kind: 'clarification',
        text:
          'How much is the expense?'
      };
    }

    return {
      kind: 'confirm',

      action: {
        type: 'expense',

        amount,

        category:
          'AI expense',

        note:
          original,

        summary:
          `Record an expense of ${money(amount)}?`
      }
    };
  }

  /* ------------------------------------------------------------------------ */
  /* CREATE CUSTOMER                                                          */
  /* ------------------------------------------------------------------------ */

  if (
    rx(WORDS.addCustomer).test(text) &&
    RX.customer.test(text)
  ) {
    let name =
      text
        .replace(
          /.*?(?:customer|cust|گاہک)\s*/i,
          ''
        )
        .replace(
          /^(?:named|name|called|ka naam|کا نام|نام)\s*/i,
          ''
        )
        .replace(
          /(?:phone|number|فون|نمبر).*$/i,
          ''
        )
        .replace(
          /\b(?:banao|banayen|create|add|please)\b.*$/i,
          ''
        )
        .trim();

    if (!name) {
      return {
        kind: 'clarification',
        text:
          'What is the customer name?'
      };
    }

    const duplicate =
      allCustomers.find(
        c =>
          norm(c.name) ===
          norm(name)
      );

    if (duplicate) {
      return {
        kind: 'answer',
        text:
          `Customer "${duplicate.name}" already exists.`
      };
    }

    return {
      kind: 'confirm',

      action: {
        type: 'addCustomer',

        name,

        summary:
          `Create customer "${name}"?`
      }
    };
  }

  /* ------------------------------------------------------------------------ */
  /* CREATE PRODUCT EXPLICITLY                                                */
  /* ------------------------------------------------------------------------ */

  if (
    rx(WORDS.addProduct).test(text) &&
    /(?:product|item|پروڈکٹ|آئٹم)/i.test(text)
  ) {
    return {
      kind: 'clarification',
      text:
        'Please provide the product name and its price before I create it.'
    };
  }

  /* ------------------------------------------------------------------------ */
  /* FOLLOW-UPS                                                               */
  /* ------------------------------------------------------------------------ */

  const context =
    getContext();

  if (
    context.customer &&
    /^(?:receive it|receive|collect it|liya|le liya|وصول کرلو)$/i.test(text)
  ) {
    return {
      kind: 'clarification',
      text:
        `How much should I receive from ${context.customer.name}?`
    };
  }

  if (
    context.product &&
    /^(?:add more|add aur|aur add karo|aur daal do|مزید شامل کرو)$/i.test(text)
  ) {
    return {
      kind: 'clarification',
      text:
        `How many more ${context.product.name} should I add?`
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* MULTI-ACTION COMMAND DETECTION                                             */
/* -------------------------------------------------------------------------- */

export function splitMultiCommand(input) {
  const text =
    String(input || '').trim();

  if (!text) {
    return [];
  }

  /*
   * Do not split ordinary multi-product commands.
   *
   * Those are handled by parseMultiStockItems() and
   * parseMultiSaleItems().
   */
  const parts =
    text
      .split(
        /\s+(?:and|aur|phir|then|اور|پھر)\s+/i
      )
      .map(x => x.trim())
      .filter(Boolean);

  return parts.length > 1
    ? parts
    : [];
}

/* -------------------------------------------------------------------------- */
/* PUBLIC AGENT HANDLER                                                       */
/* -------------------------------------------------------------------------- */

export async function handleAgentCommand(input) {
  const text =
    String(input || '').trim();

  if (!text) {
    return {
      handled: true,
      text:
        'Please enter a command.'
    };
  }

  clearOldContext();

  /* ---------------------------------------------------------------------- */
  /* PENDING CONFIRMATION                                                     */
  /* ---------------------------------------------------------------------- */

  if (window.__myBusinessAiPending) {
    const pending =
      window.__myBusinessAiPending;

    if (isYes(text)) {
      window.__myBusinessAiPending = null;

      try {
        const result =
          await execute(pending);

        return {
          handled: true,
          text: result
        };
      } catch (error) {
        return {
          handled: true,
          text:
            `I could not complete that task: ` +
            `${error?.message || error}`
        };
      }
    }

    if (isNo(text)) {
      window.__myBusinessAiPending = null;

      return {
        handled: true,
        text:
          'Cancelled. No changes were made.'
      };
    }

    return {
      handled: true,
      text:
        'Please reply "yes" to confirm or "no" to cancel.'
    };
  }

  /* ---------------------------------------------------------------------- */
  /* NORMAL PARSING                                                          */
  /* ---------------------------------------------------------------------- */

  const parsed =
    parseCommand(text);

  if (
    parsed?.kind === 'answer'
  ) {
    return {
      handled: true,
      text: parsed.text
    };
  }

  if (
    parsed?.kind === 'clarification'
  ) {
    return {
      handled: true,
      text: parsed.text
    };
  }

  if (
    parsed?.kind === 'confirm'
  ) {
    return {
      handled: true,
      confirmation: true,
      text:
        confirmationText(
          parsed.action
        )
    };
  }

  /* ---------------------------------------------------------------------- */
  /* MULTI-ACTION COMMANDS                                                   */
  /* ---------------------------------------------------------------------- */

  const multi =
    splitMultiCommand(text);

  if (multi.length > 1) {
    const parsedParts =
      multi.map(
        part =>
          parseCommand(part)
      );

    const unsupported =
      parsedParts.some(
        part =>
          !part ||
          ![
            'answer',
            'confirm',
            'clarification'
          ].includes(part.kind)
      );

    if (!unsupported) {
      const clarifications =
        parsedParts.filter(
          p =>
            p.kind === 'clarification'
        );

      if (clarifications.length) {
        return {
          handled: true,
          text:
            clarifications
              .map(x => x.text)
              .join('\n')
        };
      }

      const answers =
        parsedParts.filter(
          p =>
            p.kind === 'answer'
        );

      if (
        answers.length ===
        parsedParts.length
      ) {
        return {
          handled: true,
          text:
            answers
              .map(x => x.text)
              .join('\n')
        };
      }

      const actions =
        parsedParts
          .filter(
            p =>
              p.kind === 'confirm'
          )
          .map(
            p =>
              p.action
          );

      if (actions.length) {
        return {
          handled: true,
          text:
            'I understood multiple actions, but I need to process them one at a time to keep the business data safe.'
        };
      }
    }
  }

  return {
    handled: false
  };
}

/* -------------------------------------------------------------------------- */
/* AGENT CONTEXT & DEBUG                                                      */
/* -------------------------------------------------------------------------- */

export function agentContext() {
  const data =
    window.data || {};

  const context =
    getContext();

  return [
    'MyBusiness local agent context:',

    `Products: ${
      data.products?.length || 0
    }`,

    `Customers: ${
      data.customers?.length || 0
    }`,

    `Suppliers: ${
      data.suppliers?.length || 0
    }`,

    `Sales: ${
      data.sales?.length || 0
    }`,

    `Expenses: ${
      data.expenses?.length || 0
    }`,

    `Product names: ${
      names(
        data.products || [],
        20
      ) || 'none'
    }`,

    `Customer names: ${
      names(
        data.customers || [],
        20
      ) || 'none'
    }`,

    `Supplier names: ${
      names(
        data.suppliers || [],
        20
      ) || 'none'
    }`,

    context.product
      ? `Current product context: ${context.product.name}`
      : '',

    context.customer
      ? `Current customer context: ${context.customer.name}`
      : '',

    context.supplier
      ? `Current supplier context: ${context.supplier.name}`
      : '',

    `Language: ${
      typeof document !== 'undefined'
        ? (
            document.documentElement.lang ||
            'en'
          )
        : 'en'
    }`,

    'Registered actions:',

    Object.keys(ACTIONS).join(', '),

    'Multi-item stock: supported.',

    'Multi-item sales: supported.',

    'Safety: Deterministic execution only.'
  ]
    .filter(Boolean)
    .join('\n');
}

/* -------------------------------------------------------------------------- */
/* AGENT STATE                                                                */
/* -------------------------------------------------------------------------- */

export function getAgentState() {
  const context =
    getContext();

  return {
    pending:
      Boolean(
        window.__myBusinessAiPending
      ),

    pendingAction:
      window.__myBusinessAiPending
        ? {
            type:
              window.__myBusinessAiPending.type
          }
        : null,

    context: {
      product:
        context.product?.name ||
        null,

      customer:
        context.customer?.name ||
        null,

      supplier:
        context.supplier?.name ||
        null,

      lastAction:
        context.lastAction?.type ||
        null
    }
  };
}