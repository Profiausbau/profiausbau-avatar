// API-URL: dein PHP-Chatbot-Endpunkt
const API_URL = 'https://www.profiausbau.com/api/chat.php';

// D-ID Proxy Endpoint (läuft auf deinem Server)
const DID_URL = 'https://www.profiausbau.com/api/did.php';

// --- Avatar über D-ID sprechen lassen ---
async function playAvatar(text) {
  const container = document.getElementById("avatarContainer");
  container.innerHTML = "<span style='color:#94a3b8'>🎥 Erzeuge Avatar Video…</span>";

  try {
    const res = await fetch(DID_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const data = await res.json();

    if (!data.result_url) {
      throw new Error("D-ID Proxy hat kein Video zurückgegeben: " + JSON.stringify(data));
    }

    // Video einfügen
    container.innerHTML = "";
    const video = document.createElement("video");
    video.src = data.result_url;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = false;
    video.controls = false;
    video.style.width = "100%";
    video.style.height = "100%";
    container.appendChild(video);

  } catch (err) {
    console.error("Avatar-Fehler", err);
    container.innerHTML = "<p style='color:red'>❌ Avatar konnte nicht geladen werden.</p>";
  }
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
      const { reply } = await ask(text);
      typing.textContent = reply;

      // Avatar sprechen lassen (über deinen Proxy)
      playAvatar(reply);

    } catch (err) {
      typing.textContent = '❌ Fehler: ' + err.message;
    }
  });
}

// --- Start ---
(function main() {
  ui();
})();
