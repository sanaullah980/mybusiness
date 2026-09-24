import { handleAgentCommand, agentContext } from './ai-agent.js';

let requestSeq = 0;
let pending = new Map();
let chatHistory=[];
try{ chatHistory = JSON.parse(localStorage.getItem('mybusiness-ai-chat')||'[]'); }catch(_){ chatHistory = []; }
function saveChatHistory(){ try{ localStorage.setItem('mybusiness-ai-chat', JSON.stringify(chatHistory)); }catch(_){} }
export function clearAIChat(){
  if(!confirm('Clear this chat? This cannot be undone.'))return;
  chatHistory=[];
  saveChatHistory();
  const box=aiMessages();
  if(box)box.innerHTML='<div class="ai-empty"><i class="fas fa-robot"></i><strong>AI agent is ready</strong><span>Try: "Ali se 500 receive kiye", "Coke stock mein 10 add karo", or "aaj ki sales batao".</span></div>';
}
const QWEN_DOWNLOAD_URL = 'https://huggingface.co/ggml-org/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_0.gguf?download=true';
function nativeAvailable(){ return !!(window.AndroidAI && window.__MYBUSINESS_NATIVE_AI__); }
function openQwenDownload(){
  if(nativeAvailable()){ try { window.AndroidAI.openModelDownloadPage(); return; } catch (_) {} }
  const opened=window.open(QWEN_DOWNLOAD_URL,'_blank','noopener,noreferrer'); if(!opened)window.location.assign(QWEN_DOWNLOAD_URL);
}
function escAi(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function fmtMb(bytes){return `${(Number(bytes||0)/1024/1024).toFixed(0)} MB`;}
window.NativeAI=window.NativeAI||{};
window.NativeAI._event=(kind,raw)=>{let d={};try{d=JSON.parse(raw||'{}')}catch(_){d={message:raw};}if(kind==='state')updateAIState(d);if(kind==='install')updateAIProgress(d);if(kind==='result')finishAIRequest(d);if(kind==='error')setAIError(d.message||'AI error');if(kind==='webError')setAIError('The app page could not be loaded.');};
function aiStatusEl(){return document.getElementById('ai-status');} function aiProgressWrap(){return document.getElementById('ai-progress-wrap');} function aiProgressBar(){return document.getElementById('ai-progress-bar');} function aiProgressText(){return document.getElementById('ai-progress-text');} function aiMessages(){return document.getElementById('ai-messages');} function aiInput(){return document.getElementById('ai-input');}
function setAIError(message){const s=aiStatusEl();if(s){s.textContent=message;s.dataset.state='error';}}
function updateAIProgress(d){const p=Math.max(0,Math.min(100,Number(d.percent||0))),bar=aiProgressBar(),text=aiProgressText(),wrap=aiProgressWrap();if(bar)bar.style.width=p+'%';if(text)text.textContent=`Installing Qwen3 0.6B — ${p}% • ${fmtMb(d.bytes)} / ${fmtMb(d.total)}`;if(wrap)wrap.classList.remove('hidden');}
function updateAIState(d){const status=d.status||'',s=aiStatusEl(),wrap=aiProgressWrap();if(!s)return;const bg=document.getElementById('ai-get-model'),bi=document.getElementById('ai-install-model'),chat=document.getElementById('ai-chat-area'),install=document.getElementById('ai-install-card');if(status==='checking')s.textContent='Checking model...';else if(status==='verifying'){s.textContent='Verifying model...';wrap?.classList.remove('hidden');}else if(status==='loading'){s.textContent='Loading Qwen AI...';wrap?.classList.remove('hidden');}else if(status==='ready'){s.textContent='AI Ready • Local / Offline';s.dataset.state='ready';wrap?.classList.add('hidden');install?.classList.add('hidden');chat?.classList.remove('hidden');if(bg)bg.textContent='Get Model Again';if(bi)bi.textContent='Reinstall Model';}else if(status==='installed'){s.textContent='Model installed • Ready to load';wrap?.classList.add('hidden');install?.classList.add('hidden');chat?.classList.remove('hidden');}else if(status==='not_installed'){s.textContent='Model not installed';s.dataset.state='warning';wrap?.classList.add('hidden');install?.classList.remove('hidden');chat?.classList.add('hidden');}else if(status==='error'){s.textContent=d.message||'AI error';s.dataset.state='error';install?.classList.remove('hidden');chat?.classList.add('hidden');}}
function appendConfirmation(text, onYes, onNo) {
  const box = aiMessages();
  if (!box) return;

  box.querySelector('.ai-empty')?.remove();

  const row = document.createElement('div');
  row.className = 'ai-message assistant';

  const bubble = document.createElement('div');
  bubble.className = 'ai-message-bubble';

  const message = document.createElement('div');
  message.innerHTML = escAi(text).replace(/\n/g, '<br>');

  const actions = document.createElement('div');
  actions.className = 'ai-confirm-actions';

  const yesBtn = document.createElement('button');
  yesBtn.type = 'button';
  yesBtn.className = 'btn ai-confirm-yes';
  yesBtn.textContent = 'Yes';

  const noBtn = document.createElement('button');
  noBtn.type = 'button';
  noBtn.className = 'btn btn-secondary ai-confirm-no';
  noBtn.textContent = 'No';

  actions.appendChild(yesBtn);
  actions.appendChild(noBtn);

  bubble.appendChild(message);
  bubble.appendChild(actions);
  row.appendChild(bubble);
  box.appendChild(row);

  box.scrollTop = box.scrollHeight;

  yesBtn.onclick = async () => {
    yesBtn.disabled = true;
    noBtn.disabled = true;
    await onYes?.();
  };

  noBtn.onclick = async () => {
    yesBtn.disabled = true;
    noBtn.disabled = true;
    await onNo?.();
  };
}
function appendMessage(role,text,skipSave){const box=aiMessages();if(!box)return;box.querySelector('.ai-empty')?.remove();const row=document.createElement('div');row.className='ai-message '+role;row.innerHTML=`<div class="ai-message-bubble">${escAi(text).replace(/\n/g,'<br>')}</div>`;box.appendChild(row);box.scrollTop=box.scrollHeight;if(!skipSave){chatHistory.push({role,text});saveChatHistory();}}
function finishAIRequest(d){const item=pending.get(d.id);if(!item)return;pending.delete(d.id);if(d.ok)appendMessage('assistant',d.text||'');else appendMessage('assistant',`Error: ${d.error||'Inference failed.'}`);const send=document.getElementById('ai-send');if(send)send.disabled=false;}
async function sendAI(){
  const input=aiInput();if(!input)return;const text=input.value.trim();if(!text)return;input.value='';appendMessage('user',text);
  const send=document.getElementById('ai-send');if(send)send.disabled=true;
  try{
    // Deterministic agent handles common MyBusiness operations first. This is what
    // lets a 0.6B model operate the app instead of merely chatting.
    const local=await handleAgentCommand(text);
    if(local.handled){appendMessage('assistant',local.text);if(send)send.disabled=false;return;}
  }catch(e){appendMessage('assistant',`Agent error: ${e.message||e}`);if(send)send.disabled=false;return;}
  if(!nativeAvailable()){appendMessage('assistant','Local Qwen AI is available inside the Android app.');if(send)send.disabled=false;return;}
  const id='ai-'+(++requestSeq);pending.set(id,{busy:true});
  const system=`You are MyBusiness local assistant. Use concise English or Roman Urdu/Urdu matching the user. You are NOT allowed to invent database actions. Common business actions are handled by the deterministic agent before you. If a request needs an unsupported action, explain that clearly. ${agentContext()} Keep answers short. Do not use the internet. /no_think`;
  try{window.AndroidAI.ask(id,`User request: ${text}\n\n${agentContext()}`,system);}catch(e){pending.delete(id);if(send)send.disabled=false;appendMessage('assistant',e.message||'Could not start local AI.');}
}
export function renderAI(container){
 container.innerHTML=`<section id="ai-page" class="ai-page"><div class="ai-hero"><div class="ai-orb"><i class="fas fa-robot"></i></div><div><span class="eyebrow">PRIVATE • ON DEVICE</span><h2>MyBusiness AI Agent</h2><p>Qwen runs locally. Common MyBusiness commands are executed by the app agent; Qwen handles conversation and requests that do not require a tool.</p></div><button id="ai-clear-chat" class="btn btn-secondary" type="button" title="Clear chat"><i class="fas fa-trash"></i></button></div><div class="ai-status-card"><div><span class="ai-label">MODEL STATUS</span><strong id="ai-status">Checking model...</strong><small>Qwen3 0.6B • Q4_0 • ~429 MB</small></div><span class="ai-local-badge"><i class="fas fa-lock"></i> Offline</span></div><div id="ai-install-card" class="card ai-install-card hidden"><div class="ai-install-icon"><i class="fas fa-microchip"></i></div><h3>Local AI model required</h3><p>Download the verified GGUF file, then import it here. MyBusiness never downloads Qwen automatically.</p><div class="ai-steps"><div><b>1</b><span>Get the official GGUF file</span></div><div><b>2</b><span>Return to MyBusiness</span></div><div><b>3</b><span>Tap Install Model</span></div></div><div class="ai-install-actions"><button id="ai-get-model" class="btn" type="button">Get Qwen Model</button><button id="ai-install-model" class="btn btn-secondary" type="button">Install Model</button></div></div><div id="ai-progress-wrap" class="ai-progress-card hidden"><div class="ai-progress-top"><strong id="ai-progress-text">Installing Qwen3 0.6B — 0%</strong><span>Actual file bytes</span></div><div class="ai-progress-track"><div id="ai-progress-bar" class="ai-progress-bar"></div></div></div><section id="ai-chat-area" class="ai-chat-area hidden"><div id="ai-messages" class="ai-messages"><div class="ai-empty"><i class="fas fa-robot"></i><strong>AI agent is ready</strong><span>Try: “Ali se 500 receive kiye”, “Coke stock mein 10 add karo”, or “aaj ki sales batao”.</span></div></div><div class="ai-compose"><textarea id="ai-input" rows="2" placeholder="English, Urdu or Roman Urdu…" aria-label="Ask MyBusiness AI"></textarea><button id="ai-send" class="btn" type="button"><i class="fas fa-paper-plane"></i> Send</button></div></section></section>`;
 const get=document.getElementById('ai-get-model'),install=document.getElementById('ai-install-model'),send=document.getElementById('ai-send'),input=document.getElementById('ai-input');get.onclick=openQwenDownload;install.onclick=()=>nativeAvailable()?AndroidAI.openModelPicker():setAIError('Model installation is available in the Android app.');send.onclick=sendAI;input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAI();}});
 document.getElementById('ai-clear-chat').onclick=clearAIChat;
 if(chatHistory.length){const box=aiMessages();if(box){box.innerHTML='';chatHistory.forEach(m=>appendMessage(m.role,m.text,true));}}
 if(nativeAvailable()){try{const status=JSON.parse(AndroidAI.status());updateAIState(status);if(status.installed)AndroidAI.load();}catch(e){setAIError('Could not read local AI status.');}}else updateAIState({status:'not_installed'});
}