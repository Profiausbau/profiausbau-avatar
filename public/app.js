// API-URL: direkt dein Node-Chatbot-Endpunkt
const API_URL = 'https://www.profiausbau.com/api/chat.php';

// --- MODEL-VIEWER laden ---
async function loadModelViewer() {
  if (customElements.get && customElements.get('model-viewer')) return;
  const sources = [
    'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js',
    'https://cdn.jsdelivr.net/npm/@google/model-viewer/dist/model-viewer.min.js',
  ];
  for (const url of sources) {
    try {
      await import(url);
      if (customElements.whenDefined) await customElements.whenDefined('model-viewer');
      console.info('✅ model-viewer geladen von', url);
      return;
    } catch (e) {
      console.warn("⚠️ Fehler bei model-viewer", url, e);
    }
  }
  throw new Error('❌ model-viewer konnte nicht geladen werden');
}

// --- Avatar einstellen ---
function initAvatar() {
  const mv = document.getElementById('rpm-avatar');
  if (!mv) return;

  // 🎯 Kamera direkt auf Kopf richten
  mv.setAttribute("camera-orbit", "0deg 100deg 0.45m");  // Höhe + nah ran
  mv.setAttribute("field-of-view", "7deg");            // enger Zoom
  mv.setAttribute("camera-target", "0m 1.6m 0m");       // Kopfmitte statt Körper
  mv.removeAttribute("auto-rotate");                    // keine Drehung

  mv.addEventListener('load', () => {
    document.getElementById('status').textContent = '✅ Avatar geladen.';
  });
  mv.addEventListener('error', () => {
    document.getElementById('status').textContent = '❌ Avatar-Fehler – Fallback aktiv.';
    document.getElementById('fallback').style.display = 'block';
  });
}


// --- Browser-Sprachsynthese ---
function speak(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('⚠️ speechSynthesis wird nicht unterstützt');
    return;
  }

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  u.pitch = 1;
  u.rate = 1;

  // Angenehme Google-Stimme bevorzugen (Chrome)
  const voices = window.speechSynthesis.getVoices();
  const prefer = voices.find(v => v.lang === "de-DE" && v.name.includes("Google"));
  if (prefer) u.voice = prefer;

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
      throw new Error('❌ Netzwerkfehler: ' + e.message);
    }
    if (!res.ok) throw new Error(`❌ HTTP ${res.status}: ${text?.slice(0,160)}`);
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error('❌ Ungültiges JSON: ' + text?.slice(0,160)); }
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

    // 🎧 Audio bevorzugen
    if (audio) {
      const audioPlayer = new Audio(audio);

      // 🔊 Symbol hinzufügen
      const indicator = document.createElement('span');
      indicator.textContent = " 🔊";
      indicator.style.opacity = "0.7";
      typing.appendChild(indicator);

      audioPlayer.play()
        .then(() => {
          // Entfernen, wenn fertig
          audioPlayer.addEventListener('ended', () => {
            indicator.remove();
          });
        })
        .catch(err => {
          console.warn("⚠️ MP3 konnte nicht abgespielt werden, fallback Stimme:", err);
          indicator.remove();
          speak(reply); // Fallback: Browserstimme
        });

    } else {
      // Fallback: Browser-Stimme
      speak(reply);
    }

  } catch (err) {
    typing.textContent = '❌ Fehler: ' + err.message;
  }
});
}

// --- Start ---
(async function main() {
  try { await loadModelViewer(); initAvatar(); }
  catch (e) {
    console.error(e);
    document.getElementById('status').textContent = '❌ model-viewer konnte nicht geladen werden. Fallback aktiv.';
    document.getElementById('fallback').style.display = 'block';
  }
  ui();
})();
