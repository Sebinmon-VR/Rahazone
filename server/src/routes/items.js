import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireAdmin, canAccessProject } from '../auth.js';
import { deleteItem } from '../cascade.js';

const r = Router();
r.use(requireAuth);

r.post('/', requireAdmin, async (req, res) => {
  const { project_id, name, type, floor, area_sqft, expected_rent, status, notes } = req.body || {};
  if (!project_id || !name) return res.status(400).json({ error: 'project_id and name are required' });
  if (!await q.get('SELECT 1 AS ok FROM rz_projects WHERE id = ?', Number(project_id))) return res.status(404).json({ error: 'Project not found' });
  const info = await q.run(
    'INSERT INTO rz_items (project_id, name, type, floor, area_sqft, expected_rent, status, notes) VALUES (?,?,?,?,?,?,?,?)',
    Number(project_id), name, type || 'shop', floor || null, area_sqft ? Number(area_sqft) : null,
    Number(expected_rent) || 0, status || 'vacant', notes || null);
  res.status(201).json(await q.get('SELECT * FROM rz_items WHERE id = ?', info.lastInsertRowid));
});

r.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const item = await q.get('SELECT * FROM rz_items WHERE id = ?', id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (!await canAccessProject(req.user, item.project_id)) return res.status(403).json({ error: 'No access to this item' });

  const [project, contracts, contractDocs, documents, transactions, totals] = await Promise.all([
    q.get('SELECT id, name, location FROM rz_projects WHERE id = ?', item.project_id),
    q.all('SELECT * FROM rz_contracts WHERE item_id = ? ORDER BY start_date DESC', id),
    q.all('SELECT * FROM rz_documents WHERE item_id = ? AND contract_id IS NOT NULL ORDER BY created_at DESC', id),
    q.all('SELECT * FROM rz_documents WHERE item_id = ? AND contract_id IS NULL ORDER BY created_at DESC', id),
    q.all('SELECT * FROM rz_transactions WHERE item_id = ? ORDER BY [date] DESC, id DESC', id),
    q.get(`SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount END),0) AS income,
                  COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0) AS expense
           FROM rz_transactions WHERE item_id = ?`, id),
  ]);
  const withDocs = contracts.map(c => ({ ...c, documents: contractDocs.filter(d => d.contract_id === c.id) }));
  res.json({ ...item, project, contracts: withDocs, documents, transactions, income: totals.income, expense: totals.expense, net: totals.income - totals.expense });
});

r.put('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const item = await q.get('SELECT * FROM rz_items WHERE id = ?', id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const b = req.body || {};
  await q.run('UPDATE rz_items SET name=?, type=?, floor=?, area_sqft=?, expected_rent=?, status=?, notes=? WHERE id=?',
    b.name ?? item.name, b.type ?? item.type, b.floor ?? item.floor,
    b.area_sqft !== undefined ? (b.area_sqft ? Number(b.area_sqft) : null) : item.area_sqft,
    b.expected_rent !== undefined ? Number(b.expected_rent) : item.expected_rent,
    b.status ?? item.status, b.notes ?? item.notes, id);
  res.json(await q.get('SELECT * FROM rz_items WHERE id = ?', id));
});

r.delete('/:id', requireAdmin, async (req, res) => {
  await deleteItem(Number(req.params.id));
  res.json({ ok: true });
});

export default r;
