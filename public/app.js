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
      console.info('✅ model-viewer geladen von', url);
      return;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('❌ model-viewer konnte nicht geladen werden');
}

function initAvatar() {
  const mv = document.getElementById('rpm-avatar');
  const status = document.getElementById('status');
  const fallback = document.getElementById('fallback');
  if (!mv) return;

  mv.src = "https://models.readyplayer.me/G010KY.glb"; // 👈 dein neuer Avatar-Link

  mv.addEventListener('load', () => { status.textContent = '✅ Avatar geladen.'; });
  mv.addEventListener('error', () => {
    status.textContent = '⚠️ Avatar-Fehler – zeige Fallback.';
    fallback.style.display = 'block';
  });
}

// --- Sprach-Ausgabe (TTS) + Avatar-Animation ---
function speak(text, mv) {
  if (!('speechSynthesis' in window)) {
    console.warn('⚠️ speechSynthesis wird nicht unterstützt');
    return;
  }

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  u.pitch = 1;
  u.rate = 1;

  u.onstart = () => {
    if (mv) {
      // Fallback "sprechende Kopfbewegung"
      let angle = 0;
      mv._talkingInterval = setInterval(() => {
        angle += 15;
        mv.cameraOrbit = `${Math.sin(angle/10) * 5}deg 10deg 105%`;
      }, 150);
    }
  };

  u.onend = () => {
    if (mv && mv._talkingInterval) {
      clearInterval(mv._talkingInterval);
      mv._talkingInterval = null;
      mv.cameraOrbit = "0deg 10deg 105%"; // zurücksetzen
    }
  };

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
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
    return data.reply || '⚠️ Antwort war leer.';
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
      const reply = await ask(text);
      typing.textContent = reply;

      // Avatar sprechen lassen
      speak(reply, mv);
    } catch (err) {
      typing.textContent = 'Fehler: ' + err.message;
    }
  });
}

(async function main() {
  try { await loadModelViewer(); initAvatar(); }
  catch (e) {
    console.error(e);
    document.getElementById('status').textContent = '⚠️ model-viewer konnte nicht geladen werden. Fallback aktiv.';
    document.getElementById('fallback').style.display = 'block';
  }
  ui();
})();
