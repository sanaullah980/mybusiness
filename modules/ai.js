let requestSeq = 0;
let pending = new Map();
let initialized = false;

function nativeAvailable(){ return !!(window.AndroidAI && window.__MYBUSINESS_NATIVE_AI__); }
function escAi(v){ return String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function fmtMb(bytes){ return `${(Number(bytes||0)/1024/1024).toFixed(0)} MB`; }

window.NativeAI = window.NativeAI || {};
window.NativeAI._event = (kind, raw) => {
  let data={}; try{data=JSON.parse(raw||'{}')}catch(_){data={message:raw};}
  if(kind==='state') updateAIState(data);
  if(kind==='install') updateAIProgress(data);
  if(kind==='result') finishAIRequest(data);
  if(kind==='error') setAIError(data.message||'AI error');
  if(kind==='webError') setAIError('The app page could not be loaded. Qwen is optional and does not block the app.');
};

function aiRoot(){return document.getElementById('ai-page');}
function aiStatusEl(){return document.getElementById('ai-status');}
function aiProgressWrap(){return document.getElementById('ai-progress-wrap');}
function aiProgressBar(){return document.getElementById('ai-progress-bar');}
function aiProgressText(){return document.getElementById('ai-progress-text');}
function aiMessages(){return document.getElementById('ai-messages');}
function aiInput(){return document.getElementById('ai-input');}

function setAIError(message){
  const s=aiStatusEl(); if(s){s.textContent=message;s.dataset.state='error';}
}
function updateAIProgress(d){
  const p=Math.max(0,Math.min(100,Number(d.percent||0)));
  const bar=aiProgressBar(); const text=aiProgressText(); const wrap=aiProgressWrap();
  if(bar)bar.style.width=p+'%';
  if(text)text.textContent=`Installing Qwen3 0.6B — ${p}% • ${fmtMb(d.bytes)} / ${fmtMb(d.total)}`;
  if(wrap)wrap.classList.remove('hidden');
}
function updateAIState(d){
  const status=d.status||''; const s=aiStatusEl(); const wrap=aiProgressWrap();
  if(!s)return;
  const btnGet=document.getElementById('ai-get-model'); const btnInstall=document.getElementById('ai-install-model'); const chat=document.getElementById('ai-chat-area');
  const install=document.getElementById('ai-install-card');
  if(status==='checking'){s.textContent='Checking model...';}
  else if(status==='verifying'){s.textContent='Verifying model...'; if(wrap)wrap.classList.remove('hidden'); if(aiProgressText())aiProgressText().textContent='Verifying model integrity…';}
  else if(status==='loading'){s.textContent='Loading Qwen AI...'; if(wrap)wrap.classList.remove('hidden'); if(aiProgressText())aiProgressText().textContent='Loading the local model…';}
  else if(status==='ready'){
    s.textContent='AI Ready • Local / Offline'; s.dataset.state='ready';
    if(wrap)wrap.classList.add('hidden'); if(install)install.classList.add('hidden'); if(chat)chat.classList.remove('hidden');
    if(btnGet)btnGet.textContent='Get Model Again'; if(btnInstall)btnInstall.textContent='Reinstall Model';
  } else if(status==='installed'){
    s.textContent='Model installed • Ready to load'; if(wrap)wrap.classList.add('hidden'); if(install)install.classList.add('hidden'); if(chat)chat.classList.remove('hidden');
    if(btnGet)btnGet.textContent='Get Model Again'; if(btnInstall)btnInstall.textContent='Load / Reinstall';
  } else if(status==='not_installed'){
    s.textContent='Model not installed'; s.dataset.state='warning'; if(wrap)wrap.classList.add('hidden'); if(install)install.classList.remove('hidden'); if(chat)chat.classList.add('hidden');
    if(btnGet)btnGet.textContent='Get Qwen Model'; if(btnInstall)btnInstall.textContent='Install Model';
  } else if(status==='error'){
    s.textContent=d.message||'AI error'; s.dataset.state='error'; if(install)install.classList.remove('hidden'); if(chat)chat.classList.add('hidden');
  }
}
function appendMessage(role,text){
  const box=aiMessages(); if(!box)return;
  const row=document.createElement('div'); row.className='ai-message '+role;
  row.innerHTML=`<div class="ai-message-bubble">${escAi(text).replace(/\n/g,'<br>')}</div>`;
  box.appendChild(row); box.scrollTop=box.scrollHeight;
}
function finishAIRequest(d){
  const item=pending.get(d.id); if(!item)return;
  pending.delete(d.id); item.busy=false;
  if(d.ok) appendMessage('assistant',d.text||''); else appendMessage('assistant',`Error: ${d.error||'Inference failed.'}`);
  const send=document.getElementById('ai-send'); if(send)send.disabled=false;
}
function sendAI(){
  const input=aiInput(); if(!input)return; const text=input.value.trim(); if(!text)return;
  if(!nativeAvailable()){appendMessage('assistant','Native local AI is available only inside the Android app.');return;}
  const id='ai-'+(++requestSeq); input.value=''; appendMessage('user',text);
  const send=document.getElementById('ai-send'); if(send)send.disabled=true;
  pending.set(id,{busy:true});
  try{
    window.AndroidAI.ask(id,text,'You are the private local AI assistant inside MyBusiness. Answer clearly and briefly. Do not claim to access data, perform actions, or use the internet unless the app explicitly provides that context.');
  }catch(e){pending.delete(id);if(send)send.disabled=false;appendMessage('assistant',e.message||'Could not start local AI.');}
}

export function renderAI(container){
  container.innerHTML=`
  <section id="ai-page" class="ai-page">
    <div class="ai-hero">
      <div class="ai-orb"><i class="fas fa-robot"></i></div>
      <div><span class="eyebrow">PRIVATE • ON DEVICE</span><h2>Qwen AI</h2><p>Local AI for MyBusiness. Your prompts are processed by the model stored on this device.</p></div>
    </div>
    <div class="ai-status-card">
      <div><span class="ai-label">MODEL STATUS</span><strong id="ai-status">Checking model...</strong><small>Qwen3 0.6B • Q4_0 • ~429 MB</small></div>
      <span class="ai-local-badge"><i class="fas fa-lock"></i> Offline</span>
    </div>
    <div id="ai-install-card" class="card ai-install-card hidden">
      <div class="ai-install-icon"><i class="fas fa-microchip"></i></div>
      <h3>Local AI model required</h3>
      <p>Download the GGUF file yourself, then import it here. MyBusiness never downloads Qwen automatically.</p>
      <div class="ai-steps"><div><b>1</b><span>Get the official GGUF file</span></div><div><b>2</b><span>Return to MyBusiness</span></div><div><b>3</b><span>Tap Install Model and select it</span></div></div>
      <div class="ai-install-actions"><button id="ai-get-model" class="btn" type="button">Get Qwen Model</button><button id="ai-install-model" class="btn btn-secondary" type="button">Install Model</button></div>
    </div>
    <div id="ai-progress-wrap" class="ai-progress-card hidden"><div class="ai-progress-top"><strong id="ai-progress-text">Installing Qwen3 0.6B — 0%</strong><span>Actual file bytes</span></div><div class="ai-progress-track"><div id="ai-progress-bar" class="ai-progress-bar"></div></div></div>
    <section id="ai-chat-area" class="ai-chat-area hidden">
      <div id="ai-messages" class="ai-messages"><div class="ai-empty"><i class="fas fa-comment-dots"></i><strong>AI is ready</strong><span>Ask a question to start a private offline conversation.</span></div></div>
      <div class="ai-compose"><textarea id="ai-input" rows="2" placeholder="Ask Qwen something..." aria-label="Ask Qwen"></textarea><button id="ai-send" class="btn" type="button"><i class="fas fa-paper-plane"></i> Send</button></div>
    </section>
  </section>`;

  const get=document.getElementById('ai-get-model'); const install=document.getElementById('ai-install-model'); const send=document.getElementById('ai-send'); const input=document.getElementById('ai-input');
  get.onclick=()=>nativeAvailable()?AndroidAI.openModelDownloadPage():setAIError('Open this page inside the MyBusiness Android app to install local Qwen.');
  install.onclick=()=>nativeAvailable()?AndroidAI.openModelPicker():setAIError('Open this page inside the MyBusiness Android app to install local Qwen.');
  send.onclick=sendAI;
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAI();}});
  initialized=true;
  if(nativeAvailable()){
    try{const status=JSON.parse(AndroidAI.status()); updateAIState(status); if(status.installed)AndroidAI.load();}
    catch(e){setAIError('Could not read the local AI status.');}
  } else { updateAIState({status:'not_installed'}); }
}
