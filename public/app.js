// API-URL: direkt dein Node-Chatbot-Endpunkt
const API_URL = 'https://www.profiausbau.com/api/chat.php';

// --- Babylon.js Avatar Setup ---
async function initBabylonAvatar() {
  const canvas = document.getElementById("avatarCanvas");
  if (!canvas) {
    console.error("❌ Kein Canvas mit id=avatarCanvas gefunden.");
    return null;
  }

  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color3(0.05, 0.07, 0.13);

  const camera = new BABYLON.ArcRotateCamera("camera", 0, 1.4, 1.2, new BABYLON.Vector3(0, 1.6, 0), scene);
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 0.6;
  camera.upperRadiusLimit = 2;
  camera.wheelDeltaPercentage = 0.01;

  new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

  // Avatar laden (ReadyPlayer.me GLB)
  const result = await BABYLON.SceneLoader.ImportMeshAsync("", 
    "https://models.readyplayer.me/68a75ecf645c86eae5be5aa5.glb", 
    "", scene);

  const avatar = result.meshes[0];
  avatar.scaling = new BABYLON.Vector3(1, 1, 1);

  engine.runRenderLoop(() => scene.render());

  return { scene, avatar, engine };
}

// --- Fake Lipsync (Mund + Kopfbewegung im Rhythmus vom Audio) ---
function makeLipsync(audioEl, avatar) {
  const mouth = avatar.getChildMeshes().find(m => m.name.toLowerCase().includes("mouth"));
  let frame = 0;

  const anim = () => {
    if (audioEl.paused || audioEl.ended) {
      if (mouth) mouth.scaling.y = 1; // Mund zurück
      avatar.rotation = new BABYLON.Vector3(0, 0, 0);
      return;
    }

    frame++;
    // Mundbewegung pseudo-random
    if (mouth) {
      mouth.scaling.y = 1 + Math.random() * 0.4;
    }
    // Kopf leicht nicken / drehen
    avatar.rotation.x = Math.sin(frame * 0.1) * 0.05;
    avatar.rotation.y = Math.sin(frame * 0.07) * 0.05;

    requestAnimationFrame(anim);
  };

  audioEl.addEventListener("play", anim);
}

// --- Browser-Sprachsynthese (Fallback) ---
function speak(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('⚠️ speechSynthesis wird nicht unterstützt');
    return;
  }

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  u.pitch = 1;
  u.rate = 1;

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

        // 🔊 Animierte Wellen hinzufügen
        const indicator = document.createElement('span');
        indicator.className = "audio-indicator";
        indicator.innerHTML = `
          <span class="audio-bar"></span>
          <span class="audio-bar"></span>
          <span class="audio-bar"></span>
        `;
        typing.appendChild(indicator);

        // Avatar Lippen/Kopf bewegen
        if (window.avatarInstance) {
          makeLipsync(audioPlayer, window.avatarInstance);
        }

        audioPlayer.play()
          .then(() => {
            audioPlayer.addEventListener('ended', () => {
              indicator.remove();
            });
          })
          .catch(err => {
            console.warn("⚠️ MP3 konnte nicht abgespielt werden, fallback Stimme:", err);
            indicator.remove();
            speak(reply);
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
  try { 
    const { avatar } = await initBabylonAvatar();
    if (avatar) {
      window.avatarInstance = avatar;
      document.getElementById('status').textContent = '✅ Avatar geladen.';
    } else {
      document.getElementById('status').textContent = '❌ Avatar konnte nicht geladen werden.';
    }
  } catch (e) {
    console.error(e);
    document.getElementById('status').textContent = '❌ Avatar konnte nicht geladen werden.';
  }
  ui();
})();
