import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

const r = Router();
r.use(requireAuth, requireAdmin);

const SAFE = 'id, name, email, role, phone, created_at';

r.get('/', async (_req, res) => {
  res.json(await q.all(`
    SELECT u.id, u.name, u.email, u.role, u.phone, u.created_at,
           (SELECT COUNT(*) FROM rz_project_shares s WHERE s.user_id = u.id) AS project_count
    FROM rz_users u ORDER BY u.role, u.name`));
});

r.post('/', async (req, res) => {
  const { name, email, password, role = 'user', phone } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (await q.get('SELECT 1 AS ok FROM rz_users WHERE LOWER(email) = LOWER(?)', email)) {
    return res.status(409).json({ error: 'Email already in use' });
  }
  const info = await q.run(
    'INSERT INTO rz_users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
    name, email, bcrypt.hashSync(password, 10), role, phone || null);
  res.status(201).json(await q.get(`SELECT ${SAFE} FROM rz_users WHERE id = ?`, info.lastInsertRowid));
});

r.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await q.get('SELECT * FROM rz_users WHERE id = ?', id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  const { name, email, password, role, phone } = req.body || {};
  if (role && !['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (email && await q.get('SELECT 1 AS ok FROM rz_users WHERE LOWER(email) = LOWER(?) AND id != ?', email, id)) {
    return res.status(409).json({ error: 'Email already in use' });
  }
  await q.run('UPDATE rz_users SET name = ?, email = ?, role = ?, phone = ?, password_hash = ? WHERE id = ?',
    name ?? existing.name, email ?? existing.email, role ?? existing.role,
    phone ?? existing.phone, password ? bcrypt.hashSync(password, 10) : existing.password_hash, id);
  res.json(await q.get(`SELECT ${SAFE} FROM rz_users WHERE id = ?`, id));
});

r.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  await q.run('DELETE FROM rz_users WHERE id = ?', id); // cascades shares and feedback; documents keep uploaded_by = NULL
  res.json({ ok: true });
});

export default r;
