import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

const r = Router();
r.use(requireAuth);

/** Workspace-wide settings with their defaults. Add new keys here. */
const DEFAULTS = { currency: 'INR' };

const VALIDATORS = {
  currency: (v) => {
    const code = String(v || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) throw new Error('Currency must be a 3-letter ISO code, e.g. INR, AED, USD');
    return code;
  },
};

export async function loadSettings() {
  const rows = await q.all('SELECT [key], value FROM rz_settings');
  return { ...DEFAULTS, ...Object.fromEntries(rows.map(r => [r.key, r.value])) };
}

r.get('/', async (_req, res) => res.json(await loadSettings()));

r.put('/', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const updates = {};
  for (const [key, validate] of Object.entries(VALIDATORS)) {
    if (body[key] === undefined) continue;
    try { updates[key] = validate(body[key]); }
    catch (e) { return res.status(400).json({ error: e.message }); }
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });
  for (const [key, value] of Object.entries(updates)) {
    const exists = await q.get('SELECT 1 AS ok FROM rz_settings WHERE [key] = ?', key);
    if (exists) await q.run('UPDATE rz_settings SET value = ?, updated_at = SYSUTCDATETIME() WHERE [key] = ?', value, key);
    else await q.run('INSERT INTO rz_settings ([key], value) VALUES (?, ?)', key, value);
  }
  res.json(await loadSettings());
});

export default r;
