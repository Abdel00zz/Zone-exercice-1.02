import { next } from '@vercel/edge';
import { COOKIE_NAME, parseCookie, verifySessionToken } from './api/_lib/auth';

// Protège tout le site (assets + API) sauf /api/login, derrière un mot de passe unique.
export const config = {
  matcher: ['/((?!api/login).*)'],
};

const LOGIN_PAGE = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Connexion</title>
<style>
  body { font-family: system-ui, sans-serif; background:#0f172a; color:#e2e8f0; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  form { background:#1e293b; padding:2rem; border-radius:1rem; box-shadow:0 10px 30px rgba(0,0,0,.4); width:min(90vw,340px); }
  h1 { font-size:1.1rem; margin:0 0 1rem; }
  input { width:100%; box-sizing:border-box; padding:.6rem .8rem; border-radius:.5rem; border:1px solid #334155; background:#0f172a; color:#e2e8f0; font-size:1rem; }
  button { margin-top:.8rem; width:100%; padding:.6rem; border:none; border-radius:.5rem; background:#0ea5e9; color:#fff; font-weight:600; cursor:pointer; }
  button:disabled { opacity:.6; cursor:default; }
  p.error { color:#f87171; font-size:.85rem; min-height:1.2em; margin:.5rem 0 0; }
</style>
</head>
<body>
  <form id="f">
    <h1>Mot de passe requis</h1>
    <input type="password" id="pwd" placeholder="Mot de passe" autofocus required />
    <button type="submit">Entrer</button>
    <p class="error" id="err"></p>
  </form>
  <script>
    var f = document.getElementById('f');
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var btn = f.querySelector('button');
      var err = document.getElementById('err');
      btn.disabled = true; err.textContent = '';
      fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: document.getElementById('pwd').value }),
      }).then(function (r) {
        if (r.ok) { location.reload(); }
        else { r.json().then(function (d) { err.textContent = (d && d.error) || 'Mot de passe incorrect.'; }); btn.disabled = false; }
      }).catch(function () { err.textContent = 'Erreur reseau.'; btn.disabled = false; });
    });
  </script>
</body>
</html>`;

export default async function middleware(request: Request) {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    return new Response('Serveur mal configuré : APP_SECRET manquant.', { status: 500 });
  }

  const token = parseCookie(request.headers.get('cookie'), COOKIE_NAME);
  const valid = token ? await verifySessionToken(token, secret) : false;
  if (valid) {
    return next();
  }

  return new Response(LOGIN_PAGE, {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
