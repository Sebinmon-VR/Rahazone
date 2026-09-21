import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const r = Router();

r.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = await q.get('SELECT * FROM rz_users WHERE LOWER(email) = LOWER(?)', email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const { password_hash, ...safe } = user;
  res.json({ token: signToken(user), user: safe });
});

r.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

r.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const user = await q.get('SELECT * FROM rz_users WHERE id = ?', req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  await q.run('UPDATE rz_users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(new_password, 10), req.user.id);
  res.json({ ok: true });
});

export default r;
