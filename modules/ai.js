import { handleAgentCommand, agentContext } from './ai-agent.js';

let requestSeq = 0;
let pending = new Map();
let chatHistory = [];
let activeInstallModel = 'Qwen3 0.6B';
let voiceBusy = false;
let recording = false;

try {
  chatHistory = JSON.parse(localStorage.getItem('mybusiness-ai-chat') || '[]');
} catch (_) {
  chatHistory = [];
}

function saveChatHistory() {
  try {
    localStorage.setItem('mybusiness-ai-chat', JSON.stringify(chatHistory));
  } catch (_) {}
}

export function clearAIChat() {
  if (!confirm('Clear this chat? This cannot be undone.')) return;
  chatHistory = [];
  saveChatHistory();
  const box = aiMessages();
  if (box) {
    box.innerHTML =
      '<div class="ai-empty"><i class="fas fa-robot"></i><strong>AI agent is ready</strong><span>Try: "Ali se 500 receive kiye", "Coke stock mein 10 add karo", or "aaj ki sales batao".</span></div>';
  }
}

const QWEN_DOWNLOAD_URL =
  'https://huggingface.co/ggml-org/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_0.gguf?download=true';

const WHISPER_DOWNLOAD_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true';

function nativeAvailable() {
  return !!(window.AndroidAI && window.__MYBUSINESS_NATIVE_AI__);
}

function whisperAvailable() {
  return !!(window.AndroidWhisper && window.__MYBUSINESS_NATIVE_WHISPER__);
}

