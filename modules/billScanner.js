/*
 * MyBusiness Purchase Bill Scanner
 * Free-first, browser/on-device OCR. No bill image is sent to an AI API.
 * OCR is treated as detected data only; nothing reaches Firestore until review + confirmation.
 */

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let tessPromise = null;
let pdfPromise = null;

function esc(v){ return window.esc ? window.esc(v) : String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function money(v){ return window.formatCurrency(Number(v)||0); }
function data(){ return window.data || {}; }
function products(){ return Array.isArray(data().products) ? data().products : []; }
function suppliers(){ return Array.isArray(data().suppliers) ? data().suppliers : []; }
function show(msg,type='info'){ if(window.showToast) window.showToast(msg,type,{duration:type==='error'?5000:3200}); else alert(msg); }
function normalizeText(v=''){
  return String(v).toLowerCase()
    .replace(/[\u200b-\u200f\u202a-\u202e]/g,'')
    .replace(/[.,/\\()\[\]{}:;|+_=*#@!?]/g,' ')
    .replace(/\b(ltr|litre|liter|litres)\b/g,'l')
    .replace(/\b(kg|kgs|kilo|kilogram|kilograms)\b/g,'kg')
    .replace(/\b(gm|gms|gram|grams)\b/g,'g')
    .replace(/\b(ml|millilitre|milliliter|milliliters)\b/g,'ml')
    .replace(/\s+/g,' ').trim();
}
function tokens(v){ return normalizeText(v).split(/\s+/).filter(Boolean); }
function similarity(a,b){
  const aa=tokens(a), bb=tokens(b); if(!aa.length||!bb.length)return 0;
  const A=new Set(aa), B=new Set(bb); let inter=0; A.forEach(x=>{if(B.has(x))inter++;});
  const j=inter/(A.size+B.size-inter||1);
  const compactA=normalizeText(a).replace(/\s/g,''), compactB=normalizeText(b).replace(/\s/g,'');
  const lev=levenshteinRatio(compactA,compactB);
  return Math.max(j,lev*0.9);
}
function levenshteinRatio(a,b){
  if(a===b)return 1; if(!a||!b)return 0;
  if(a.length>120||b.length>120){a=a.slice(0,120);b=b.slice(0,120);}
  const prev=new Array(b.length+1); for(let j=0;j<=b.length;j++)prev[j]=j;
  for(let i=1;i<=a.length;i++){
    const cur=[i];
    for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    for(let j=0;j<=b.length;j++)prev[j]=cur[j];
  }
  return 1-prev[b.length]/Math.max(a.length,b.length);
}
function parseNumber(s){ const n=Number(String(s).replace(/,/g,'')); return Number.isFinite(n)?n:null; }
function extractNumbers(line){
  return [...String(line).matchAll(/(?:Rs\.?\s*)?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi)]
    .map(m=>({value:parseNumber(m[1]),raw:m[0],index:m.index})).filter(x=>x.value!==null);
}
function likelyDate(line){ return /\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\b/.test(line); }
function parseDateText(text){
  const m=String(text).match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if(!m)return '';
  let y=Number(m[3]); if(y<100)y+=2000;
  const d=String(Number(m[1])).padStart(2,'0'), mo=String(Number(m[2])).padStart(2,'0');
  return `${y}-${mo}-${d}`;
}
function isExcludedProductLine(line){
  const x=normalizeText(line);
  return /^(subtotal|sub total|total|grand total|net total|tax|gst|vat|discount|cash|change|balance|amount due|invoice|bill no|invoice no|date|phone|tel|mobile|customer|address|sale|thank|received|payment|fbr|ntn|strn)\b/.test(x)
    || /\b(subtotal|grand total|amount due|invoice number|invoice no|gst|vat|tax|discount)\b/.test(x);
}
function extractHeader(text){
  const lines=String(text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const out={supplier:'',invoiceNumber:'',invoiceDate:'',subtotal:null,discount:null,tax:null,grandTotal:null};
  const findValue=(regex)=>{ const line=lines.find(l=>regex.test(l)); return line||''; };
  let l=findValue(/\b(invoice|inv|bill)\s*(no|number|#)?\b/i);
  if(l){ const m=l.match(/(?:invoice|inv|bill)\s*(?:no|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{2,})/i); if(m)out.invoiceNumber=m[1]; }
  l=findValue(/\b(invoice|inv|bill)?\s*date\b/i); if(l)out.invoiceDate=parseDateText(l);
  if(!out.invoiceDate){ const dl=lines.find(likelyDate); if(dl)out.invoiceDate=parseDateText(dl); }
  const totalLine=lines.find(l=>/\b(grand\s*total|net\s*total|amount\s*payable|total\s*amount|total)\b/i.test(l)&&extractNumbers(l).length);
  if(totalLine){ const nums=extractNumbers(totalLine); out.grandTotal=nums[nums.length-1]?.value??null; }
  const subLine=lines.find(l=>/\b(sub\s*total)\b/i.test(l)&&extractNumbers(l).length); if(subLine)out.subtotal=extractNumbers(subLine).at(-1)?.value??null;
  const discLine=lines.find(l=>/\b(discount|disc)\b/i.test(l)&&extractNumbers(l).length); if(discLine)out.discount=extractNumbers(discLine).at(-1)?.value??null;
  const taxLine=lines.find(l=>/\b(gst|vat|tax)\b/i.test(l)&&extractNumbers(l).length); if(taxLine)out.tax=extractNumbers(taxLine).at(-1)?.value??null;
  const headerCandidates=lines.slice(0,8).filter(l=>!isExcludedProductLine(l)&&!likelyDate(l)&&extractNumbers(l).length===0&&l.length>2);
  if(headerCandidates.length)out.supplier=headerCandidates[0].replace(/^(supplier|vendor)\s*[:#-]?\s*/i,'').trim();
  return out;
}
function parseProductRows(text){
  const lines=String(text).split(/\r?\n/).map(x=>x.replace(/\t+/g,' ').replace(/\s{2,}/g,' ').trim()).filter(Boolean);
  const rows=[];
  for(const raw of lines){
    const line=raw.replace(/^[|•·-]+\s*/,'').trim();
    if(line.length<3||isExcludedProductLine(line)||likelyDate(line))continue;
    const nums=extractNumbers(line); if(nums.length<2)continue;
    if(nums.some(n=>String(n.value).replace(/\D/g,'').length>=9))continue;

    let qty=null, price=null, qtyPos=-1, pricePos=-1;
    // Prefer a clear Qty × Unit Price = Line Total pattern.
    for(let k=nums.length-3;k>=0;k--){
      const a=nums[k],b=nums[k+1],c=nums[k+2];
      if(a.value>0 && b.value>=0 && Math.abs(a.value*b.value-c.value)<=Math.max(1,Math.abs(c.value)*0.035)){
        qty=a.value; price=b.value; qtyPos=a.index; pricePos=b.index; break;
      }
    }
    // Otherwise assume the final two numbers are quantity and unit price.
    if(qty===null){
      const q=nums[nums.length-2], p=nums[nums.length-1];
      qty=q.value; price=p.value; qtyPos=q.index; pricePos=p.index;
    }
    if(!Number.isFinite(qty)||qty<=0||qty>100000||!Number.isFinite(price)||price<0||price>100000000)continue;

    let name=line.slice(0,Math.min(qtyPos,pricePos)).trim();
    // Remove common leading item-number columns while preserving product names.
    name=name.replace(/^\d{1,5}[.)-]\s*/,'').replace(/^[|]+\s*/,'').replace(/\s{2,}/g,' ').trim();
    if(name.length<2||/^\d+(?:\.\d+)?$/.test(name))continue;

    const unit=detectUnit(name); const packSize=detectPackSize(name);
    const confidence=Math.max(0.42,Math.min(0.97,0.56+(name.length>5?0.12:0)+(nums.length>=2?0.10:0)+(nums.length>=3?0.08:0)));
    rows.push({name,quantity:Math.round(qty*100)/100,unit,packSize,purchasePrice:Math.round(price*100)/100,totalPrice:Math.round(qty*price*100)/100,sku:detectSku(line),barcode:detectBarcode(line),ocrConfidence:confidence});
  }
  const clean=[];
  for(const r of rows){
    const prev=clean.at(-1);
    if(prev&&similarity(prev.name,r.name)>0.92&&Math.abs(prev.purchasePrice-r.purchasePrice)<0.01&&Math.abs(prev.quantity-r.quantity)<0.01)continue;
    clean.push(r);
  }
  return clean;
}
function detectUnit(s){ const x=normalizeText(s); if(/\bkg\b/.test(x))return 'kg'; if(/\bg\b/.test(x))return 'g'; if(/\bl\b/.test(x))return 'L'; if(/\bml\b/.test(x))return 'ml'; if(/\b(dozen|dz|doz)\b/.test(x))return 'dozen'; if(/\b(box|boxes)\b/.test(x))return 'box'; if(/\b(carton|cartons|ctn)\b/.test(x))return 'carton'; if(/\b(pack|pk|packs)\b/.test(x))return 'pack'; return 'piece'; }
function detectPackSize(s){ const m=String(s).match(/\b(\d+(?:\.\d+)?)\s*(kg|g|l|ml|ltr|litre|liter)\b/i); return m?`${m[1]} ${m[2]}`:''; }
function detectSku(s){ const m=String(s).match(/\b(?:sku|item\s*(?:code|no)|code)\s*[:#-]?\s*([A-Z0-9][A-Z0-9_-]{2,})\b/i); return m?m[1]:''; }
function detectBarcode(s){ const m=String(s).match(/\b\d{8,14}\b/); return m?m[0]:''; }
function normalizeBarcode(v){ return String(v||'').replace(/\D/g,''); }
function matchSupplier(name){
  if(!name)return null;
  let best=null,score=0; for(const s of suppliers()){ const sc=similarity(name,s.name||''); if(sc>score){score=sc;best=s;} }
  return best&&score>=0.78?{supplier:best,score}:null;
}
function matchProduct(item){
  const aliasMatches=[];
  for(const p of products()){
    const names=[p.name,...(Array.isArray(p.billAliases)?p.billAliases:[])].filter(Boolean);
    const barcode=normalizeBarcode(item.barcode); const pbarcode=normalizeBarcode(p.barcode);
    if(barcode&&pbarcode&&barcode===pbarcode)return {product:p,score:1,level:'high',reason:'Barcode'};
    if(item.sku&&String(p.sku||'').toLowerCase()===String(item.sku).toLowerCase())return {product:p,score:.99,level:'high',reason:'SKU'};
    for(const n of names){ const sc=similarity(item.name,n); aliasMatches.push({product:p,score:sc,name:n}); }
  }
  aliasMatches.sort((a,b)=>b.score-a.score); const best=aliasMatches[0];
  if(!best)return {product:null,score:0,level:'low',reason:'No match'};
  if(best.score>=0.90)return {product:best.product,score:best.score,level:'high',reason:'Name/alias'};
  if(best.score>=0.68)return {product:best.product,score:best.score,level:'medium',reason:'Similar name'};
  return {product:null,score:best.score,level:'low',reason:'No reliable match',suggestion:best.product};
}
function duplicatePurchase(info){
  const inv=normalizeText(info.invoiceNumber); const date=String(info.invoiceDate||''); const total=Number(info.grandTotal||0); const sid=info.supplierId||'';
  if(!inv && !(date&&total>0)) return null;
  return (data().stockPurchases||[]).find(p=>{
    const pinv=normalizeText(p.supplierInvoiceNumber||p.invoiceNumber); const pdate=String(p.billDate||p.date||'').slice(0,10); const ptotal=Number(p.grandTotal??p.amount??0); const psid=p.supplierId||'';
    if(inv) return pinv===inv && (!sid || !psid || sid===psid);
    return pdate===date && Math.abs(ptotal-total)<=0.01 && (!sid || !psid || sid===psid);
  })||null;
}
function saveAliasToProduct(productId, alias){
  const p=products().find(x=>x.id===productId); if(!p)return;
  const clean=String(alias||'').trim(); if(!clean)return;
  if(similarity(clean,p.name||'')>=.94)return;
  const aliases=Array.isArray(p.billAliases)?p.billAliases.slice():[];
  if(!aliases.some(a=>normalizeText(a)===normalizeText(clean)))aliases.push(clean);
  p.billAliases=aliases;
}
function fileToImage(file){ return new Promise((resolve,reject)=>{ const u=URL.createObjectURL(file); const img=new Image(); img.onload=()=>{URL.revokeObjectURL(u);resolve(img)}; img.onerror=e=>{URL.revokeObjectURL(u);reject(new Error('The image could not be opened.'))}; img.src=u; }); }
function preprocessImage(img,rotation=0){
  const max=2400, scale=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
  const sw=Math.max(1,Math.round((img.naturalWidth||img.width)*scale)), sh=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
  const canvas=document.createElement('canvas'), c=canvas.getContext('2d',{willReadFrequently:true});
  const rad=rotation*Math.PI/180; const swap=rotation%180!==0; canvas.width=swap?sh:sw; canvas.height=swap?sw:sh;
  c.translate(canvas.width/2,canvas.height/2); c.rotate(rad); c.drawImage(img,-sw/2,-sh/2,sw,sh);
  const image=c.getImageData(0,0,canvas.width,canvas.height), d=image.data;
  // Mild grayscale + contrast normalization; keeps characters readable under shadows.
  let min=255,maxv=0; for(let i=0;i<d.length;i+=16){ const y=.299*d[i]+.587*d[i+1]+.114*d[i+2]; min=Math.min(min,y);maxv=Math.max(maxv,y); }
  const span=Math.max(40,maxv-min); for(let i=0;i<d.length;i+=4){ let y=.299*d[i]+.587*d[i+1]+.114*d[i+2]; y=((y-min)/span)*255; y=Math.max(0,Math.min(255,(y-128)*1.18+128)); d[i]=d[i+1]=d[i+2]=y; }
  c.putImageData(image,0,0); return canvas;
}
async function loadScript(url,id){ if(window[id])return window[id]; const existing=document.querySelector(`script[data-mybiz-lib="${id}"]`); if(existing)return new Promise((res,rej)=>{existing.addEventListener('load',()=>res(window[id]));existing.addEventListener('error',rej);}); return new Promise((resolve,reject)=>{ const s=document.createElement('script');s.src=url;s.async=true;s.dataset.mybizLib=id;s.onload=()=>window[id]?resolve(window[id]):reject(new Error(`${id} loaded but was not available.`));s.onerror=()=>reject(new Error(`Could not load ${id}. Check your internet connection and try again.`));document.head.appendChild(s); }); }
async function loadTesseract(){ if(tessPromise)return tessPromise; tessPromise=loadScript(TESSERACT_URL,'Tesseract'); return tessPromise; }
async function loadPdfJs(){ if(pdfPromise)return pdfPromise; pdfPromise=loadScript(PDFJS_URL,'pdfjsLib').then(lib=>{lib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER_URL;return lib;}); return pdfPromise; }
async function ocrCanvas(canvas,logger){
  const T=await loadTesseract();
  let result=null;
  try{ result=await T.recognize(canvas,'eng',{logger}); }
  catch(engErr){ console.warn('English OCR failed; retrying with Urdu OCR.',engErr); }
  let confidence=Number(result?.data?.confidence||0);
  let text=result?.data?.text||'';
  // A successful OCR call can still return unusable text. Retry with Urdu when
  // English confidence is weak so mixed English/Urdu distributor bills have a chance.
  if(confidence<48 || text.trim().length<8){
    try{
      const urd=await T.recognize(canvas,'urd',{logger});
      const uc=Number(urd?.data?.confidence||0);
      if(uc>confidence || !text.trim()){ text=urd?.data?.text||text; confidence=uc; }
    }catch(urdErr){ console.warn('Urdu OCR unavailable; keeping English OCR.',urdErr); }
  }
  return {text,confidence};
}
async function processFile(file,progress){
  if(!file)throw new Error('No file selected.');
  if(file.size>25*1024*1024)throw new Error('File is too large. Please use an image/PDF under 25 MB.');
  const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  const texts=[]; let confs=[]; let previewUrl='';
  const logger=m=>{ if(typeof m?.progress==='number')progress?.(Math.round(m.progress*100),m.status||'OCR Reading…'); };
  if(isPdf){
    const pdfjs=await loadPdfJs(); progress?.(8,'Opening PDF…'); const buf=await file.arrayBuffer(); const pdf=await pdfjs.getDocument({data:buf}).promise;
    if(pdf.numPages>30)throw new Error('This PDF has more than 30 pages. Please scan the relevant bill pages separately.');
    for(let i=1;i<=pdf.numPages;i++){
      progress?.(10+Math.round((i-1)/pdf.numPages*55),`Reading PDF page ${i} of ${pdf.numPages}…`);
      const page=await pdf.getPage(i); const viewport=page.getViewport({scale:2}); const canvas=document.createElement('canvas'); canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height); await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      if(i===1)try{previewUrl=canvas.toDataURL('image/jpeg',0.82);}catch(_){} const r=await ocrCanvas(canvas,logger);texts.push(r.text);confs.push(r.confidence);
    }
  }else{
    if(!file.type.startsWith('image/'))throw new Error('Unsupported file. Please choose an image or PDF.');
    const img=await fileToImage(file); progress?.(8,'Preparing bill image…');
    const rotations=[0,90,270]; let best=null;
    for(let i=0;i<rotations.length;i++){
      progress?.(12+i*24,`Checking orientation ${i+1} of ${rotations.length}…`); const canvas=preprocessImage(img,rotations[i]); const r=await ocrCanvas(canvas,logger); if(!best||r.confidence>best.confidence)best={...r,rotation:rotations[i]};
    }
    texts.push(best?.text||'');confs.push(best?.confidence||0);
  }
  const text=texts.join('\n'); const avg=confs.length?confs.reduce((a,b)=>a+b,0)/confs.length:0; progress?.(88,'Finding products…');
  const header=extractHeader(text); const items=parseProductRows(text).map(item=>({...item,match:matchProduct(item)}));
  return {text,confidence:avg,header,items,sourceFile:file,previewUrl};
}

function renderScanHome(){
  const m=document.getElementById('modal-body'); if(!m)return;
  m.classList.add('bill-scanner-modal');
  m.innerHTML=`<div class="modal-header"><h2>Scan Purchase Bill</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
  <div class="bill-scan-hero"><div class="bill-scan-icon"><i class="fas fa-file-invoice"></i></div><h3>Import a supplier bill</h3><p>OCR runs in your browser. Your bill image is not sent to an AI service.</p></div>
  <div class="bill-scan-actions"><button class="btn bill-scan-primary" onclick="document.getElementById('bill-camera-input').click()"><i class="fas fa-camera"></i><span>Take Photo</span><small>Use camera</small></button><button class="btn btn-secondary" onclick="document.getElementById('bill-image-input').click()"><i class="fas fa-image"></i><span>Choose Image</span><small>From device</small></button><button class="btn btn-secondary" onclick="document.getElementById('bill-pdf-input').click()"><i class="fas fa-file-pdf"></i><span>Upload PDF</span><small>PDF pages</small></button></div>
  <input id="bill-camera-input" type="file" accept="image/*" capture="environment" class="hidden" onchange="handleBillFile(this.files[0])"><input id="bill-image-input" type="file" accept="image/*" class="hidden" onchange="handleBillFile(this.files[0])"><input id="bill-pdf-input" type="file" accept="application/pdf,.pdf" class="hidden" onchange="handleBillFile(this.files[0])">
  <button class="btn btn-secondary" style="width:100%;margin-top:12px" onclick="closeModal()">Cancel</button>`;
}
export function openBillScanner(){ if(window.currentRole!=='admin' && !window.hasPermission?.('stockPurchases')){show('You do not have permission to create purchases.','error');return;} renderScanHome(); document.getElementById('modal-overlay')?.classList.remove('hidden'); }
async function renderProcessing(){ const m=document.getElementById('modal-body'); m.classList.add('bill-scanner-modal'); m.innerHTML=`<div class="modal-header"><h2>Processing Bill…</h2></div><div class="bill-progress"><div class="bill-progress-ring"><i class="fas fa-magic"></i></div><h3 id="bill-progress-title">Preparing…</h3><div class="bill-progress-track"><span id="bill-progress-bar"></span></div><p id="bill-progress-percent">0%</p><small>OCR happens on this device. Keep this window open.</small></div>`; }
export async function handleBillFile(file){
  if(!file)return; await renderProcessing();
  try{
    const result=await processFile(file,(pct,status)=>{document.getElementById('bill-progress-title')?.replaceChildren(document.createTextNode(status));document.getElementById('bill-progress-bar')?.style.setProperty('width',`${Math.min(100,pct)}%`);document.getElementById('bill-progress-percent')?.replaceChildren(document.createTextNode(`${Math.min(100,pct)}%`));});
    if(result.items.length===0){
      renderScanError('No product rows were detected. Make sure the entire bill is visible, text is sharp, and the photo is taken straight-on. You can retry or use Add Purchase Manually.');
      return;
    }
    const h=result.header, supplierMatch=matchSupplier(h.supplier); const supplier=supplierMatch?.supplier||null;
    window.billScanDraft={...result, supplierMatch, supplierId:supplier?.id||'',supplierName:supplier?.name||h.supplier||'', previewUrl:result.previewUrl || (file.type?.startsWith('image/')?URL.createObjectURL(file):''), items:result.items.map(i=>({...i,productId:i.match?.product?.id||'',status:i.match?.level||'low',newProductConfirmed:false,selectedProductId:i.match?.product?.id||'',selectedProductName:i.match?.product?.name||''}))};
    const dup=duplicatePurchase({invoiceNumber:h.invoiceNumber,invoiceDate:h.invoiceDate,grandTotal:h.grandTotal,supplierId:supplier?.id}); window.billScanDraft.duplicate=dup||null;
    renderBillReview();
  }catch(e){console.error(e);renderScanError(e.message||'Bill scanning failed.');}
}
function renderScanError(msg){ const m=document.getElementById('modal-body');m.innerHTML=`<div class="modal-header"><h2>Scan Problem</h2><button class="close-btn" onclick="closeModal()">&times;</button></div><div class="bill-error"><i class="fas fa-triangle-exclamation"></i><h3>We couldn't read this bill</h3><p>${esc(msg)}</p><button class="btn" onclick="openBillScanner()">Try Another Image</button><button class="btn btn-secondary" onclick="closeModal()">Cancel</button></div>`; }
function statusBadge(item){ const s=item.status; return s==='high'?'<span class="badge badge-ok">✓ Matched</span>':s==='medium'?'<span class="badge badge-low">⚠ Review</span>':'<span class="badge badge-low">? Unknown</span>'; }
function productOptions(item,index){
  const opts=products().map(p=>`<option value="${esc(p.id)}" ${p.id===item.selectedProductId?'selected':''}>${esc(p.name)}</option>`).join('');
  return `<select onchange="setBillItemProduct(${index},this.value)"><option value="">${item.status==='low'?'No existing match':'Select Existing Product'}</option>${opts}</select>${!item.selectedProductId?`<button type="button" class="btn btn-secondary bill-new-product-btn" onclick="setBillItemNew(${index})">${item.newProductConfirmed?'✓ New Product':'Create New Product'}</button>`:''}`;
}
function syncReviewHeaderFromDom(){const d=window.billScanDraft;if(!d)return;const q=id=>document.getElementById(id);if(q('bs-invoice'))d.header={...(d.header||{}),invoiceNumber:q('bs-invoice').value.trim(),invoiceDate:q('bs-date')?.value||d.header?.invoiceDate||'',subtotal:Number(q('bs-subtotal')?.value)||0,discount:Number(q('bs-discount')?.value)||0,tax:Number(q('bs-tax')?.value)||0,grandTotal:Number(q('bs-grand-total')?.value)||0,paid:q('bs-paid')?.value??d.header?.paid??''};}
function renderBillReview(){
  syncReviewHeaderFromDom();
  const d=window.billScanDraft; if(!d)return; const m=document.getElementById('modal-body');m.classList.add('bill-review-modal');
  const total=d.items.reduce((s,i)=>s+(Number(i.quantity)||0)*(Number(i.purchasePrice)||0),0); const billTotal=Number(d.header.grandTotal||0); const diff=billTotal?total-billTotal:0; const canConfirm=d.items.length>0&&d.items.every(i=>String(i.name||'').trim()&&Number(i.quantity)>0&&Number(i.purchasePrice)>=0&&(i.selectedProductId||i.newProductConfirmed));
  m.innerHTML=`<div class="modal-header"><div><h2>Review Purchase</h2><small>Detected data — nothing has been added to stock.</small></div><button class="close-btn" onclick="closeModal()">&times;</button></div>
  <div class="bill-review-grid"><div class="bill-preview-panel">${d.previewUrl?`<img src="${d.previewUrl}" alt="Original bill preview">`:'<div class="bill-pdf-preview"><i class="fas fa-file-pdf"></i><strong>PDF bill</strong><span>Original file selected</span></div>'}</div>
  <div class="bill-fields-panel"><div class="bill-meta-grid"><label>Supplier<input id="bs-supplier-name" value="${esc(d.supplierName||'')}" placeholder="Supplier name" onchange="billSupplierNameChanged(this.value)"></label><label>Invoice Number<input id="bs-invoice" value="${esc(d.header.invoiceNumber||'')}"></label><label>Invoice Date<input type="date" id="bs-date" value="${esc(d.header.invoiceDate||window.getLocalDateStr(new Date()))}"></label><label>Subtotal<input type="number" id="bs-subtotal" value="${d.header.subtotal??''}"></label><label>Discount<input type="number" id="bs-discount" value="${d.header.discount??0}"></label><label>Tax<input type="number" id="bs-tax" value="${d.header.tax??0}"></label><label>Grand Total<input type="number" id="bs-grand-total" value="${d.header.grandTotal??total}"></label><label>Amount Paid Now<input type="number" id="bs-paid" min="0" value="${d.header.paid??(d.header.grandTotal??total)}"></label></div>
  ${d.supplierMatch?`<div class="bill-match-note"><strong>Supplier match:</strong> ${esc(d.supplierMatch.supplier.name)} <span>${Math.round(d.supplierMatch.score*100)}%</span></div>`:`<div class="bill-match-note warning">Supplier not found. You can select/create one below.</div>`}
  <div class="bill-supplier-actions"><button type="button" class="btn btn-secondary btn-sm" onclick="selectBillSupplier()">Select Existing Supplier</button><button type="button" class="btn btn-secondary btn-sm" onclick="createBillSupplier()">Create New Supplier</button></div></div></div>
  <div class="bill-total-validation ${billTotal&&Math.abs(diff)>.01?'warning':'ok'}"><span>${billTotal&&Math.abs(diff)<=.01?'✓ Total matches':'⚠ '+(billTotal?'Calculated total does not match the bill total.':'Bill total not detected — review the items.')}</span><strong>Calculated: ${money(total)} ${billTotal?` · Bill: ${money(billTotal)}`:''}</strong></div>
  <div class="bill-items-head"><h3>Detected Products (${d.items.length})</h3><button class="btn btn-secondary btn-sm" onclick="addBillItem()">+ Add Item</button></div>
  <div class="bill-items-table"><div class="bill-table-header"><span>Product</span><span>Qty</span><span>Unit</span><span>Purchase Price</span><span>Existing Product</span><span>Status</span><span></span></div>${d.items.map((item,i)=>`<div class="bill-item-row"><input class="bill-name" value="${esc(item.name)}" onchange="updateBillItem(${i},'name',this.value)"><input type="number" min="0.01" step="0.01" value="${Number(item.quantity)||1}" onchange="updateBillItem(${i},'quantity',this.value)"><input value="${esc(item.unit||'piece')}" onchange="updateBillItem(${i},'unit',this.value)"><input type="number" min="0" step="0.01" value="${Number(item.purchasePrice)||0}" onchange="updateBillItem(${i},'purchasePrice',this.value)"><div>${productOptions(item,i)}${item.match?.suggestion&&!item.selectedProductId?`<small>Possible: ${esc(item.match.suggestion.name)}</small>`:''}</div><div>${statusBadge(item)}<small>${Math.round((item.ocrConfidence||0)*100)}% OCR</small></div><button class="btn btn-sm btn-danger" onclick="removeBillItem(${i})" aria-label="Remove item"><i class="fas fa-trash"></i></button></div>`).join('')}</div>
  <div class="bill-review-footer"><button class="btn btn-secondary" type="button" onclick="openBillScanner()">Back</button><div class="bill-confirm-wrap"><small class="bill-confirm-hint">${canConfirm?'Review complete. Confirm to update stock.':'Select an existing product or press Create New Product for every item.'}</small><button class="btn" type="button" id="btn-confirm-bill" onclick="confirmScannedPurchase()" ${canConfirm?'':'disabled'}>Confirm & Add to Stock</button></div></div></div>`;
}
export function updateBillItem(index,field,value){ const d=window.billScanDraft;if(!d?.items[index])return;d.items[index][field]=(field==='quantity'||field==='purchasePrice')?Number(value)||0:value;renderBillReview(); }
export function setBillItemProduct(index,id){ const d=window.billScanDraft;if(!d?.items[index])return;const item=d.items[index];item.selectedProductId=id;item.newProductConfirmed=false;const p=products().find(x=>x.id===id);item.selectedProductName=p?.name||'';item.status=id?(similarity(item.name,p?.name||'')>=.9?'high':'medium'):'low';renderBillReview(); }
export function setBillItemNew(index){const d=window.billScanDraft;if(!d?.items[index])return;const item=d.items[index];item.selectedProductId='';item.selectedProductName='';item.status='low';item.newProductConfirmed=true;renderBillReview();}
export function billSupplierNameChanged(value){const d=window.billScanDraft;if(!d)return;const v=String(value||'').trim();const selected=suppliers().find(s=>s.id===d.supplierId);if(!selected||normalizeText(selected.name)!==normalizeText(v)){d.supplierId='';d.supplierMatch=null;d.supplierName=v;}renderBillReview();}
export function removeBillItem(index){window.billScanDraft?.items.splice(index,1);renderBillReview();}
export function addBillItem(){ window.billScanDraft?.items.push({name:'',quantity:1,unit:'piece',packSize:'',purchasePrice:0,totalPrice:0,ocrConfidence:1,selectedProductId:'',selectedProductName:'',status:'low',match:{}});renderBillReview(); }
function selectBillSupplier(){
  const d=window.billScanDraft;if(!d)return; const m=document.getElementById('modal-body');m.innerHTML=`<div class="modal-header"><h2>Select Existing Supplier</h2><button class="close-btn" onclick="renderBillReview()">&times;</button></div><div class="bill-supplier-list">${suppliers().map(s=>`<button class="bill-supplier-option" onclick="chooseBillSupplier('${esc(s.id)}')"><strong>${esc(s.name)}</strong><small>${esc(s.phone||'')}</small></button>`).join('')||'<p>No suppliers yet.</p>'}</div>`;
}
export function chooseBillSupplier(id){const s=suppliers().find(x=>x.id===id);if(s&&window.billScanDraft){window.billScanDraft.supplierId=s.id;window.billScanDraft.supplierName=s.name;window.billScanDraft.supplierMatch={supplier:s,score:1};renderBillReview();}}
export function createBillSupplier(){
  const m=document.getElementById('modal-body');m.innerHTML=`<div class="modal-header"><h2>Create New Supplier</h2><button class="close-btn" onclick="renderBillReview()">&times;</button></div><div class="form-group"><label>Supplier Name *</label><input id="new-bs-supplier" value="${esc(window.billScanDraft?.supplierName||'')}"></div><div class="form-group"><label>Phone (Optional)</label><input id="new-bs-phone" inputmode="tel"></div><button class="btn" onclick="saveNewBillSupplier()">Create Supplier</button>`;
}
export async function saveNewBillSupplier(){
  const name=document.getElementById('new-bs-supplier')?.value.trim();if(!name)return show('Supplier name is required.','error');
  const existing=suppliers().find(s=>similarity(s.name||'',name)>=.9);if(existing){chooseBillSupplier(existing.id);show('A similar supplier already exists. Selected it instead.','warning');return;}
  try{const ref=window.doc(window.collection(window.db,'suppliers'));const obj={name,phone:document.getElementById('new-bs-phone')?.value.trim()||'',balance:0,ownerId:window.currentUserId,createdAt:new Date().toISOString()};await window.setDoc(ref,obj);data().suppliers.push({id:ref.id,...obj});chooseBillSupplier(ref.id);show('Supplier created.','success');}catch(e){console.error(e);show(e.message||'Could not create supplier.','error');}
}
function getReviewHeader(){ syncReviewHeaderFromDom(); const d=window.billScanDraft; return {supplierId:d.supplierId||null,date:document.getElementById('bs-date')?.value||window.getLocalDateStr(new Date()),paid:document.getElementById('bs-paid')?.value??'',note:'Bill scan',invoiceNumber:document.getElementById('bs-invoice')?.value.trim()||'',subtotal:Number(document.getElementById('bs-subtotal')?.value)||0,discount:Number(document.getElementById('bs-discount')?.value)||0,tax:Number(document.getElementById('bs-tax')?.value)||0,grandTotal:Number(document.getElementById('bs-grand-total')?.value)||0}; }
export async function confirmScannedPurchase(){
  const d=window.billScanDraft;if(!d)return; const h=getReviewHeader();
  if(!h.date)return show('Invoice date is required.','error');
  if(!d.items.length)return show('Add at least one item.','error');
  const invalid=d.items.find(i=>!String(i.name||'').trim()||Number(i.quantity)<=0||Number(i.purchasePrice)<0||(!i.selectedProductId&&!i.newProductConfirmed)); if(invalid)return show('Each item must be matched to an existing product or explicitly marked Create New Product.','error');
  if(d.items.some(i=>!i.selectedProductId&&!String(i.name||'').trim()))return show('Every item needs a product name.','error');
  const calc=d.items.reduce((s,i)=>s+Number(i.quantity)*Number(i.purchasePrice),0); const diff=h.grandTotal?calc-h.grandTotal:0;
  if(h.grandTotal&&Math.abs(diff)>.01&&!confirm(`Calculated total is ${money(calc)} but the bill total is ${money(h.grandTotal)}. Continue anyway?`))return;
  const dup=duplicatePurchase({...h,supplierId:h.supplierId,grandTotal:h.grandTotal});if(dup&&!d.duplicateConfirmed&&!confirm('This invoice may already exist. Continue anyway?'))return;
  const btn=document.getElementById('btn-confirm-bill'); if(btn){btn.disabled=true;btn.innerHTML='<span class="btn-loader"></span> Saving…';}
  try{
    if(typeof window.commitStockPurchaseFromScanner!=='function') throw new Error('Purchase save module is not loaded. Please refresh the app once and try again.');
    const result=await window.commitStockPurchaseFromScanner({items:d.items,header:h});
    // Remember confirmed bill spellings as aliases without changing the canonical product name.
    if(result?.aliasPairs?.length){ for(const pair of result.aliasPairs)saveAliasToProduct(pair.productId,pair.alias); }
    window.billScanDraft=null;window.closeModal();window.showToast?.('Purchase added successfully — stock updated','success');
  }catch(e){console.error(e);show(e.message||'Could not add purchase. Nothing was confirmed to stock.','error');}
  finally{ const b=document.getElementById('btn-confirm-bill');if(b)b.disabled=false; }
}

window.openBillScanner=openBillScanner;window.handleBillFile=handleBillFile;window.updateBillItem=updateBillItem;window.setBillItemProduct=setBillItemProduct;window.setBillItemNew=setBillItemNew;window.billSupplierNameChanged=billSupplierNameChanged;window.removeBillItem=removeBillItem;window.addBillItem=addBillItem;window.selectBillSupplier=selectBillSupplier;window.chooseBillSupplier=chooseBillSupplier;window.createBillSupplier=createBillSupplier;window.saveNewBillSupplier=saveNewBillSupplier;window.confirmScannedPurchase=confirmScannedPurchase;window.renderBillReview=renderBillReview;
