import { Redis } from '@upstash/redis';
import { COOKIE_NAME, parseCookie, verifySessionToken } from '../_lib/auth';

export const config = { runtime: 'edge' };

const CODE_PATTERN = /^[A-Z0-9]{6}$/;
const MAX_PAYLOAD_CHARS = 1_000_000; // marge sous la limite ~1 Mo/commande d'Upstash
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function redisKey(code: string): string {
  return `sync:${code}`;
}

async function requireAuth(req: Request): Promise<boolean> {
  const secret = process.env.APP_SECRET;
  if (!secret) return false;
  const token = parseCookie(req.headers.get('cookie'), COOKIE_NAME);
  return token ? verifySessionToken(token, secret) : false;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }
  if (!(await requireAuth(req))) {
    return json({ error: 'Non authentifié.' }, 401);
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!redisUrl || !redisToken) {
    return json({ error: 'Serveur mal configuré (Upstash Redis manquant).' }, 500);
  }

  let body: { code?: unknown; worksheets?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
  if (!CODE_PATTERN.test(code)) {
    return json({ error: 'Code de session invalide (6 caractères alphanumériques).' }, 400);
  }
  if (!Array.isArray(body.worksheets)) {
    return json({ error: 'Le champ "worksheets" doit être un tableau.' }, 400);
  }

  const version = Date.now();
  const payload = JSON.stringify({ worksheets: body.worksheets, version });
  if (payload.length > MAX_PAYLOAD_CHARS) {
    return json({ error: `Contenu trop volumineux (${payload.length} caractères, max ${MAX_PAYLOAD_CHARS}).` }, 413);
  }

  const redis = new Redis({ url: redisUrl, token: redisToken });
  await redis.set(redisKey(code), payload, { ex: TTL_SECONDS });

  return json({ ok: true, version }, 200);
}
