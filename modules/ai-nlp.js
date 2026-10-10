/*
 * MyBusiness shop-command language layer.
 *
 * PURE text understanding: no Firebase, no DOM, no window access, no eval.
 * It turns English / Roman Urdu / Urdu-script shop commands into a small,
 * plain-data "intent" object. ai-agent.js then validates that intent against
 * the real products/customers and only performs registered, validated actions
 * after the user confirms. Nothing produced here is ever executed as code.
 */

/* -------------------------------------------------------------------------- */
/* TOKEN CLEAN-UP                                                             */
/* -------------------------------------------------------------------------- */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

function toAsciiDigits(s) {
  return String(s).replace(/[٠-٩۰-۹]/g, ch => {
    const a = ARABIC_INDIC.indexOf(ch);
    if (a >= 0) return String(a);
    const p = PERSIAN.indexOf(ch);
    return p >= 0 ? String(p) : ch;
  });
}

function cleanBase(raw) {
  let s = String(raw || '').normalize('NFKC').toLowerCase();
  s = toAsciiDigits(s);
  s = s.replace(/٫/g, '.');
  // 1,000 / 1٬000 -> 1000
  s = s.replace(/(\d)[,٬](?=\d{3}(?!\d))/g, '$1');
  s = s.replace(/[؟?!،؛;:()"“”‘’`~|\\/]/g, ' ');
  s = s.replace(/,/g, ' ');
  // keep '.' only inside numbers
  s = s.replace(/(?<!\d)\.|\.(?!\d)/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

const rxWords = list => new Set(list);

const TOKEN_MAP = new Map();
function mapWords(canonical, list) {
  for (const w of list) TOKEN_MAP.set(w, canonical);
}

mapWords('keemat', ['keemat', 'qeemat', 'kemat', 'kimat', 'qimat', 'kimmat', 'keemt', 'qeemt', 'qeematt',
  'keemet', 'price', 'rate', 'قیمت', 'کیمت', 'ریٹ', 'قمیت']);
mapWords('stock', ['stock', 'stok', 'stoke', 'sock', 'inventory', 'اسٹاک', 'سٹاک', 'اسٹوک', 'ذخیرہ']);
mapWords('mein', ['mein', 'main', 'me', 'ma', 'may', 'mai', 'mn', 'men', 'mei', 'میں']);
mapWords('add', ['add', 'ad', 'jama', 'daal', 'dal', 'dalo', 'daalo', 'barhao', 'barha', 'barhado',
  'restock', 'shamil', 'شامل', 'جمع', 'بڑھاؤ', 'ڈالو', 'ڈال']);
mapWords('karo', ['karo', 'kro', 'kar', 'kr', 'ker', 'kardo', 'krdo', 'kerdo', 'karen', 'kren', 'kijiye',
  'kijye', 'set', 'update', 'کرو', 'کریں', 'کر', 'کرنا', 'کیجیے', 'کردو']);
mapWords('sale', ['sale', 'sell', 'sel', 'sal', 'bech', 'becho', 'bechdo', 'bikri', 'farokht', 'sold',
  'فروخت', 'بیچو', 'بیچ', 'سیل']);
mapWords('wasool', ['wasool', 'vasool', 'wasol', 'vasol', 'wasooli', 'vasooli', 'wasuli', 'vasuli',
  'wusool', 'wasul', 'vasul', 'وصول', 'وصولی']);
mapWords('khata', ['khata', 'khaata', 'khatta', 'khatah', 'ledger', 'hisab', 'hisaab', 'statement',
  'کھاتہ', 'کھاتا', 'حساب']);
mapWords('dikhao', ['dikhao', 'dikha', 'dikhado', 'dikhaiye', 'dikhaen', 'batao', 'bata', 'batado', 'show',
  'dekho', 'dekhao', 'dikhaye', 'display', 'دکھاؤ', 'دکھاو', 'بتاؤ', 'بتاو', 'دکھائیں', 'دیکھو']);
mapWords('naya', ['naya', 'nayi', 'naye', 'new', 'نیا', 'نئی', 'نئے']);
mapWords('product', ['product', 'products', 'prod', 'item', 'maal', 'پروڈکٹ', 'آئٹم', 'مال']);
mapWords('customer', ['customer', 'customers', 'grahak', 'gahak', 'cust', 'کسٹمر', 'گاہک']);
mapWords('phone', ['phone', 'mobile', 'cell', 'contact', 'nambar', 'number', 'فون', 'موبائل', 'نمبر']);
mapWords('address', ['address', 'addres', 'pata', 'ایڈریس', 'پتہ', 'پتا']);
mapWords('ka', ['ka', 'ki', 'ke', 'کا', 'کی', 'کے']);
mapWords('se', ['se', 'say', 'sy', 'سے']);
mapWords('ko', ['ko', 'کو']);
mapWords('aur', ['aur', 'and', 'or', 'اور', '+']);

// Roman-Urdu / Urdu-script number words (0..99 plus multipliers).
const SMALL = new Map();
function nums(value, list) { for (const w of list) SMALL.set(w, value); }
nums(0, ['zero', 'sifar', 'صفر']);
nums(1, ['ek', 'aik', 'one', 'ایک']);
nums(2, ['do', 'two', 'دو']);
nums(3, ['teen', 'three', 'تین']);
nums(4, ['char', 'chaar', 'four', 'چار']);
nums(5, ['panch', 'paanch', 'five', 'پانچ']);
nums(6, ['chay', 'chhe', 'chhay', 'chey', 'six', 'چھ', 'چھے']);
nums(7, ['saat', 'seven', 'سات']);
nums(8, ['aath', 'eight', 'آٹھ']);
nums(9, ['nau', 'nine', 'نو']);
nums(10, ['das', 'ten', 'دس']);
nums(11, ['gyarah', 'gyara', 'giyarah', 'گیارہ']);
nums(12, ['barah', 'baarah', 'بارہ']);
nums(13, ['terah', 'tera', 'تیرہ']);
nums(14, ['chaudah', 'chaudha', 'چودہ']);
nums(15, ['pandrah', 'pandra', 'پندرہ']);
nums(16, ['solah', 'sola', 'سولہ']);
nums(17, ['satrah', 'satra', 'سترہ']);
nums(18, ['atharah', 'athara', 'اٹھارہ']);
nums(19, ['unnees', 'unees', 'unnis', 'انیس']);
nums(20, ['bees', 'twenty', 'بیس']);
nums(21, ['ikkees', 'اکیس']); nums(22, ['baees', 'بائیس']); nums(23, ['teyees', 'teis', 'تئیس']);
nums(24, ['chaubees', 'چوبیس']); nums(25, ['pachees', 'پچیس']); nums(26, ['chhabbees', 'چھبیس']);
nums(27, ['sattaees', 'ستائیس']); nums(28, ['attaees', 'اٹھائیس']); nums(29, ['untees', 'انتیس']);
nums(30, ['tees', 'thirty', 'تیس']); nums(31, ['ikattees', 'اکتیس']); nums(32, ['battees', 'بتیس']);
nums(33, ['taintees', 'تینتیس']); nums(34, ['chauntees', 'چونتیس']); nums(35, ['paintees', 'پینتیس']);
nums(36, ['chhattees', 'چھتیس']); nums(37, ['saintees', 'سینتیس']); nums(38, ['artees', 'اڑتیس']);
nums(39, ['untalees', 'انتالیس']); nums(40, ['chalees', 'forty', 'چالیس']);
nums(41, ['iktalees', 'اکتالیس']); nums(42, ['bayalees', 'بیالیس']); nums(43, ['taintalees', 'تینتالیس']);
nums(44, ['chauwalees', 'چوالیس']); nums(45, ['paintalees', 'پینتالیس']); nums(46, ['chhialees', 'چھیالیس']);
nums(47, ['saintalees', 'سینتالیس']); nums(48, ['artalees', 'اڑتالیس']); nums(49, ['unchaas', 'انچاس']);
nums(50, ['pachas', 'pachaas', 'fifty', 'پچاس']); nums(51, ['ikyawan', 'اکیاون']); nums(52, ['bawan', 'باون']);
nums(53, ['tirpan', 'ترپن']); nums(54, ['chauwan', 'چون']); nums(55, ['pachpan', 'پچپن']);
nums(56, ['chhappan', 'چھپن']); nums(57, ['sattawan', 'ستاون']); nums(58, ['atthawan', 'اٹھاون']);
nums(59, ['unsath', 'انسٹھ']); nums(60, ['saath', 'saath', 'sixty', 'ساٹھ']); nums(61, ['iksath', 'اکسٹھ']);
nums(62, ['basath', 'باسٹھ']); nums(63, ['tirsath', 'ترسٹھ']); nums(64, ['chausath', 'چوسٹھ']);
nums(65, ['painsath', 'پینسٹھ']); nums(66, ['chhiyasath', 'چھیاسٹھ']); nums(67, ['sarsath', 'سڑسٹھ']);
nums(68, ['arsath', 'اڑسٹھ']); nums(69, ['unhattar', 'انہتر']); nums(70, ['sattar', 'seventy', 'ستر']);
nums(71, ['ikhattar', 'اکہتر']); nums(72, ['bahattar', 'بہتر']); nums(73, ['tihattar', 'تہتر']);
nums(74, ['chauhattar', 'چوہتر']); nums(75, ['pachhattar', 'پچھتر']); nums(76, ['chhihattar', 'چھہتر']);
nums(77, ['satattar', 'ستتر']); nums(78, ['athattar', 'اٹھہتر']); nums(79, ['unasi', 'اناسی']);
nums(80, ['assi', 'eighty', 'اسی']); nums(81, ['ikyasi', 'اکیاسی']); nums(82, ['bayasi', 'بیاسی']);
nums(83, ['tirasi', 'تراسی']); nums(84, ['chaurasi', 'چوراسی']); nums(85, ['pachasi', 'پچاسی']);
nums(86, ['chhiyasi', 'چھیاسی']); nums(87, ['sattasi', 'ستاسی']); nums(88, ['atthasi', 'اٹھاسی']);
nums(89, ['navasi', 'نواسی']); nums(90, ['nabbe', 'nabbay', 'ninety', 'نوے']); nums(91, ['ikyanve', 'اکیانوے']);
nums(92, ['banve', 'بانوے']); nums(93, ['tiranve', 'ترانوے']); nums(94, ['chauranve', 'چورانوے']);
nums(95, ['pachanve', 'پچانوے']); nums(96, ['chhiyanve', 'چھیانوے']); nums(97, ['sattanve', 'ستانوے']);
nums(98, ['atthanve', 'اٹھانوے']); nums(99, ['ninyanve', 'ninanve', 'نناوے']);

const MULT = new Map([
  ['sau', 100], ['hundred', 100], ['سو', 100],
  ['hazar', 1000], ['hazaar', 1000], ['hajar', 1000], ['thousand', 1000], ['ہزار', 1000],
  ['lakh', 100000], ['lac', 100000], ['لاکھ', 100000]
]);
// Fractions that only make sense before sau/hazar: "dhai sau" = 250
const FRACTION = new Map([['dhai', 2.5], ['dedh', 1.5], ['derh', 1.5], ['sawa', 1.25], ['ڈھائی', 2.5], ['ڈیڑھ', 1.5], ['سوا', 1.25]]);

// "do" is also the verb in "kar do / de do / bech do". It is a number only
// when it is not directly after one of these.
const DO_VERB_PREV = new Set(['kar', 'kr', 'ker', 'karo', 'kro', 'de', 'dey', 'bech', 'dal', 'daal', 'le', 'lay', 'ley',
  'add', 'sale', 'wasool', 'kardo', 'krdo']);

const isDigits = t => /^\d+(?:\.\d+)?$/.test(t);

/* -------------------------------------------------------------------------- */
/* TOKENISE + CANONICALISE                                                    */
/* -------------------------------------------------------------------------- */

function mapTokens(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const n = tokens[i + 1];
    // "kar do", "kar den", "bech do", "dal do", "daal do"
    if (n && ['do', 'den', 'dein', 'dijiye', 'دو', 'دیں'].includes(n)) {
      if (['kar', 'kr', 'ker', 'کر'].includes(t)) { out.push('karo'); i++; continue; }
      if (['bech', 'بیچ'].includes(t)) { out.push('sale', 'karo'); i++; continue; }
      if (['dal', 'daal', 'ڈال'].includes(t)) { out.push('add'); i++; continue; }
    }
    out.push(TOKEN_MAP.has(t) ? TOKEN_MAP.get(t) : t);
  }
  // collapse "karo karo"
  return out.filter((t, i) => !(t === 'karo' && out[i - 1] === 'karo'));
}

/**
 * Convert runs of number words/digits to digits. "teen sau" -> "300",
 * "do hazar paanch sau" -> "2500", "5 hazar" -> "5000".
 * `protect` is a Set of lowercase tokens belonging to real product/customer
 * names; those are never turned into numbers.
 */
export function numberWordsToDigits(tokens, protect = new Set()) {
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    const startsNumber = isDigits(t) || SMALL.has(t) || MULT.has(t) || FRACTION.has(t);
    if (!startsNumber) { out.push(t); i++; continue; }
    if (!isDigits(t) && protect.has(t)) { out.push(t); i++; continue; }
    if (t === 'do' && DO_VERB_PREV.has(out[out.length - 1])) { out.push(t); i++; continue; }

    let total = 0, cur = 0, j = i, last = null, used = 0, sawWord = false;
    while (j < tokens.length) {
      const w = tokens[j];
      if (j > i && !isDigits(w) && protect.has(w)) break;
      if (isDigits(w)) {
        if (j !== i) break;                    // a digit only starts a run ("5 hazar")
        cur = Number(w); last = 'small';
      } else if (FRACTION.has(w)) {
        if (last !== null) break;
        const nx = tokens[j + 1];
        if (!MULT.has(nx)) break;
        cur = FRACTION.get(w); last = 'fraction'; sawWord = true;
      } else if (SMALL.has(w)) {
        if (last === 'small' || last === 'fraction') break;
        cur += SMALL.get(w); last = 'small'; sawWord = true;
      } else if (MULT.has(w)) {
        const m = MULT.get(w);
        if (m === 100) {
          if (cur >= 100 || last === 'sau') break;
          cur = (cur || 1) * 100; last = 'sau';
        } else {
          if (last === 'hazar' || last === 'lakh') break;
          total += (cur || 1) * m; cur = 0; last = m === 1000 ? 'hazar' : 'lakh';
        }
        sawWord = true;
      } else break;
      used++; j++;
    }
    if (!used) { out.push(t); i++; continue; }
    // A lone digit token is left exactly as typed (keeps "0300", "1.5").
    if (used === 1 && !sawWord) { out.push(t); i++; continue; }
    out.push(String(total + cur));
    i = j;
  }
  return out;
}

/** Full canonical token list used by the shop parser. */
export function canonicalTokens(raw, protect = new Set()) {
  const base = cleanBase(raw);
  if (!base) return [];
  return numberWordsToDigits(mapTokens(base.split(' ')), protect);
}

/**
 * Light rewrite handed to the original (legacy) parser: only spelling
 * variants of "wasool" and number words are changed, nothing else.
 */
export function legacyText(raw, protect = new Set()) {
  const base = cleanBase(raw);
  if (!base) return String(raw || '');
  const toks = base.split(' ').map(t => (TOKEN_MAP.get(t) === 'wasool' ? 'wasool' : t));
  // keep "kar do" untouched for the legacy parser, but guard "do" as a number
  return numberWordsToDigits(toks, protect).join(' ');
}

/* -------------------------------------------------------------------------- */
/* ITEM PARSING  (qty / name / price)                                         */
/* -------------------------------------------------------------------------- */

const STRIP = new Set(['stock', 'mein', 'add', 'karo', 'sale', 'please', 'plz', 'pls', 'ji', 'jaldi', 'phir', 'then']);
const PRICE_FILL = new Set(['ka', 'rs', 'rs.', 'rupay', 'rupaye', 'rupee', 'rupees', 'each', 'per', 'piece', 'pcs', 'pc', 'x']);
const SEPARATORS = new Set(['aur', 'phir', 'then']);

const isNum = t => t !== undefined && isDigits(t);

/**
 * @returns {{items:Array<{name:string,qty:number|null,price:number|null}>, error?:string}}
 */
export function parseItems(tokensIn) {
  const tokens = tokensIn.filter(t => !STRIP.has(t) || t === 'phir');
  const items = [];
  const n = tokens.length;
  if (!n) return { items };
  const leadingQty = isNum(tokens[0]);
  let i = 0;

  const skipSeparators = () => { while (i < n && (SEPARATORS.has(tokens[i]) || tokens[i] === ',')) i++; };
  const readName = () => {
    const parts = [];
    while (i < n && !isNum(tokens[i]) && !SEPARATORS.has(tokens[i]) && tokens[i] !== 'keemat' &&
           !(PRICE_FILL.has(tokens[i]) && !parts.length)) {
      if (tokens[i] === 'ka' || tokens[i] === 'ko') { break; }
      parts.push(tokens[i++]);
    }
    return parts.join(' ').trim();
  };
  const skipFill = () => { while (i < n && PRICE_FILL.has(tokens[i])) i++; };

  skipSeparators();
  while (i < n) {
    let qty = null, price = null;
    if (leadingQty) {
      if (!isNum(tokens[i])) return { items, error: `Quantity missing near "${tokens.slice(i).join(' ')}".` };
      qty = Number(tokens[i++]);
      const name = readName();
      if (!name) return { items, error: `Product name missing after quantity ${qty}.` };
      if (tokens[i] === 'keemat') {
        while (tokens[i] === 'keemat') i++;
        if (!isNum(tokens[i])) return { items, error: `Price missing for ${name}.` };
        price = Number(tokens[i++]);
      } else if (isNum(tokens[i])) {
        const nx = tokens[i + 1];
        const nextIsNewItemQty = nx !== undefined && !isNum(nx) && !PRICE_FILL.has(nx) && !SEPARATORS.has(nx);
        if (!nextIsNewItemQty) price = Number(tokens[i++]);
      }
      skipFill();
      items.push({ name, qty, price });
    } else {
      const name = readName();
      if (!name) return { items, error: `I could not read the product name near "${tokens.slice(i).join(' ')}".` };
      if (tokens[i] === 'keemat') {
        while (tokens[i] === 'keemat') i++;
        if (!isNum(tokens[i])) return { items, error: `Price missing for ${name}.` };
        price = Number(tokens[i++]);
      } else if (isNum(tokens[i])) {
        const num = Number(tokens[i]);
        if (PRICE_FILL.has(tokens[i + 1]) && tokens[i + 1] !== 'x') { price = num; i++; }
        else {
          qty = num; i++;
          if (tokens[i] === 'keemat') {
            while (tokens[i] === 'keemat') i++;
            if (!isNum(tokens[i])) return { items, error: `Price missing for ${name}.` };
            price = Number(tokens[i++]);
          }
        }
      }
      skipFill();
      items.push({ name, qty, price });
    }
    skipSeparators();
  }
  return { items };
}

/* -------------------------------------------------------------------------- */
/* INTENT DETECTION                                                           */
/* -------------------------------------------------------------------------- */

const titleCase = s => String(s || '').replace(/\b([a-z؀-ۿ])/g, c => c.toUpperCase()).trim();

/** Find a known name (token sequence) inside tokens. Returns {start,end,name}|null. */
function findNamedSpan(tokens, names) {
  let best = null;
  for (const name of names) {
    const nt = String(name || '').toLowerCase().normalize('NFKC').split(/\s+/).filter(Boolean);
    if (!nt.length) continue;
    for (let s = 0; s + nt.length <= tokens.length; s++) {
      if (nt.every((w, k) => tokens[s + k] === w)) {
        if (!best || nt.length > best.end - best.start) best = { start: s, end: s + nt.length, name };
        break;
      }
    }
  }
  return best;
}

/** Tokens that must never be turned into digits because they are in real names. */
export function protectedTokens(names) {
  const set = new Set();
  for (const name of names || []) {
    for (const w of cleanBase(name).split(' ')) if (w && !isDigits(w)) set.add(w);
  }
  return set;
}

/**
 * @param {string} raw
 * @param {{productNames?:string[], customerNames?:string[]}} ctx
 * @returns {null | object}
 */
export function parseShopIntent(raw, ctx = {}) {
  const productNames = ctx.productNames || [];
  const customerNames = ctx.customerNames || [];
  const protect = protectedTokens([...productNames, ...customerNames]);
  const tokens = canonicalTokens(raw, protect);
  if (!tokens.length) return null;
  const has = w => tokens.includes(w);
  const numbers = tokens.filter(isDigits);
  const isQuestion = has('dikhao');

  /* ---- customer khata view ------------------------------------------------ */
  if (has('khata') && isQuestion) {
    const span = findNamedSpan(tokens, customerNames);
    let name = span ? span.name : null;
    if (!name) {
      const idx = tokens.findIndex(t => t === 'ka');
      const before = tokens.slice(0, idx > 0 ? idx : tokens.indexOf('khata')).filter(t => !['khata', 'customer', 'dikhao'].includes(t));
      name = titleCase(before.join(' '));
    }
    if (!name) return { intent: 'clarify', text: 'Kis customer ka khata dikhana hai? (e.g. "Ali ka khata dikhao")' };
    return { intent: 'khata', name };
  }

  /* ---- new customer (name / phone / address) ------------------------------- */
  if (has('customer') && (has('naya') || has('add') || has('karo')) && !has('wasool') && !isQuestion) {
    let rest = tokens.filter(t => !['customer', 'naya', 'add', 'karo', 'ka', 'naam', 'name', 'banao', 'banayen', 'ko'].includes(t));
    const pIdx = rest.indexOf('phone');
    const aIdx = rest.indexOf('address');
    const cut = [pIdx, aIdx].filter(x => x >= 0).sort((a, b) => a - b)[0];
    const nameTokens = (cut === undefined ? rest : rest.slice(0, cut)).filter(t => !isDigits(t) || false);
    let phone = '';
    if (pIdx >= 0) {
      const end = aIdx > pIdx ? aIdx : rest.length;
      phone = rest.slice(pIdx + 1, end).filter(t => /^\+?\d+$/.test(t)).join('');
    } else {
      const num = rest.find(t => /^\d{7,15}$/.test(t));
      if (num) phone = num;
    }
    const address = aIdx >= 0
      ? rest.slice(aIdx + 1, pIdx > aIdx ? pIdx : rest.length).join(' ').trim()
      : '';
    const name = nameTokens.filter(t => t !== 'phone' && t !== 'address').join(' ').trim();
    if (!name) return { intent: 'clarify', text: 'Customer ka naam kya hai? (e.g. "naya customer Ali phone 0300 1234567 address Lahore")' };
    if (phone && !/^\+?\d{7,15}$/.test(phone)) return { intent: 'clarify', text: 'Phone number theek nahi lag raha (7 se 15 digits chahiye). Dobara likhein.' };
    return { intent: 'newCustomer', name: titleCase(name), phone, address: titleCase(address) };
  }

  /* ---- new product -------------------------------------------------------- */
  if (has('product') && (has('naya') || has('add') || has('karo')) && !has('sale') && !isQuestion && !has('wasool')) {
    const body = tokens.filter(t => !['product', 'naya', 'add', 'karo', 'stock', 'mein', 'ka', 'ko'].includes(t));
    const parsed = parseItems(body);
    if (parsed.error || parsed.items.length !== 1) {
      return { intent: 'clarify', text: 'Naya product kaun sa hai? (e.g. "naya product lamp keemat 300 add karo")' };
    }
    const it = parsed.items[0];
    // name-first form treats a bare trailing number as quantity; for a *new*
    // product a bare number is the price unless "stock" was mentioned.
    let price = it.price, qty = it.qty;
    if (price === null && qty !== null && !has('stock')) { price = qty; qty = null; }
    return { intent: 'newProduct', name: it.name, price, qty: qty ?? 0 };
  }

  /* ---- set stock to an exact number: "lamp ka stock 10 kar do" ------------ */
  if (has('stock') && has('karo') && !has('add') && !has('sale') && !isQuestion && !has('wasool')) {
    if (numbers.length === 1) {
      const body = tokens.filter(t => !['stock', 'mein', 'karo', 'ka', 'ko', 'set', 'product'].includes(t) && !isDigits(t));
      const name = body.join(' ').trim();
      if (name) return { intent: 'setStock', name, qty: Number(numbers[0]) };
    }
    return { intent: 'clarify', text: 'Stock kitna set karna hai? (e.g. "lamp ka stock 10 kar do")' };
  }

  /* ---- sale ---------------------------------------------------------------- */
  if (has('sale') && !isQuestion && !has('wasool') && !has('khata')) {
    let work = tokens.slice();
    let customerName = null;
    const cspan = findNamedSpan(work, customerNames);
    if (cspan && work[cspan.end] === 'ko') {
      customerName = cspan.name;
      work.splice(cspan.start, cspan.end - cspan.start + 1);
    } else if (cspan && cspan.start === 0 && work[cspan.end] === 'ka') {
      // "Ali ka 2 lamp sale karo" is treated the same way
      customerName = cspan.name;
      work.splice(cspan.start, cspan.end - cspan.start + 1);
    }
    const credit = work.some(t => ['udhaar', 'udhar', 'credit', 'khata', 'ادھار'].includes(t));
    const wholesale = work.some(t => ['wholesale', 'thok', 'whole'].includes(t));
    const retail = work.some(t => ['retail', 'ریٹیل'].includes(t));
    work = work.filter(t => !['udhaar', 'udhar', 'credit', 'khata', 'wholesale', 'retail', 'thok', 'whole', 'ادھار', 'ریٹیل'].includes(t));
    const parsed = parseItems(work);
    if (parsed.error) return { intent: 'clarify', text: `Sale samajh nahi aaya: ${parsed.error} Misaal: "2 lamp 4 frame sale karo".` };
    if (!parsed.items.length) return null;
    return {
      intent: 'sale',
      items: parsed.items.map(it => ({ name: it.name, qty: it.qty ?? 1, price: it.price })),
      customerName,
      saleType: wholesale && !retail ? 'wholesale' : 'retail',
      credit
    };
  }

  /* ---- stock add (single or multiple products, optional prices) ---------- */
  if (has('add') && !has('customer') && !isQuestion && !has('wasool')) {
    const parsed = parseItems(tokens);
    const multi = parsed.items.length >= 2 || parsed.items.some(it => it.price !== null);
    if (has('stock') || multi) {
      if (parsed.error) return { intent: 'clarify', text: `Stock add samajh nahi aaya: ${parsed.error} Misaal: "3 lamp keemat 300 stock mein add karo".` };
      if (!parsed.items.length) return null;
      const missing = parsed.items.find(it => it.qty === null);
      if (missing) return { intent: 'clarify', text: `${titleCase(missing.name)} ki kitni quantity add karni hai? (e.g. "5 ${missing.name} stock mein add karo")` };
      return { intent: 'stockAdd', items: parsed.items };
    }
  }

  return null;
}
