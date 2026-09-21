import { q } from './db.js';

/** Aggregate P&L for a project, optionally filtered to a date range (YYYY-MM-DD). */
export async function projectPnl(projectId, { from, to } = {}) {
  const conds = ['project_id = ?'];
  const params = [projectId];
  if (from) { conds.push('[date] >= ?'); params.push(from); }
  if (to) { conds.push('[date] <= ?'); params.push(to); }
  const where = conds.join(' AND ');

  const [totals, monthly, byCategory] = await Promise.all([
    q.get(
      `SELECT
         COALESCE(SUM(CASE WHEN type='income' THEN amount END),0) AS income,
         COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0) AS expense
       FROM rz_transactions WHERE ${where}`, ...params),
    q.all(
      `SELECT LEFT([date],7) AS month,
         COALESCE(SUM(CASE WHEN type='income' THEN amount END),0) AS income,
         COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0) AS expense
       FROM rz_transactions WHERE ${where}
       GROUP BY LEFT([date],7) ORDER BY LEFT([date],7)`, ...params),
    q.all(
      `SELECT type, category, COALESCE(SUM(amount),0) AS amount
       FROM rz_transactions WHERE ${where}
       GROUP BY type, category ORDER BY type, SUM(amount) DESC`, ...params),
  ]);

  return {
    income: totals.income,
    expense: totals.expense,
    net: totals.income - totals.expense,
    monthly: monthly.map(m => ({ ...m, net: m.income - m.expense })),
    byCategory,
  };
}

/** Scale a project P&L down to one shareholder's portion. */
export function applyShare(pnl, sharePercent) {
  const f = sharePercent / 100;
  return {
    ...pnl,
    share_percent: sharePercent,
    my_income: pnl.income * f,
    my_expense: pnl.expense * f,
    my_net: pnl.net * f,
    monthly: pnl.monthly.map(m => ({ ...m, my_net: m.net * f })),
  };
}
