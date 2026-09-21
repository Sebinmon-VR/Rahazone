import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireAdmin, canAccessProject, itemProjectId } from '../auth.js';

const r = Router();
r.use(requireAuth);

const SELECT = `
  SELECT f.*, u.name AS user_name, p.name AS project_name, i.name AS item_name
  FROM rz_feedback f
  JOIN rz_users u ON u.id = f.user_id
  JOIN rz_projects p ON p.id = f.project_id
  LEFT JOIN rz_items i ON i.id = f.item_id`;

// List feedback. Admin sees all; users see feedback on projects they hold shares in.
r.get('/', async (req, res) => {
  const { project_id, item_id } = req.query;
  const conds = [];
  const params = [];
  if (req.user.role !== 'admin') {
    conds.push('f.project_id IN (SELECT project_id FROM rz_project_shares WHERE user_id = ?)');
    params.push(req.user.id);
  }
  if (project_id) { conds.push('f.project_id = ?'); params.push(Number(project_id)); }
  if (item_id) { conds.push('f.item_id = ?'); params.push(Number(item_id)); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  res.json(await q.all(`${SELECT} ${where} ORDER BY f.created_at DESC`, ...params));
});

r.post('/', async (req, res) => {
  const { project_id, item_id, message } = req.body || {};
  if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });
  let pid = project_id ? Number(project_id) : null;
  if (item_id) {
    pid = await itemProjectId(Number(item_id));
    if (!pid) return res.status(404).json({ error: 'Item not found' });
  }
  if (!pid) return res.status(400).json({ error: 'project_id or item_id is required' });
  if (!await canAccessProject(req.user, pid)) return res.status(403).json({ error: 'No access to this project' });
  const info = await q.run('INSERT INTO rz_feedback (user_id, project_id, item_id, message) VALUES (?,?,?,?)',
    req.user.id, pid, item_id ? Number(item_id) : null, message.trim());
  res.status(201).json(await q.get(`${SELECT} WHERE f.id = ?`, info.lastInsertRowid));
});

r.post('/:id/reply', requireAdmin, async (req, res) => {
  const { reply } = req.body || {};
  if (!reply?.trim()) return res.status(400).json({ error: 'Reply is required' });
  const id = Number(req.params.id);
  if (!await q.get('SELECT 1 AS ok FROM rz_feedback WHERE id = ?', id)) return res.status(404).json({ error: 'Feedback not found' });
  await q.run('UPDATE rz_feedback SET admin_reply = ?, replied_at = SYSUTCDATETIME() WHERE id = ?', reply.trim(), id);
  res.json(await q.get(`${SELECT} WHERE f.id = ?`, id));
});

r.delete('/:id', async (req, res) => {
  const f = await q.get('SELECT * FROM rz_feedback WHERE id = ?', Number(req.params.id));
  if (!f) return res.status(404).json({ error: 'Feedback not found' });
  if (req.user.role !== 'admin' && f.user_id !== req.user.id) return res.status(403).json({ error: 'Not your feedback' });
  await q.run('DELETE FROM rz_feedback WHERE id = ?', f.id);
  res.json({ ok: true });
});

export default r;