function openQwenDownload() {
  if (nativeAvailable()) {
    try {
      window.AndroidAI.openModelDownloadPage();
      return;
    } catch (_) {}
  }

  const opened = window.open(QWEN_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.assign(QWEN_DOWNLOAD_URL);
}

function openWhisperDownload() {
  if (whisperAvailable()) {
    try {
      window.AndroidWhisper.openModelDownloadPage();
      return;
    } catch (_) {}
  }

  const opened = window.open(WHISPER_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.assign(WHISPER_DOWNLOAD_URL);
}

function escAi(v) {
  return String(v ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

function fmtMb(bytes) {
  return `${(Number(bytes || 0) / 1024 / 1024).toFixed(0)} MB`;
}

window.NativeAI = window.NativeAI || {};
window.NativeAI._event = (kind, raw) => {
  let d = {};
  try {
    d = JSON.parse(raw || '{}');
  } catch (_) {
    d = { message: raw };
  }

  if (kind === 'state') updateAIState(d);
  if (kind === 'install') updateModelProgress('Qwen3 0.6B', d);
  if (kind === 'result') finishAIRequest(d);
  if (kind === 'error') setAIError(d.message || 'AI error');
  if (kind === 'webError') setAIError('The app page could not be loaded.');
};

window.NativeWhisper = window.NativeWhisper || {};
window.NativeWhisper._event = (kind, raw) => {
  let d = {};
  try {
    d = JSON.parse(raw || '{}');
  } catch (_) {
    d = { message: raw };
  }

  if (kind === 'state') updateWhisperState(d);
  if (kind === 'install') updateModelProgress('Whisper base', d);
  if (kind === 'result') finishWhisperResult(d);
  if (kind === 'error') {
    voiceBusy = false;
    recording = false;
    updateVoiceButton();
    setAIError(d.message || 'Voice recognition error');
  }
};

function aiStatusEl() {
  return document.getElementById('ai-status');
}

function whisperStatusEl() {
  return document.getElementById('whisper-status');
}

function aiProgressWrap() {
  return document.getElementById('ai-progress-wrap');
}

function aiProgressBar() {
  return document.getElementById('ai-progress-bar');
}

function aiProgressText() {
  return document.getElementById('ai-progress-text');
}

function aiMessages() {
  return document.getElementById('ai-messages');
}

function aiInput() {
  return document.getElementById('ai-input');
}

function setAIError(message) {
  const s = aiStatusEl();
  if (s) {
    s.textContent = message;
    s.dataset.state = 'error';
  }
}

function updateModelProgress(modelName, d) {
  activeInstallModel = modelName;
  const p = Math.max(0, Math.min(100, Number(d.percent || 0)));
  const bar = aiProgressBar();
  const text = aiProgressText();
  const wrap = aiProgressWrap();

  if (bar) bar.style.width = p + '%';
  if (text) {
    text.textContent =
      `Installing ${modelName} — ${p}% • ${fmtMb(d.bytes)} / ${fmtMb(d.total)}`;
  }
  if (wrap) wrap.classList.remove('hidden');
}

function setModelCard(cardId, statusId, installButtonId, status, readyText, installedText, notInstalledText) {
  const statusEl = document.getElementById(statusId);
  const card = document.getElementById(cardId);
  const install = document.getElementById(installButtonId);

  if (!statusEl) return;

  if (status === 'ready') {
    statusEl.textContent = readyText;
    statusEl.dataset.state = 'ready';
    card?.classList.add('hidden');
    if (install) install.textContent = 'Reinstall Model';
  } else if (status === 'installed') {
    statusEl.textContent = installedText;
    statusEl.dataset.state = 'ready';
    card?.classList.add('hidden');
  } else if (status === 'checking') {
    statusEl.textContent = 'Checking model...';
    statusEl.dataset.state = '';
  } else if (status === 'verifying') {
    statusEl.textContent = 'Verifying model...';
    statusEl.dataset.state = '';
  } else if (status === 'loading') {
    statusEl.textContent = `Loading ${activeInstallModel}...`;
    statusEl.dataset.state = '';
  } else if (status === 'recording') {
    statusEl.textContent = 'Listening...';
  } else if (status === 'transcribing') {
    statusEl.textContent = 'Understanding speech...';
  } else if (status === 'not_installed') {
    statusEl.textContent = notInstalledText;
    statusEl.dataset.state = 'warning';
    card?.classList.remove('hidden');
  } else if (status === 'error') {
    statusEl.textContent = notInstalledText;
    statusEl.dataset.state = 'error';
    card?.classList.remove('hidden');
  }
}

function updateAIState(d) {
  setModelCard(
    'ai-install-card',
    'ai-status',
    'ai-install-model',
    d.status || '',
    'Qwen Ready • Local / Offline',
    'Qwen installed • Ready to load',
    d.message || 'Qwen model not installed'
  );
  updateCombinedReadiness();
}

function updateWhisperState(d) {
  if (d.status === 'recording') recording = true;
  if (d.status === 'transcribing') voiceBusy = true;
  if (d.status === 'ready' || d.status === 'installed' || d.status === 'not_installed') {
    if (d.status !== 'transcribing') voiceBusy = false;
  }

  setModelCard(
    'whisper-install-card',
    'whisper-status',
    'whisper-install-model',
    d.status || '',
    'Whisper Ready • Local / Offline',
    'Whisper installed • Ready to use',
    d.message || 'Whisper model not installed'
  );

  if (d.status === 'ready') {
    aiProgressWrap()?.classList.add('hidden');
  }

  updateVoiceButton();
  updateCombinedReadiness();
}

function getQwenStatus() {
  if (!nativeAvailable()) return { installed: false, ready: false, status: 'not_installed' };
  try {
    return JSON.parse(window.AndroidAI.status());
  } catch (_) {
    return { installed: false, ready: false, status: 'error' };
  }
}

function getWhisperStatus() {
  if (!whisperAvailable()) return { installed: false, ready: false, status: 'not_installed' };
  try {
    return JSON.parse(window.AndroidWhisper.status());
  } catch (_) {
    return { installed: false, ready: false, status: 'error' };
  }
}

function bothModelsInstalled() {
  const q = getQwenStatus();
  const w = getWhisperStatus();
  return !!q.installed && !!w.installed;
}

function bothModelsReady() {
  const q = getQwenStatus();
  const w = getWhisperStatus();
  return !!q.ready && !!w.ready;
}

function updateCombinedReadiness() {
  const q = getQwenStatus();
  const w = getWhisperStatus();
  const ready = !!q.ready && !!w.ready;
  const chat = document.getElementById('ai-chat-area');
  const gate = document.getElementById('ai-model-gate');
  const progress = aiProgressWrap();

  if (ready) {
    gate?.classList.add('hidden');
    chat?.classList.remove('hidden');
  } else {
    gate?.classList.remove('hidden');
    chat?.classList.add('hidden');
  }

  if (q.ready && w.ready) progress?.classList.add('hidden');
}

function updateVoiceButton() {
  const btn = document.getElementById('ai-voice');
  if (!btn) return;

  if (recording) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-stop"></i> Stop';
    btn.dataset.recording = 'true';
  } else if (voiceBusy) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing';
    btn.dataset.recording = 'false';
  } else {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-microphone"></i> Speak';
    btn.dataset.recording = 'false';
  }
}

function appendMessage(role, text, skipSave) {
  const box = aiMessages();
  if (!box) return;

  box.querySelector('.ai-empty')?.remove();

  const row = document.createElement('div');
  row.className = 'ai-message ' + role;
  row.innerHTML =
    `<div class="ai-message-bubble">${escAi(text).replace(/\n/g, '<br>')}</div>`;

  box.appendChild(row);
  box.scrollTop = box.scrollHeight;

  if (!skipSave) {
    chatHistory.push({ role, text });
    saveChatHistory();
  }
}

function finishAIRequest(d) {
  const item = pending.get(d.id);
  if (!item) return;

  pending.delete(d.id);

  if (d.ok) {
    appendMessage('assistant', d.text || '');
  } else {
    appendMessage('assistant', `Error: ${d.error || 'Inference failed.'}`);
  }

  const send = document.getElementById('ai-send');
  if (send) send.disabled = false;
}

function finishWhisperResult(d) {
  voiceBusy = false;
  recording = false;
  updateVoiceButton();

  const text = String(d.text || '').trim();
  if (!text) {
    setAIError('No speech was understood. Please try again.');
    return;
  }

  const input = aiInput();
  if (input) input.value = text;

  // Voice text goes through exactly the same agent/Qwen pipeline as typed text.
  sendAI();
}

async function sendAI() {
  if (!bothModelsInstalled() || !bothModelsReady()) {
    setAIError('Both Qwen and Whisper models must be installed and loaded before using MyBusiness AI.');
    updateCombinedReadiness();
    return;
  }

  const input = aiInput();
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  appendMessage('user', text);

  const send = document.getElementById('ai-send');
  if (send) send.disabled = true;

  try {
    // Deterministic agent handles common MyBusiness operations first.
    const local = await handleAgentCommand(text);
    if (local.handled) {
      appendMessage('assistant', local.text);
      if (send) send.disabled = false;
      return;
    }
  } catch (e) {
    appendMessage('assistant', `Agent error: ${e.message || e}`);
    if (send) send.disabled = false;
    return;
  }

  if (!nativeAvailable()) {
    appendMessage('assistant', 'Local Qwen AI is available inside the Android app.');
    if (send) send.disabled = false;
    return;
  }

  const id = 'ai-' + (++requestSeq);
  pending.set(id, { busy: true });

  const system =
    `You are MyBusiness local assistant. Use concise English or Roman Urdu/Urdu matching the user. ` +
    `You are NOT allowed to invent database actions. Common business actions are handled by the deterministic agent before you. ` +
    `If a request needs an unsupported action, explain that clearly. ${agentContext()} Keep answers short. Do not use the internet. /no_think`;

  try {
    window.AndroidAI.ask(
      id,
      `User request: ${text}\n\n${agentContext()}`,
      system
    );
  } catch (e) {
    pending.delete(id);
    if (send) send.disabled = false;
    appendMessage('assistant', e.message || 'Could not start local AI.');
  }
}

function startOrStopVoice() {
  if (!whisperAvailable()) {
    setAIError('Voice commands are available in the Android app after Whisper is installed.');
    return;
  }

  if (!bothModelsInstalled() || !bothModelsReady()) {
    setAIError('Load both Qwen and Whisper before using voice commands.');
    updateCombinedReadiness();
    return;
  }

  if (recording) {
    try {
      window.AndroidWhisper.stopRecording();
    } catch (e) {
      setAIError(e.message || 'Could not stop recording.');
    }
    return;
  }

  const language = document.getElementById('ai-voice-language')?.value || 'auto';
  try {
    window.AndroidWhisper.setLanguage?.(language);
  } catch (_) {}

  recording = true;
  updateVoiceButton();

  try {
    window.AndroidWhisper.startRecording();
  } catch (e) {
    recording = false;
    updateVoiceButton();
    setAIError(e.message || 'Could not start microphone.');
  }
}

export function renderAI(container) {
  container.innerHTML = `
    <section id="ai-page" class="ai-page">
      <div class="ai-hero">
        <div class="ai-orb"><i class="fas fa-robot"></i></div>
        <div>
          <span class="eyebrow">PRIVATE • ON DEVICE</span>
          <h2>MyBusiness AI Agent</h2>
          <p>Qwen understands commands and Whisper converts English/Urdu speech to text. Both models run locally.</p>
        </div>
        <button id="ai-clear-chat" class="btn btn-secondary" type="button" title="Clear chat"><i class="fas fa-trash"></i></button>
      </div>

      <div class="ai-status-card">
        <div>
          <span class="ai-label">QWEN MODEL</span>
          <strong id="ai-status">Checking model...</strong>
          <small>Qwen3 0.6B • Q4_0 • ~429 MB</small>
        </div>
        <span class="ai-local-badge"><i class="fas fa-lock"></i> Offline</span>
      </div>

      <div class="ai-status-card">
        <div>
          <span class="ai-label">VOICE MODEL</span>
          <strong id="whisper-status">Checking model...</strong>
          <small>Whisper base • multilingual • ~148 MB</small>
        </div>
        <span class="ai-local-badge"><i class="fas fa-microphone"></i> Offline</span>
      </div>

      <div id="ai-model-gate" class="card ai-install-card">
        <div class="ai-install-icon"><i class="fas fa-microchip"></i></div>
        <h3>Two local AI models are required</h3>
        <p>Download each official model in your browser, return to MyBusiness, and install it. Nothing is sent to a paid AI API.</p>

        <div id="ai-install-card" class="ai-model-install-row hidden">
          <div>
            <strong>Qwen 3 0.6B</strong>
            <small id="ai-qwen-note">Local text reasoning model</small>
          </div>
          <div class="ai-install-actions">
            <button id="ai-get-model" class="btn" type="button">Get Qwen Model</button>
            <button id="ai-install-model" class="btn btn-secondary" type="button">Install Qwen</button>
          </div>
        </div>

        <div id="whisper-install-card" class="ai-model-install-row hidden">
          <div>
            <strong>Whisper base</strong>
            <small>Multilingual speech recognition • English + Urdu</small>
          </div>
          <div class="ai-install-actions">
            <button id="whisper-get-model" class="btn" type="button">Get Whisper Model</button>
            <button id="whisper-install-model" class="btn btn-secondary" type="button">Install Whisper</button>
          </div>
        </div>

        <div class="ai-steps">
          <div><b>1</b><span>Download Qwen and Whisper</span></div>
          <div><b>2</b><span>Return to MyBusiness</span></div>
          <div><b>3</b><span>Install both verified files</span></div>
        </div>
      </div>

      <div id="ai-progress-wrap" class="ai-progress-card hidden">
        <div class="ai-progress-top">
          <strong id="ai-progress-text">Installing model — 0%</strong>
          <span>Actual file bytes</span>
        </div>
        <div class="ai-progress-track"><div id="ai-progress-bar" class="ai-progress-bar"></div></div>
      </div>

      <section id="ai-chat-area" class="ai-chat-area hidden">
        <div id="ai-messages" class="ai-messages">
          <div class="ai-empty">
            <i class="fas fa-robot"></i>
            <strong>AI agent is ready</strong>
            <span>Try: “Ali se 500 receive kiye”, “Coke stock mein 10 add karo”, or “aaj ki sales batao”.</span>
          </div>
        </div>

        <div class="ai-compose">
          <textarea id="ai-input" rows="2" placeholder="English, Urdu or Roman Urdu…" aria-label="Ask MyBusiness AI"></textarea>
          <div class="ai-compose-actions">
            <select id="ai-voice-language" aria-label="Voice language">
              <option value="auto">Auto detect</option>
              <option value="en">English</option>
              <option value="ur">Urdu</option>
            </select>
            <button id="ai-voice" class="btn btn-secondary" type="button"><i class="fas fa-microphone"></i> Speak</button>
            <button id="ai-send" class="btn" type="button"><i class="fas fa-paper-plane"></i> Send</button>
          </div>
        </div>
      </section>
    </section>`;

  const get = document.getElementById('ai-get-model');
  const install = document.getElementById('ai-install-model');
  const whisperGet = document.getElementById('whisper-get-model');
  const whisperInstall = document.getElementById('whisper-install-model');
  const send = document.getElementById('ai-send');
  const voice = document.getElementById('ai-voice');
  const input = document.getElementById('ai-input');
  const language = document.getElementById('ai-voice-language');

  get.onclick = openQwenDownload;
  install.onclick = () =>
    nativeAvailable()
      ? AndroidAI.openModelPicker()
      : setAIError('Qwen installation is available in the Android app.');

  whisperGet.onclick = openWhisperDownload;
  whisperInstall.onclick = () =>
    whisperAvailable()
      ? AndroidWhisper.openModelPicker()
      : setAIError('Whisper installation is available in the Android app.');

  send.onclick = sendAI;
  voice.onclick = startOrStopVoice;

  language.addEventListener('change', () => {
    try {
      if (whisperAvailable()) AndroidWhisper.setLanguage(language.value);
    } catch (_) {}
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAI();
    }
  });

  document.getElementById('ai-clear-chat').onclick = clearAIChat;

  if (chatHistory.length) {
    const box = aiMessages();
    if (box) {
      box.innerHTML = '';
      chatHistory.forEach(m => appendMessage(m.role, m.text, true));
    }
  }

  if (nativeAvailable()) {
    try {
      const status = JSON.parse(AndroidAI.status());
      updateAIState(status);
      if (status.installed) AndroidAI.load();
    } catch (_) {
      setAIError('Could not read local Qwen status.');
    }
  } else {
    updateAIState({ status: 'not_installed' });
  }

  if (whisperAvailable()) {
    try {
      const status = JSON.parse(AndroidWhisper.status());
      updateWhisperState(status);
      if (status.installed) AndroidWhisper.load();
    } catch (_) {
      updateWhisperState({ status: 'not_installed' });
    }
  } else {
    updateWhisperState({ status: 'not_installed' });
  }

  updateVoiceButton();
  updateCombinedReadiness();
}
