import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { deleteContract } from '../cascade.js';

const r = Router();
r.use(requireAuth, requireAdmin);

const FIELDS = ['tenant_name', 'tenant_phone', 'tenant_email', 'tenant_id_number', 'tenant_address',
  'business_name', 'start_date', 'end_date', 'monthly_rent', 'deposit', 'payment_day', 'status', 'notes'];

async function syncItemStatus(itemId) {
  const active = await q.get("SELECT 1 AS ok FROM rz_contracts WHERE item_id = ? AND status = 'active'", itemId);
  const item = await q.get('SELECT status FROM rz_items WHERE id = ?', itemId);
  if (!item) return;
  if (active && item.status !== 'rented') await q.run("UPDATE rz_items SET status = 'rented' WHERE id = ?", itemId);
  if (!active && item.status === 'rented') await q.run("UPDATE rz_items SET status = 'vacant' WHERE id = ?", itemId);
}

r.get('/', async (_req, res) => {
  res.json(await q.all(`
    SELECT c.*, i.name AS item_name, i.project_id, p.name AS project_name
    FROM rz_contracts c JOIN rz_items i ON i.id = c.item_id JOIN rz_projects p ON p.id = i.project_id
    ORDER BY CASE WHEN c.status = 'active' THEN 0 ELSE 1 END, c.end_date`));
});

r.post('/', async (req, res) => {
  const b = req.body || {};
  const itemId = Number(b.item_id);
  if (!itemId || !b.tenant_name || !b.start_date || !b.end_date) {
    return res.status(400).json({ error: 'item_id, tenant_name, start_date and end_date are required' });
  }
  if (!await q.get('SELECT 1 AS ok FROM rz_items WHERE id = ?', itemId)) return res.status(404).json({ error: 'Item not found' });
  if ((b.status || 'active') === 'active' && await q.get("SELECT 1 AS ok FROM rz_contracts WHERE item_id = ? AND status = 'active'", itemId)) {
    return res.status(409).json({ error: 'This item already has an active contract. End it first.' });
  }
  const info = await q.run(
    `INSERT INTO rz_contracts (item_id, ${FIELDS.join(',')}) VALUES (?, ${FIELDS.map(() => '?').join(',')})`,
    itemId, b.tenant_name, b.tenant_phone || null, b.tenant_email || null, b.tenant_id_number || null,
    b.tenant_address || null, b.business_name || null, b.start_date, b.end_date, Number(b.monthly_rent) || 0,
    Number(b.deposit) || 0, Number(b.payment_day) || 1, b.status || 'active', b.notes || null);
  await syncItemStatus(itemId);
  res.status(201).json(await q.get('SELECT * FROM rz_contracts WHERE id = ?', info.lastInsertRowid));
});

r.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const c = await q.get('SELECT * FROM rz_contracts WHERE id = ?', id);
  if (!c) return res.status(404).json({ error: 'Contract not found' });
  const b = req.body || {};
  if (b.status === 'active' && c.status !== 'active' &&
      await q.get("SELECT 1 AS ok FROM rz_contracts WHERE item_id = ? AND status = 'active' AND id != ?", c.item_id, id)) {
    return res.status(409).json({ error: 'Another contract is already active for this item' });
  }
  const values = FIELDS.map(f => {
    if (b[f] === undefined) return c[f];
    if (['monthly_rent', 'deposit', 'payment_day'].includes(f)) return Number(b[f]) || 0;
    return b[f] === '' ? null : b[f];
  });
  await q.run(`UPDATE rz_contracts SET ${FIELDS.map(f => `${f} = ?`).join(', ')} WHERE id = ?`, ...values, id);
  await syncItemStatus(c.item_id);
  res.json(await q.get('SELECT * FROM rz_contracts WHERE id = ?', id));
});

r.delete('/:id', async (req, res) => {
  const c = await q.get('SELECT item_id FROM rz_contracts WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Contract not found' });
  await deleteContract(Number(req.params.id));
  await syncItemStatus(c.item_id);
  res.json({ ok: true });
});

export default r;
