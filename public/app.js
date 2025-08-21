// API-URL: dein PHP-Endpunkt auf profiausbau.com
const API_URL = 'https://www.profiausbau.com/api/chat.php';

// --- MODEL-VIEWER sicher laden (als ES-Modul) ---
async function loadModelViewer() {
  if (customElements.get && customElements.get('model-viewer')) return;
  const sources = [
    'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js',
    'https://cdn.jsdelivr.net/npm/@google/model-viewer/dist/model-viewer.min.js',
  ];
  let lastErr;
  for (const url of sources) {
    try {
      await import(url);
      if (customElements.whenDefined) await customElements.whenDefined('model-viewer');
      console.info('model-viewer geladen von', url);
      return;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('model-viewer konnte nicht geladen werden');
}

function initAvatar() {
  const mv = document.getElementById('rpm-avatar');
  const status = document.getElementById('status');
  const fallback = document.getElementById('fallback');
  if (!mv) return;
  mv.addEventListener('load', () => { status.textContent = 'Avatar geladen.'; });
  mv.addEventListener('error', () => {
    status.textContent = 'Avatar-Fehler – zeige Fallback.';
    fallback.style.display = 'block';
  });
}

// --- Avatar "sprechen lassen" über Audio ---
function playAudio(url, mv) {
  if (!url) return;
  const audio = new Audio(url);
  audio.play().catch(err => console.warn("⚠️ Audio konnte nicht abgespielt werden:", err));

  // Avatar Animation während Audio läuft
  audio.onplay = () => {
    if (mv) {
      mv.setAttribute('animation-name', 'Talking');
    }
  };
  audio.onended = () => {
    if (mv) {
      mv.setAttribute('animation-name', 'Idle');
    }
  };
}

// --- CHAT UI ---
function ui() {
  const chatToggle = document.getElementById('chatToggle');
  const chatWindow = document.getElementById('chatWindow');
  const chatForm   = document.getElementById('chatForm');
  const chatInput  = document.getElementById('chatInput');
  const chatMsgs   = document.getElementById('chatMsgs');
  const mv         = document.getElementById('rpm-avatar');

  chatToggle.addEventListener('click', () => {
    const open = chatWindow.style.display === 'block';
    chatWindow.style.display = open ? 'none' : 'block';
    if (!open) chatInput.focus();
  });

  function addMsg(role, text) {
    const wrap = document.createElement('div');
    wrap.className = `msg ${role}`;
    const b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text;
    wrap.appendChild(b);
    chatMsgs.appendChild(wrap);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  async function ask(message) {
    let res, text;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept':'application/json' },
        body: JSON.stringify({ message })
      });
      text = await res.text();
    } catch (e) {
      throw new Error('Netzwerkfehler: ' + e.message);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text?.slice(0,160) || ''}`);
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error('Ungültiges JSON: ' + text?.slice(0,160)); }
    return data;
  }

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    addMsg('user', text);
    chatInput.value = '';
    addMsg('bot', '…');
    const typing = chatMsgs.lastChild.querySelector('.bubble');

    try {
      const { reply, audio } = await ask(text);
      typing.textContent = reply;

      // Avatar "sprechen" lassen mit Audio-File von PHP
      playAudio(audio, mv);

    } catch (err) {
      typing.textContent = 'Fehler: ' + err.message;
    }
  });
}

(async function main() {
  try { await loadModelViewer(); initAvatar(); }
  catch (e) {
    console.error(e);
    document.getElementById('status').textContent = 'model-viewer konnte nicht geladen werden. Fallback aktiv.';
    document.getElementById('fallback').style.display = 'block';
  }
  ui();
})();
