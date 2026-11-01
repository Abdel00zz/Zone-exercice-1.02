import { Redis } from '@upstash/redis';
import { COOKIE_NAME, parseCookie, verifySessionToken } from '../_lib/auth';
import { parseCloudWorksheets } from '../../domain/worksheetSchema';

export const config = { runtime: 'edge' };

const CODE_PATTERN = /^[A-Z0-9]{6}$/;

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
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
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

  const url = new URL(req.url);
  const code = (url.searchParams.get('code') || '').toUpperCase();
  const since = Number(url.searchParams.get('since') || '0');
  if (!CODE_PATTERN.test(code)) {
    return json({ error: 'Code de session invalide (6 caractères alphanumériques).' }, 400);
  }
  if (!Number.isSafeInteger(since) || since < 0) return json({ error: 'Version de synchronisation invalide.' }, 400);

  const redis = new Redis({ url: redisUrl, token: redisToken });
  const raw = await redis.get<string | { worksheets: unknown; version: number }>(redisKey(code));
  if (!raw) {
    return json({ unchanged: true }, 200);
  }

  // Upstash désérialise déjà le JSON s'il détecte un objet ; on gère les deux cas par sécurité.
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || !Number.isSafeInteger(data.version) || data.version < 0) throw new Error('Version invalide.');
    if (data.version <= since) return json({ unchanged: true }, 200);
    return json({ worksheets: parseCloudWorksheets(data.worksheets), version: data.version }, 200);
  } catch {
    return json({ error: 'Snapshot distant invalide. Les fiches locales sont conservées.' }, 502);
  }
}
