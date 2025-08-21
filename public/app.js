// API-URL: dein PHP-Endpunkt auf profiausbau.com
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
      console.info('model-viewer geladen von', url);
      return;
    } catch (e) { console.warn("⚠️ model-viewer Fehler bei", url, e); }
  }
  throw new Error('model-viewer konnte nicht geladen werden');
}

function initAvatar() {
  const mv = document.getElementById('rpm-avatar');
  if (!mv) return;

  // Kamera so einstellen, dass nur Kopf sichtbar ist
  mv.setAttribute("camera-orbit", "0deg 90deg 1.2m");
  mv.setAttribute("field-of-view", "15deg");
  mv.removeAttribute("auto-rotate"); // nicht drehen

  mv.addEventListener('load', () => {
    document.getElementById('status').textContent = 'Avatar geladen.';
  });
  mv.addEventListener('error', () => {
    document.getElementById('status').textContent = 'Avatar-Fehler – Fallback aktiv.';
    document.getElementById('fallback').style.display = 'block';
  });
}

// --- ElevenLabs Audio ---
$voice_id = "21m00Tcm4TlvDq8ikWAM"; // Standard-Stimme
$filename = "voice_" . uniqid() . ".mp3";
$audio_file = __DIR__ . "/" . $filename;

$tts_payload = json_encode([
    "text" => $reply,
    "model_id" => "eleven_multilingual_v2",
    "voice_settings" => [
        "stability" => 0.5,
        "similarity_boost" => 0.8
    ]
]);

$ch = curl_init("https://api.elevenlabs.io/v1/text-to-speech/$voice_id");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $tts_payload,
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "xi-api-key: $ELEVEN_API_KEY"
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_BINARYTRANSFER => true // ⚠️ ganz wichtig für MP3
]);
$audio = curl_exec($ch);

if ($audio === false) {
    error_log("ElevenLabs Error: " . curl_error($ch));
}
curl_close($ch);

$audio_url = null;
if ($audio && strlen($audio) > 1000) { // kleine JSON-Fehlerantwort rausfiltern
    file_put_contents($audio_file, $audio);
    $audio_url = "https://www.profiausbau.com/api/" . $filename;
} else {
    error_log("ElevenLabs lieferte keine gültige MP3-Datei");
}


// --- Fallback mit Browser-Sprachsynthese ---
function speak(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('⚠️ speechSynthesis wird nicht unterstützt');
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  u.pitch = 1;
  u.rate = 1;

  // Angenehme Stimme wählen (Google Deutsch)
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
      throw new Error('Netzwerkfehler: ' + e.message);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text?.slice(0,160)}`);
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

      // 1. Versuche ElevenLabs-MP3
      let ok = false;
      if (audio) {
        ok = playAudio(audio);
      }

      // 2. Fallback Browser-Stimme
      if (!ok) {
        speak(reply);
      }

    } catch (err) {
      typing.textContent = 'Fehler: ' + err.message;
    }
  });
}

// --- Start ---
(async function main() {
  try { await loadModelViewer(); initAvatar(); }
  catch (e) {
    console.error(e);
    document.getElementById('status').textContent = 'model-viewer konnte nicht geladen werden. Fallback aktiv.';
    document.getElementById('fallback').style.display = 'block';
  }
  ui();
})();
