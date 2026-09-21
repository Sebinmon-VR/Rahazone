import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireAdmin, canAccessProject } from '../auth.js';
import { projectPnl, applyShare } from '../pnl.js';
import { deleteProject } from '../cascade.js';

const r = Router();
r.use(requireAuth);

async function shareFor(user, projectId) {
  if (user.role === 'admin') return null;
  return q.get('SELECT share_percent, invested_amount FROM rz_project_shares WHERE project_id = ? AND user_id = ?', projectId, user.id);
}

async function projectSummary(p, user) {
  const [counts, pnl, share, shareholders] = await Promise.all([
    q.get(`SELECT COUNT(*) AS item_count, SUM(CASE WHEN status='rented' THEN 1 ELSE 0 END) AS rented_count
           FROM rz_items WHERE project_id = ?`, p.id),
    projectPnl(p.id),
    shareFor(user, p.id),
    q.get('SELECT COUNT(*) AS c, COALESCE(SUM(share_percent),0) AS allocated FROM rz_project_shares WHERE project_id = ?', p.id),
  ]);
  const base = {
    ...p,
    item_count: counts.item_count,
    rented_count: counts.rented_count || 0,
    income: pnl.income, expense: pnl.expense, net: pnl.net,
    shareholder_count: shareholders.c,
    allocated_percent: shareholders.allocated,
  };
  if (share) {
    base.share_percent = share.share_percent;
    base.invested_amount = share.invested_amount;
    base.my_net = pnl.net * share.share_percent / 100;
  }
  return base;
}

async function visibleProjects(user) {
  return user.role === 'admin'
    ? q.all('SELECT * FROM rz_projects ORDER BY created_at DESC')
    : q.all(`SELECT p.* FROM rz_projects p JOIN rz_project_shares s ON s.project_id = p.id
             WHERE s.user_id = ? ORDER BY p.created_at DESC`, user.id);
}

// List projects visible to the current user
r.get('/', async (req, res) => {
  const projects = await visibleProjects(req.user);
  res.json(await Promise.all(projects.map(p => projectSummary(p, req.user))));
});

// Portfolio-wide summary for the current user
r.get('/portfolio', async (req, res) => {
  const projects = await visibleProjects(req.user);
  const summaries = await Promise.all(projects.map(p => projectSummary(p, req.user)));
  const isAdmin = req.user.role === 'admin';
  const totals = summaries.reduce((acc, p) => {
    acc.income += isAdmin ? p.income : p.income * p.share_percent / 100;
    acc.expense += isAdmin ? p.expense : p.expense * p.share_percent / 100;
    acc.items += p.item_count;
    acc.rented += p.rented_count;
    acc.invested += isAdmin ? (p.total_investment || 0) : (p.invested_amount || 0);
    return acc;
  }, { income: 0, expense: 0, items: 0, rented: 0, invested: 0 });
  totals.net = totals.income - totals.expense;

  // Monthly trend across all projects (share-weighted for users)
  const monthlyMap = new Map();
  for (const p of summaries) {
    const f = isAdmin ? 1 : p.share_percent / 100;
    for (const m of (await projectPnl(p.id)).monthly) {
      const cur = monthlyMap.get(m.month) || { month: m.month, income: 0, expense: 0, net: 0 };
      cur.income += m.income * f; cur.expense += m.expense * f; cur.net += m.net * f;
      monthlyMap.set(m.month, cur);
    }
  }
  const monthly = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  const feedbackCount = isAdmin
    ? (await q.get('SELECT COUNT(*) AS c FROM rz_feedback WHERE admin_reply IS NULL')).c
    : (await q.get('SELECT COUNT(*) AS c FROM rz_feedback WHERE user_id = ?', req.user.id)).c;

  const expiring = isAdmin ? await q.all(`
    SELECT TOP 10 c.id, c.tenant_name, c.end_date, i.name AS item_name, p.name AS project_name, p.id AS project_id, i.id AS item_id
    FROM rz_contracts c JOIN rz_items i ON i.id = c.item_id JOIN rz_projects p ON p.id = i.project_id
    WHERE c.status = 'active' AND c.end_date <= CONVERT(NVARCHAR(10), DATEADD(day, 60, GETUTCDATE()), 23)
    ORDER BY c.end_date`) : [];

  res.json({ totals, monthly, projects: summaries, project_count: summaries.length, feedback_count: feedbackCount, expiring_contracts: expiring });
});

r.post('/', requireAdmin, async (req, res) => {
  const { name, location, description, type, total_investment, status } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Project name is required' });
  const info = await q.run(
    'INSERT INTO rz_projects (name, location, description, type, total_investment, status) VALUES (?, ?, ?, ?, ?, ?)',
    name, location || null, description || null, type || 'building', Number(total_investment) || 0, status || 'active');
  res.status(201).json(await q.get('SELECT * FROM rz_projects WHERE id = ?', info.lastInsertRowid));
});

r.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const p = await q.get('SELECT * FROM rz_projects WHERE id = ?', id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  if (!await canAccessProject(req.user, id)) return res.status(403).json({ error: 'No access to this project' });

  const [items, shareholders, documents, rawPnl, share, summary] = await Promise.all([
    q.all(`
      SELECT i.*, c.id AS contract_id, c.tenant_name, c.business_name, c.monthly_rent, c.end_date AS contract_end
      FROM rz_items i
      LEFT JOIN rz_contracts c ON c.item_id = i.id AND c.status = 'active'
      WHERE i.project_id = ? ORDER BY i.floor, i.name`, id),
    q.all(`
      SELECT s.id, s.user_id, s.share_percent, s.invested_amount, u.name, u.email
      FROM rz_project_shares s JOIN rz_users u ON u.id = s.user_id WHERE s.project_id = ? ORDER BY s.share_percent DESC`, id),
    q.all('SELECT * FROM rz_documents WHERE project_id = ? AND item_id IS NULL AND contract_id IS NULL ORDER BY created_at DESC', id),
    projectPnl(id, { from: req.query.from, to: req.query.to }),
    shareFor(req.user, id),
    projectSummary(p, req.user),
  ]);
  const pnl = share ? applyShare(rawPnl, share.share_percent) : rawPnl;
  const visibleShareholders = req.user.role === 'admin' ? shareholders : shareholders.map(s => ({ ...s, email: undefined }));
  res.json({ ...summary, items, shareholders: visibleShareholders, documents, pnl });
});

