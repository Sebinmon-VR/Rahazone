import jwt from 'jsonwebtoken';
import { q } from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'rahazone-dev-secret-change-me';

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
  const user = await q.get('SELECT id, name, email, role, phone FROM rz_users WHERE id = ?', payload.id);
  if (!user) return res.status(401).json({ error: 'User no longer exists' });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

/** True if the user is an admin or holds a share in the project. */
export async function canAccessProject(user, projectId) {
  if (user.role === 'admin') return true;
  const row = await q.get('SELECT 1 AS ok FROM rz_project_shares WHERE project_id = ? AND user_id = ?', projectId, user.id);
  return !!row;
}

export async function itemProjectId(itemId) {
  return (await q.get('SELECT project_id FROM rz_items WHERE id = ?', itemId))?.project_id;
}

export async function contractProjectId(contractId) {
  return (await q.get(
    'SELECT i.project_id FROM rz_contracts c JOIN rz_items i ON i.id = c.item_id WHERE c.id = ?', contractId
  ))?.project_id;
}
