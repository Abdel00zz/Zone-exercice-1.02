import { COOKIE_NAME, SESSION_MAX_AGE_SECONDS, createSessionToken, timingSafeEqual } from './_lib/auth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const appPassword = process.env.APP_PASSWORD;
  const appSecret = process.env.APP_SECRET;
  if (!appPassword || !appSecret) {
    return new Response(JSON.stringify({ ok: false, error: 'Serveur mal configuré (APP_PASSWORD/APP_SECRET manquants).' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  let password = '';
  try {
    const body = await req.json();
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Requête invalide.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!timingSafeEqual(password, appPassword)) {
    return new Response(JSON.stringify({ ok: false, error: 'Mot de passe incorrect.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const token = await createSessionToken(appSecret);
  const cookie = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ].join('; ');

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': cookie },
  });
}
