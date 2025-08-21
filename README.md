# Avatar + Chat (GitHub Pages)

- Frontend: `public/` (statisch, wird auf GitHub Pages veröffentlicht)
- Backend: `https://www.profiausbau.com/api/chat.php` (PHP, CORS aktivieren)

## Schnellanleitung
1. Repo anlegen, diese Dateien committen (Ordner `public/` inkl.).
2. GitHub → Settings → Pages → Build with *GitHub Actions* (Workflow liegt in `.github/workflows/deploy.yml`).
3. `public/app.js` → `API_URL` ggf. anpassen.
4. Auf profiausbau.com in `/api/chat.php` CORS-Header ergänzen (siehe unten).

### CORS in `/api/chat.php`
```php
<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://DEINUSERNAME.github.io', 'https://www.profiausbau.com'];
if (in_array($origin, $allowed, true)) {
  header('Access-Control-Allow-Origin: '.$origin);
  header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;
header('Content-Type: application/json; charset=utf-8');
// ... Rest deiner Chat-Logik ...
```

### Test
In der Devtools-Konsole (auf GitHub Pages):
```js
fetch('https://www.profiausbau.com/api/chat.php', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({message:'hallo'})
}).then(r=>r.json()).then(console.log)
```
