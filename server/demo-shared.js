import { createClient } from '@supabase/supabase-js';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const DEMO_ROLES = {
  owner: { staffRole: 'owner', displayName: 'Owner' },
  manager: { staffRole: 'manager', displayName: 'Manager' },
  reception: { staffRole: 'frontdesk', displayName: 'Reception' },
  supervisor: { staffRole: 'supervisor', displayName: 'Supervisor' },
  cleaner1: { staffRole: 'housekeeping', displayName: 'Cleaner 1' },
  cleaner2: { staffRole: 'housekeeping', displayName: 'Cleaner 2' },
  ac: { staffRole: 'maintenance', displayName: 'AC Technician' },
  plumbing: { staffRole: 'maintenance', displayName: 'Plumbing Technician' },
};
export const DEMO_TTL_SECONDS = 45 * 60;
export const DEMO_COOKIE = 'cf_demo_session';

export function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return res.status(status).json(body);
}

export function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Server demo auth is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export function assertSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const expectedProtocol = forwardedProto === 'http' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http:' : 'https:';
    return parsed.host === host && parsed.protocol === expectedProtocol;
  } catch { return false; }
}

export function readCookie(req, name = DEMO_COOKIE) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0 || part.slice(0,index).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(index+1).trim()); } catch { return ''; }
  }
  return '';
}

function pepper() {
  const value = process.env.DEMO_SESSION_PEPPER || process.env.SUPABASE_SECRET_KEY;
  if (!value) throw new Error('DEMO_SESSION_PEPPER is not configured.');
  return value;
}
export function hashSecret(value) {
  return createHmac('sha256', pepper()).update(String(value)).digest('hex');
}
export function randomSecret() { return randomBytes(32).toString('base64url'); }
export function cookieHeader(value, maxAge = DEMO_TTL_SECONDS) {
  return DEMO_COOKIE + '=' + encodeURIComponent(value) + '; HttpOnly; Secure; SameSite=Strict; Path=/api/demo; Max-Age=' + Math.max(0,maxAge);
}
export function clearCookieHeader() { return cookieHeader('',0); }

export function clientIp(req) {
  const vercelIp = req.headers['x-vercel-forwarded-for'];
  if (vercelIp) return String(vercelIp).split(',')[0].trim();
  const forwarded = String(req.headers['x-forwarded-for'] || '');
  if (forwarded) return forwarded.split(',').pop().trim();
  return String(req.headers['x-real-ip'] || 'unknown').trim();
}

export async function verifyTurnstile(token, remoteIp) {
  const secret = process.env.DEMO_TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: remoteIp });
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body});
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true;
}

export async function activeSession(admin, rawCookie) {
  if (!rawCookie) return null;
  const {data,error}=await admin.from('demo_sessions').select('id,hotel_id,created_at,expires_at,revoked_at').eq('cookie_hash',hashSecret(rawCookie)).maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) return null;
  return data;
}

export function constantTimeEqual(a,b) {
  const left=Buffer.from(String(a||'')), right=Buffer.from(String(b||''));
  return left.length===right.length && timingSafeEqual(left,right);
}