r.put('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const p = await q.get('SELECT * FROM rz_projects WHERE id = ?', id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const b = req.body || {};
  await q.run('UPDATE rz_projects SET name=?, location=?, description=?, type=?, total_investment=?, status=? WHERE id=?',
    b.name ?? p.name, b.location ?? p.location, b.description ?? p.description, b.type ?? p.type,
    b.total_investment !== undefined ? Number(b.total_investment) : p.total_investment, b.status ?? p.status, id);
  res.json(await q.get('SELECT * FROM rz_projects WHERE id = ?', id));
});

r.delete('/:id', requireAdmin, async (req, res) => {
  await deleteProject(Number(req.params.id));
  res.json({ ok: true });
});

// ----- Shares -----
r.put('/:id/shares', requireAdmin, async (req, res) => {
  const projectId = Number(req.params.id);
  const { user_id, share_percent, invested_amount } = req.body || {};
  const userId = Number(user_id);
  const pct = Number(share_percent);
  if (!userId || !(pct > 0 && pct <= 100)) return res.status(400).json({ error: 'user_id and share_percent (0-100) required' });
  if (!await q.get('SELECT 1 AS ok FROM rz_users WHERE id = ?', userId)) return res.status(404).json({ error: 'User not found' });
  const others = (await q.get('SELECT COALESCE(SUM(share_percent),0) AS s FROM rz_project_shares WHERE project_id = ? AND user_id != ?', projectId, userId)).s;
  if (others + pct > 100.0001) return res.status(400).json({ error: `Only ${(100 - others).toFixed(2)}% remains unallocated` });
  const invested = Number(invested_amount) || 0;
  const existing = await q.get('SELECT id FROM rz_project_shares WHERE project_id = ? AND user_id = ?', projectId, userId);
  if (existing) await q.run('UPDATE rz_project_shares SET share_percent = ?, invested_amount = ? WHERE id = ?', pct, invested, existing.id);
  else await q.run('INSERT INTO rz_project_shares (project_id, user_id, share_percent, invested_amount) VALUES (?, ?, ?, ?)', projectId, userId, pct, invested);
  res.json({ ok: true });
});

r.delete('/:id/shares/:userId', requireAdmin, async (req, res) => {
  await q.run('DELETE FROM rz_project_shares WHERE project_id = ? AND user_id = ?', Number(req.params.id), Number(req.params.userId));
  res.json({ ok: true });
});

// ----- Transactions (P&L entries) -----
r.get('/:id/transactions', async (req, res) => {
  const id = Number(req.params.id);
  if (!await canAccessProject(req.user, id)) return res.status(403).json({ error: 'No access to this project' });
  res.json(await q.all(`
    SELECT t.*, i.name AS item_name FROM rz_transactions t
    LEFT JOIN rz_items i ON i.id = t.item_id
    WHERE t.project_id = ? ORDER BY t.[date] DESC, t.id DESC`, id));
});

r.post('/:id/transactions', requireAdmin, async (req, res) => {
  const projectId = Number(req.params.id);
  const { type, category, amount, date, description, item_id, contract_id } = req.body || {};
  if (!['income', 'expense'].includes(type)) return res.status(400).json({ error: 'type must be income or expense' });
  if (!category || !date || !(Number(amount) > 0)) return res.status(400).json({ error: 'category, date and positive amount required' });
  const info = await q.run(
    'INSERT INTO rz_transactions (project_id, item_id, contract_id, type, category, amount, [date], description) VALUES (?,?,?,?,?,?,?,?)',
    projectId, item_id ? Number(item_id) : null, contract_id ? Number(contract_id) : null, type, category, Number(amount), date, description || null);
  res.status(201).json(await q.get('SELECT * FROM rz_transactions WHERE id = ?', info.lastInsertRowid));
});

r.put('/:id/transactions/:txId', requireAdmin, async (req, res) => {
  const t = await q.get('SELECT * FROM rz_transactions WHERE id = ? AND project_id = ?', Number(req.params.txId), Number(req.params.id));
  if (!t) return res.status(404).json({ error: 'Transaction not found' });
  const b = req.body || {};
  await q.run('UPDATE rz_transactions SET item_id=?, contract_id=?, type=?, category=?, amount=?, [date]=?, description=? WHERE id=?',
    b.item_id === undefined ? t.item_id : (b.item_id ? Number(b.item_id) : null),
    b.contract_id === undefined ? t.contract_id : (b.contract_id ? Number(b.contract_id) : null),
    b.type ?? t.type, b.category ?? t.category, b.amount !== undefined ? Number(b.amount) : t.amount, b.date ?? t.date,
    b.description ?? t.description, t.id);
  res.json(await q.get('SELECT * FROM rz_transactions WHERE id = ?', t.id));
});

r.delete('/:id/transactions/:txId', requireAdmin, async (req, res) => {
  await q.run('DELETE FROM rz_transactions WHERE id = ? AND project_id = ?', Number(req.params.txId), Number(req.params.id));
  res.json({ ok: true });
});

export default r;
