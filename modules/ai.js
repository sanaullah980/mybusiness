import { handleAgentCommand, agentContext } from './ai-agent.js';

let requestSeq = 0;
let pending = new Map();
let chatHistory=[];
let qwenReady=false;
let whisperReady=false;
let voiceRecording=false;
let voiceLocked=false;
let voicePointerId=null;
let voiceStartY=0;
let voiceMovedUp=false;
let voiceIgnoreClick=false;
let voiceTimer=null;
let voiceStartedAt=0;
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
function whisperAvailable(){ return !!(window.AndroidWhisper && window.__MYBUSINESS_NATIVE_WHISPER__); }
function updateCombinedAIAvailability(){
  const chat=document.getElementById('ai-chat-area');
  const ready=qwenReady && whisperReady;
  if(chat) chat.classList.toggle('hidden',!ready);
  const s=aiStatusEl();
  if(!s || !nativeAvailable() || ready) return;
  if(!qwenReady) s.textContent='Qwen model required';
  else if(!whisperReady) s.textContent='Whisper model required';
}
function openWhisperDownload(){
  if(whisperAvailable()){ try { window.AndroidWhisper.openModelDownloadPage(); return; } catch (_) {} }
  const opened=window.open('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true','_blank','noopener,noreferrer'); if(!opened)window.location.assign('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true');
}
function openQwenDownload(){
  if(nativeAvailable()){ try { window.AndroidAI.openModelDownloadPage(); return; } catch (_) {} }
  const opened=window.open(QWEN_DOWNLOAD_URL,'_blank','noopener,noreferrer'); if(!opened)window.location.assign(QWEN_DOWNLOAD_URL);
}
function escAi(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function fmtMb(bytes){return `${(Number(bytes||0)/1024/1024).toFixed(0)} MB`;}
window.NativeAI=window.NativeAI||{};
window.NativeAI._event=(kind,raw)=>{let d={};try{d=JSON.parse(raw||'{}')}catch(_){d={message:raw};}if(kind==='state')updateAIState(d);if(kind==='install')updateAIProgress(d);if(kind==='result')finishAIRequest(d);if(kind==='error')setAIError(d.message||'AI error');if(kind==='webError')setAIError('The app page could not be loaded.');};
window.NativeWhisper=window.NativeWhisper||{};
window.NativeWhisper._event=(kind,raw)=>{let d={};try{d=JSON.parse(raw||'{}')}catch(_){d={message:raw};}
 const s=document.getElementById('whisper-status'), p=document.getElementById('whisper-progress-wrap'), bar=document.getElementById('whisper-progress-bar'), txt=document.getElementById('whisper-progress-text');
 if(kind==='install'){const pct=Math.max(0,Math.min(100,Number(d.percent)));if(bar&&Number.isFinite(pct))bar.style.width=pct+'%';if(txt)txt.textContent=(d.percent>=0)?`Installing Whisper base — ${pct}% • ${fmtMb(d.bytes)} / ${fmtMb(d.total)}`:`Installing Whisper base • ${fmtMb(d.bytes)}`;p?.classList.remove('hidden');return;}
 if(kind==='state'){if(s)s.textContent=d.message||d.status||'Whisper';
  // The install/copy progress bar only makes sense while we're still checking,
  // verifying or loading the picked file. Any other status means that phase is
  // over (success OR failure) — leaving it visible after a failure is what made
  // a failed install look like it was "stuck at 100%" with no explanation.
  const inProgress=(d.status==='checking'||d.status==='verifying'||d.status==='loading');
  if(!inProgress)p?.classList.add('hidden');
  if(d.status==='ready'){whisperReady=true;document.getElementById('whisper-card')?.classList.add('hidden');}else if(d.status==='installed'){whisperReady=false;}else if(d.status==='not_installed'){whisperReady=false;document.getElementById('whisper-card')?.classList.remove('hidden');}else if(d.status==='error'){whisperReady=false;if(s)s.dataset.state='error';document.getElementById('whisper-card')?.classList.remove('hidden');}else if(d.status==='recording'){
  voiceRecording=true;
  const voice=document.getElementById('ai-voice-btn');
  voice?.classList.add('active');
  if(voiceLocked) voice?.classList.add('locked');
}else if(d.status==='transcribing'){
  voiceRecording=false;
  voiceLocked=false;
  const voice=document.getElementById('ai-voice-btn');
  voice?.classList.remove('active','locked');
  voice?.classList.add('transcribing');
  if(voice){voice.innerHTML='<i class="fas fa-spinner"></i><span class="ai-voice-processing">Processing…</span>';voice.title='Processing speech…';voice.setAttribute('aria-label','Processing speech');}
}updateCombinedAIAvailability();return;}
 if(kind==='result'){
  const text=String(d.text||'').trim();
  voiceRecording=false;
  voiceLocked=false;
  const voice=document.getElementById('ai-voice-btn');
  voice?.classList.remove('active','locked','transcribing');
  clearInterval(voiceTimer);voiceTimer=null;
  if(voice){voice.innerHTML='<i class="fas fa-microphone"></i>';voice.title='Hold to speak • Swipe up to lock';voice.setAttribute('aria-label','Hold to speak');}
  if(text){
    const input=aiInput();
    if(input){
      input.value=text;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.focus();
      try{ input.setSelectionRange(input.value.length,input.value.length); }catch(_){}
      setTimeout(()=>{ try{ input.focus(); input.scrollIntoView({block:'nearest',behavior:'smooth'}); }catch(_){} },80);
    }
  }
  return;
}
 if(kind==='error'){
  voiceRecording=false;
  voiceLocked=false;
  const voice=document.getElementById('ai-voice-btn');
  voice?.classList.remove('active','locked','transcribing');
  clearInterval(voiceTimer);voiceTimer=null;
  if(voice){voice.innerHTML='<i class="fas fa-microphone"></i>';voice.title='Hold to speak • Swipe up to lock';voice.setAttribute('aria-label','Hold to speak');}
  p?.classList.add('hidden');
  if(s){s.textContent=d.message||'Voice error';s.dataset.state='error';}
}
};
function aiStatusEl(){return document.getElementById('ai-status');} function aiProgressWrap(){return document.getElementById('ai-progress-wrap');} function aiProgressBar(){return document.getElementById('ai-progress-bar');} function aiProgressText(){return document.getElementById('ai-progress-text');} function aiMessages(){return document.getElementById('ai-messages');} function aiInput(){return document.getElementById('ai-input');}
function setAIError(message){const s=aiStatusEl();if(s){s.textContent=message;s.dataset.state='error';}}
function updateAIProgress(d){const p=Math.max(0,Math.min(100,Number(d.percent||0))),bar=aiProgressBar(),text=aiProgressText(),wrap=aiProgressWrap();if(bar)bar.style.width=p+'%';if(text)text.textContent=`Installing Qwen3 0.6B — ${p}% • ${fmtMb(d.bytes)} / ${fmtMb(d.total)}`;if(wrap)wrap.classList.remove('hidden');}
function updateAIState(d){const status=d.status||'',s=aiStatusEl(),wrap=aiProgressWrap();if(status==='ready')qwenReady=true;else if(status==='not_installed'||status==='error'||status==='checking'||status==='verifying'||status==='loading')qwenReady=false;if(!s)return;const bg=document.getElementById('ai-get-model'),bi=document.getElementById('ai-install-model'),chat=document.getElementById('ai-chat-area'),install=document.getElementById('ai-install-card');if(status==='checking')s.textContent='Checking model...';else if(status==='verifying'){s.textContent='Verifying model...';wrap?.classList.remove('hidden');}else if(status==='loading'){s.textContent='Loading Qwen AI...';wrap?.classList.remove('hidden');}else if(status==='ready'){s.textContent='AI Ready • Local / Offline';s.dataset.state='ready';wrap?.classList.add('hidden');install?.classList.add('hidden');if(bg)bg.textContent='Get Model Again';if(bi)bi.textContent='Reinstall Model';}else if(status==='installed'){s.textContent='Model installed • Ready to load';wrap?.classList.add('hidden');install?.classList.add('hidden');}else if(status==='not_installed'){s.textContent='Model not installed';s.dataset.state='warning';wrap?.classList.add('hidden');install?.classList.remove('hidden');chat?.classList.add('hidden');}else if(status==='error'){s.textContent=d.message||'AI error';s.dataset.state='error';wrap?.classList.add('hidden');install?.classList.remove('hidden');chat?.classList.add('hidden');}updateCombinedAIAvailability();}
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
 container.innerHTML=`<section id="ai-page" class="ai-page"><div class="ai-hero"><div class="ai-orb"><i class="fas fa-robot"></i></div><div><span class="eyebrow">PRIVATE • ON DEVICE</span><h2>MyBusiness AI Agent</h2><p>Qwen runs locally. Common MyBusiness commands are executed by the app agent; Qwen handles conversation and requests that do not require a tool.</p></div><button id="ai-clear-chat" class="btn btn-secondary" type="button" title="Clear chat"><i class="fas fa-trash"></i></button></div><div class="ai-status-card"><div><span class="ai-label">MODEL STATUS</span><strong id="ai-status">Checking model...</strong><small>Qwen3 0.6B • Q4_0 • ~429 MB</small></div><span class="ai-local-badge"><i class="fas fa-lock"></i> Offline</span></div><div id="ai-install-card" class="card ai-install-card hidden"><div class="ai-install-icon"><i class="fas fa-microchip"></i></div><h3>Local AI model required</h3><p>Download the verified GGUF file, then import it here. MyBusiness never downloads Qwen automatically.</p><div class="ai-steps"><div><b>1</b><span>Get the official GGUF file</span></div><div><b>2</b><span>Return to MyBusiness</span></div><div><b>3</b><span>Tap Install Model</span></div></div><div class="ai-install-actions"><button id="ai-get-model" class="btn" type="button">Get Qwen Model</button><button id="ai-install-model" class="btn btn-secondary" type="button">Install Model</button></div></div><div id="whisper-card" class="card ai-install-card hidden"><div class="ai-install-icon"><i class="fas fa-microphone"></i></div><h3>Local voice model required</h3><p>Whisper runs on this Android device. Download the verified multilingual base model, then import it here. Audio stays on the device.</p><div class="ai-steps"><div><b>1</b><span>Get the official Whisper model</span></div><div><b>2</b><span>Return to MyBusiness</span></div><div><b>3</b><span>Tap Install Voice Model</span></div></div><div class="ai-install-actions"><button id="whisper-get-model" class="btn" type="button">Get Whisper Model</button><button id="whisper-install-model" class="btn btn-secondary" type="button">Install Voice Model</button></div><strong id="whisper-status" style="display:block;margin-top:10px">Checking voice model...</strong></div><div id="whisper-progress-wrap" class="ai-progress-card hidden"><div class="ai-progress-top"><strong id="whisper-progress-text">Installing Whisper base — 0%</strong><span>Actual file bytes</span></div><div class="ai-progress-track"><div id="whisper-progress-bar" class="ai-progress-bar"></div></div></div><div id="ai-progress-wrap" class="ai-progress-card hidden"><div class="ai-progress-top"><strong id="ai-progress-text">Installing Qwen3 0.6B — 0%</strong><span>Actual file bytes</span></div><div class="ai-progress-track"><div id="ai-progress-bar" class="ai-progress-bar"></div></div></div><section id="ai-chat-area" class="ai-chat-area hidden"><div id="ai-messages" class="ai-messages"><div class="ai-empty"><i class="fas fa-robot"></i><strong>AI agent is ready</strong><span>Try: “Ali se 500 receive kiye”, “Coke stock mein 10 add karo”, or “aaj ki sales batao”.</span></div></div><div class="ai-compose" style="grid-template-columns:1fr auto auto"><textarea id="ai-input" rows="2" placeholder="English, Urdu or Roman Urdu…" aria-label="Ask MyBusiness AI"></textarea><button id="ai-voice-btn" class="btn btn-secondary ai-voice-btn" type="button" title="Hold to speak • Swipe up to lock" aria-label="Hold to speak"><i class="fas fa-microphone"></i></button><button id="ai-send" class="btn" type="button"><i class="fas fa-paper-plane"></i> Send</button></div></section></section>`;
 const get=document.getElementById('ai-get-model'),install=document.getElementById('ai-install-model'),send=document.getElementById('ai-send'),input=document.getElementById('ai-input'),wg=document.getElementById('whisper-get-model'),wi=document.getElementById('whisper-install-model'),voice=document.getElementById('ai-voice-btn');get.onclick=openQwenDownload;install.onclick=()=>nativeAvailable()?AndroidAI.openModelPicker():setAIError('Model installation is available in the Android app.');wg.onclick=openWhisperDownload;wi.onclick=()=>whisperAvailable()?AndroidWhisper.openModelPicker():setAIError('Voice model installation is available in the Android app.');send.onclick=sendAI;

 // WhatsApp-style voice control:
 // - press and hold = record
 // - release = stop + transcribe
 // - swipe upward while holding = lock recording
 // - tap the locked mic = stop + transcribe
 const startVoice=()=>{
   if(!whisperAvailable()) return setAIError('Voice commands are available in the Android app.');
   voiceRecording=true;
   voiceLocked=false;
   voiceMovedUp=false;
   voice.classList.remove('transcribing','locked');
   voice.classList.add('active');
   voice.innerHTML='<i class="fas fa-microphone"></i><span class="ai-voice-live">0:00</span>';
   voice.title='Release to stop • Swipe up to lock';
   voice.setAttribute('aria-label','Recording • Release to stop');
   voiceStartedAt=Date.now();
   clearInterval(voiceTimer);
   voiceTimer=setInterval(()=>{
     if(!voiceRecording){clearInterval(voiceTimer);voiceTimer=null;return;}
     const secs=Math.floor((Date.now()-voiceStartedAt)/1000);
     const mins=Math.floor(secs/60), rem=String(secs%60).padStart(2,'0');
     const live=voice.querySelector('.ai-voice-live');
     if(live) live.textContent=`${mins}:${rem}`;
   },250);
   try{ AndroidWhisper.startRecording(); }catch(e){
     voiceRecording=false;
     voice.classList.remove('active');
     setAIError(e.message||'Could not start microphone.');
   }
 };
 const stopVoice=()=>{
   if(!voiceRecording) return;
   voiceRecording=false;
   voiceLocked=false;
   voice.classList.remove('active','locked');
   clearInterval(voiceTimer);
   voiceTimer=null;
   voice.classList.add('transcribing');
   voice.innerHTML='<i class="fas fa-spinner"></i><span class="ai-voice-processing">Processing…</span>';
   voice.title='Processing speech…';
   voice.setAttribute('aria-label','Processing speech');
   try{ AndroidWhisper.stopRecording(); }catch(e){ setAIError(e.message||'Could not stop microphone.'); }
 };
 voice.addEventListener('pointerdown',e=>{
   if(!whisperAvailable()) return;
   e.preventDefault();
   if(voiceLocked && voiceRecording){
     voiceIgnoreClick=true;
     stopVoice();
     return;
   }
   voicePointerId=e.pointerId;
   voiceStartY=e.clientY;
   voiceMovedUp=false;
   voiceIgnoreClick=true;
   try{voice.setPointerCapture(e.pointerId);}catch(_){}
   startVoice();
 });
 voice.addEventListener('pointermove',e=>{
   if(!voiceRecording || voiceLocked || e.pointerId!==voicePointerId) return;
   const deltaY=voiceStartY-e.clientY;
   if(deltaY>=70){
     voiceLocked=true;
     voiceMovedUp=true;
     voice.classList.add('locked');
     const elapsed=Math.max(0,Math.floor((Date.now()-voiceStartedAt)/1000));
     const mins=Math.floor(elapsed/60), rem=String(elapsed%60).padStart(2,'0');
     voice.innerHTML=`<i class="fas fa-lock"></i><span class="ai-voice-live">${mins}:${rem}</span>`;
     voice.title='Locked recording • Tap to stop';
     voice.setAttribute('aria-label','Locked recording • Tap to stop');
     if(navigator.vibrate) try{navigator.vibrate(20);}catch(_){}
   }
 });
 const releaseVoice=e=>{
   if(e.pointerId!==voicePointerId) return;
   try{voice.releasePointerCapture(e.pointerId);}catch(_){}
   voicePointerId=null;
   if(!voiceLocked) stopVoice();
 };
 voice.addEventListener('pointerup',releaseVoice);
 voice.addEventListener('pointercancel',e=>{
   if(e.pointerId===voicePointerId){voicePointerId=null;if(!voiceLocked) stopVoice();}
 });
 voice.addEventListener('click',e=>{
   e.preventDefault();
   if(voiceIgnoreClick){voiceIgnoreClick=false;return;}
   if(voiceLocked && voiceRecording) stopVoice();
 });
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAI();}});
 document.getElementById('ai-clear-chat').onclick=clearAIChat;
 if(chatHistory.length){const box=aiMessages();if(box){box.innerHTML='';chatHistory.forEach(m=>appendMessage(m.role,m.text,true));}}
 if(nativeAvailable()){try{const status=JSON.parse(AndroidAI.status());updateAIState(status);if(status.installed)AndroidAI.load();}catch(e){setAIError('Could not read local AI status.');}}else updateAIState({status:'not_installed'});
 const whisperCard=document.getElementById('whisper-card');if(whisperAvailable()){whisperCard?.classList.remove('hidden');try{const ws=JSON.parse(AndroidWhisper.status());whisperReady=!!ws.ready;document.getElementById('whisper-status').textContent=ws.ready?'Whisper Ready • Local / Offline':(ws.installed?'Voice model installed • Ready to load':'Voice model not installed');if(ws.installed)AndroidWhisper.load();}catch(e){document.getElementById('whisper-status').textContent='Could not read voice model status.';}}else{whisperReady=false;whisperCard?.classList.remove('hidden');document.getElementById('whisper-status').textContent='Install voice model from the Android app.';}updateCombinedAIAvailability();
}