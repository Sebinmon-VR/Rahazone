import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, MapPin, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ProjectDetail as PD, Transaction, User, Item } from '../lib/types';
import { money, pct, date, num, today } from '../lib/format';
import { Badge, Card, ConfirmButton, Empty, FormModal, PageHeader, Spinner, Stat, Tabs, ErrorBanner, type FieldDef } from '../components/ui';
import MonthlyChart from '../components/MonthlyChart';
import { DocumentList } from '../components/Documents';
import FeedbackThread from '../components/FeedbackThread';
import { projectFields } from './Projects';

type Tab = 'overview' | 'units' | 'transactions' | 'documents' | 'shareholders' | 'feedback';

export const itemFields: FieldDef[] = [
  { name: 'name', label: 'Unit name', required: true, placeholder: 'e.g. Shop G-01' },
  { name: 'type', label: 'Type', type: 'select', required: true, options: [
    { value: 'shop', label: 'Shop' }, { value: 'office', label: 'Office' }, { value: 'room', label: 'Room' },
    { value: 'apartment', label: 'Apartment' }, { value: 'warehouse', label: 'Warehouse' }, { value: 'parking', label: 'Parking' }, { value: 'other', label: 'Other' } ] },
  { name: 'floor', label: 'Floor', placeholder: 'Ground, 1, 2…' },
  { name: 'area_sqft', label: 'Area (sq ft)', type: 'number' },
  { name: 'expected_rent', label: 'Expected monthly rent ({cur})', type: 'number' },
  { name: 'status', label: 'Status', type: 'select', required: true, options: [
    { value: 'vacant', label: 'Vacant' }, { value: 'rented', label: 'Rented' }, { value: 'maintenance', label: 'Under maintenance' } ] },
  { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
];

const INCOME_CATS = ['rent', 'deposit', 'service charge', 'parking', 'other income'];
const EXPENSE_CATS = ['maintenance', 'utilities', 'management', 'insurance', 'municipality', 'renovation', 'salaries', 'marketing', 'other expense'];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [p, setP] = useState<PD | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [modal, setModal] = useState<null | 'edit' | 'item' | 'tx' | 'share'>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  const load = useCallback(() => api<PD>(`/projects/${id}`).then(setP).catch(e => setError(e.message)), [id]);
  const loadTx = useCallback(() => api<Transaction[]>(`/projects/${id}/transactions`).then(setTxs), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'transactions' && !txs) loadTx(); }, [tab, txs, loadTx]);
  useEffect(() => { if (isAdmin && tab === 'shareholders' && users.length === 0) api<User[]>('/users').then(u => setUsers(u.filter(x => x.role === 'user'))); }, [isAdmin, tab, users.length]);

  if (error) return <ErrorBanner message={error} />;
  if (!p) return <Spinner />;
  const pnl = p.pnl;
  const mine = pnl.share_percent !== undefined;
  const refresh = () => { load(); setTxs(null); if (tab === 'transactions') loadTx(); };

  return (
    <div>
      <PageHeader
        back={<Link to="/projects" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"><ArrowLeft className="h-4 w-4" />Projects</Link>}
        title={<span className="flex items-center gap-3">{p.name} <Badge tone={p.status}>{p.status}</Badge></span>}
        subtitle={<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {p.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.location}</span>}
          <span className="capitalize">{p.type}</span>
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{p.shareholder_count} shareholder{p.shareholder_count === 1 ? '' : 's'}</span>
          {mine && <span className="font-medium text-brand-700">Your share: {pct(pnl.share_percent)}</span>}
        </span>}
        actions={isAdmin && <>
          <button className="btn-secondary" onClick={() => setModal('edit')}><Pencil className="h-4 w-4" />Edit</button>
          <ConfirmButton message={`Delete "${p.name}" and everything in it?`} onConfirm={async () => { await api(`/projects/${p.id}`, { method: 'DELETE' }); navigate('/projects'); }}><Trash2 className="h-4 w-4" />Delete</ConfirmButton>
        </>} />

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'overview', label: 'Overview' },
        { key: 'units', label: 'Units', count: p.items.length },
        { key: 'transactions', label: 'Transactions' },
        { key: 'documents', label: 'Documents', count: p.documents.length },
        { key: 'shareholders', label: 'Shareholders', count: p.shareholders.length },
        { key: 'feedback', label: 'Feedback' },
      ]} />

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label={mine ? 'My net profit' : 'Net profit'} value={money(mine ? pnl.my_net : pnl.net)} tone={(mine ? pnl.my_net! : pnl.net) >= 0 ? 'pos' : 'neg'}
              hint={mine ? `Project total ${money(pnl.net)}` : 'All time'} />
            <Stat label={mine ? 'My income' : 'Income'} value={money(mine ? pnl.my_income : pnl.income)} hint={mine ? `Project total ${money(pnl.income)}` : undefined} />
            <Stat label={mine ? 'My expenses' : 'Expenses'} value={money(mine ? pnl.my_expense : pnl.expense)} hint={mine ? `Project total ${money(pnl.expense)}` : undefined} />
            <Stat label="Occupancy" value={`${p.item_count ? num((p.rented_count / p.item_count) * 100) : 0}%`} hint={`${p.rented_count} of ${p.item_count} units rented`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2" title={mine ? 'Project monthly income vs expense' : 'Monthly income vs expense'}>
              <MonthlyChart data={pnl.monthly} />
              {mine && <p className="mt-3 text-xs text-ink-3">Bars show project totals. Hover a month to see the net for your {pct(pnl.share_percent)} share.</p>}
            </Card>
            <Card title="Breakdown by category" padded={false}>
              {pnl.byCategory.length === 0 ? <div className="p-5 text-sm text-ink-3">No transactions yet.</div> : (
                <table className="tbl">
                  <tbody>
                    {pnl.byCategory.map(c => (
                      <tr key={c.type + c.category}>
                        <td><Badge tone={c.type}>{c.type}</Badge></td>
                        <td className="capitalize">{c.category}</td>
                        <td className="text-right font-medium whitespace-nowrap">{money(mine ? c.amount * pnl.share_percent! / 100 : c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
          {p.description && <Card title="About"><p className="text-sm text-ink-2 whitespace-pre-wrap">{p.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-ink-3">Total investment</dt><dd className="font-medium">{money(p.total_investment)}</dd></div>
              {mine && <div><dt className="text-xs text-ink-3">My investment</dt><dd className="font-medium">{money(p.invested_amount)}</dd></div>}
              <div><dt className="text-xs text-ink-3">Created</dt><dd className="font-medium">{date(p.created_at)}</dd></div>
            </dl></Card>}
        </div>
      )}

      {tab === 'units' && (
        <Card padded={false} title="Units" actions={isAdmin && <button className="btn-primary" onClick={() => setModal('item')}><Plus className="h-4 w-4" />Add unit</button>}>
          {p.items.length === 0 ? <Empty title="No units yet" hint="Add the shops, rooms or offices that belong to this project." /> : (
            <div className="overflow-x-auto"><table className="tbl">
              <thead><tr><th>Unit</th><th>Type</th><th>Floor</th><th>Area</th><th>Status</th><th>Tenant</th><th className="text-right">Rent / month</th><th>Contract ends</th></tr></thead>
              <tbody>
                {p.items.map((it: Item) => (
                  <tr key={it.id} className="clickable" onClick={() => navigate(`/items/${it.id}`)}>
                    <td className="font-medium">{it.name}</td>
                    <td className="capitalize">{it.type}</td>
                    <td>{it.floor || '—'}</td>
                    <td>{it.area_sqft ? `${num(it.area_sqft)} sq ft` : '—'}</td>
                    <td><Badge tone={it.status}>{it.status}</Badge></td>
                    <td>{it.tenant_name ? <>{it.tenant_name}{it.business_name && <div className="text-xs text-ink-3">{it.business_name}</div>}</> : <span className="text-ink-3">—</span>}</td>
                    <td className="text-right">{money(it.monthly_rent ?? it.expected_rent)}{!it.monthly_rent && <div className="text-xs text-ink-3">expected</div>}</td>
                    <td>{it.contract_end ? date(it.contract_end) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Card>
      )}

      {tab === 'transactions' && (
        <Card padded={false} title="Income & expenses" actions={isAdmin && <button className="btn-primary" onClick={() => { setEditTx(null); setModal('tx'); }}><Plus className="h-4 w-4" />Add entry</button>}>
          {!txs ? <Spinner /> : txs.length === 0 ? <Empty title="No transactions" hint="Record rent received and expenses paid to build the P&L." /> : (
            <div className="overflow-x-auto"><table className="tbl">
              <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Unit</th><th>Description</th><th className="text-right">Amount</th>{mine && <th className="text-right">My share</th>}{isAdmin && <th />}</tr></thead>
              <tbody>
                {txs.map(t => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap">{date(t.date)}</td>
                    <td><Badge tone={t.type}>{t.type}</Badge></td>
                    <td className="capitalize">{t.category}</td>
                    <td>{t.item_name || <span className="text-ink-3">Project</span>}</td>
                    <td className="text-ink-2 max-w-xs truncate">{t.description}</td>
                    <td className={`text-right font-medium whitespace-nowrap ${t.type === 'income' ? 'text-emerald-700' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '−'}{money(t.amount)}</td>
                    {mine && <td className="text-right whitespace-nowrap">{money(t.amount * pnl.share_percent! / 100)}</td>}
                    {isAdmin && <td className="text-right whitespace-nowrap">
                      <button className="btn-ghost p-1.5" onClick={() => { setEditTx(t); setModal('tx'); }}><Pencil className="h-4 w-4" /></button>
                      <button className="btn-ghost p-1.5 text-red-500" onClick={async () => { if (window.confirm('Delete this entry?')) { await api(`/projects/${p.id}/transactions/${t.id}`, { method: 'DELETE' }); refresh(); } }}><Trash2 className="h-4 w-4" /></button>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Card>
      )}

      {tab === 'documents' && (
        <Card title="Project documents"><DocumentList docs={p.documents} scope={{ project_id: p.id }} onChange={load} /></Card>
      )}

      {tab === 'shareholders' && (
        <Card padded={false} title={`Shareholders · ${num(p.allocated_percent, 2)}% allocated`}
          actions={isAdmin && <button className="btn-primary" onClick={() => setModal('share')}><Plus className="h-4 w-4" />Add / update share</button>}>
          {p.shareholders.length === 0 ? <Empty title="No shareholders yet" hint="Assign users a percentage share to give them access to this project." /> : (
            <table className="tbl">
              <thead><tr><th>Shareholder</th><th className="text-right">Share</th><th className="text-right">Invested</th><th className="text-right">Net profit share</th>{isAdmin && <th />}</tr></thead>
              <tbody>
                {p.shareholders.map(s => (
                  <tr key={s.id} className={s.user_id === user?.id ? 'bg-brand-50/40' : ''}>
                    <td><div className="font-medium">{s.name}{s.user_id === user?.id && <span className="ml-2 text-xs text-brand-600">you</span>}</div>{s.email && <div className="text-xs text-ink-3">{s.email}</div>}</td>
                    <td className="text-right">{pct(s.share_percent)}</td>
                    <td className="text-right">{money(s.invested_amount)}</td>
                    <td className="text-right font-medium">{money(pnl.net * s.share_percent / 100)}</td>
                    {isAdmin && <td className="text-right"><button className="btn-ghost p-1.5 text-red-500" onClick={async () => { if (window.confirm(`Remove ${s.name} from this project?`)) { await api(`/projects/${p.id}/shares/${s.user_id}`, { method: 'DELETE' }); load(); } }}><Trash2 className="h-4 w-4" /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'feedback' && <FeedbackThread projectId={p.id} />}

      {modal === 'edit' && (
        <FormModal title="Edit project" fields={projectFields} wide initial={{ ...p }} onClose={() => setModal(null)}
          onSubmit={async v => { await api(`/projects/${p.id}`, { method: 'PUT', body: v }); setModal(null); load(); }} />
      )}
      {modal === 'item' && (
        <FormModal title="Add unit" fields={itemFields} wide initial={{ type: 'shop', status: 'vacant' }} submitLabel="Add unit" onClose={() => setModal(null)}
          onSubmit={async v => { await api('/items', { body: { ...v, project_id: p.id } }); setModal(null); load(); }} />
      )}
      {modal === 'tx' && (
        <TxModal projectId={p.id} items={p.items} tx={editTx} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />
      )}
      {modal === 'share' && (
        <FormModal title="Assign share" onClose={() => setModal(null)} submitLabel="Save share"
          fields={[
            { name: 'user_id', label: 'Shareholder', type: 'select', required: true, options: users.map(u => ({ value: u.id, label: `${u.name} (${u.email})` })) },
            { name: 'share_percent', label: 'Share %', type: 'number', required: true, hint: `${num(100 - p.allocated_percent, 2)}% currently unallocated (existing share for this user is replaced)` },
            { name: 'invested_amount', label: 'Invested amount ({cur})', type: 'number' },
          ]}
          onSubmit={async v => { await api(`/projects/${p.id}/shares`, { method: 'PUT', body: v }); setModal(null); load(); }}
          footer={users.length === 0 && <span className="text-xs text-ink-3">No shareholder users yet. <Link to="/users" className="text-brand-600">Create one</Link>.</span>} />
      )}
    </div>
  );
}

export function TxModal({ projectId, items, tx, onClose, onDone, defaultItemId }:
  { projectId: number; items: Item[]; tx: Transaction | null; onClose: () => void; onDone: () => void; defaultItemId?: number }) {
  return (
    <FormModal title={tx ? 'Edit entry' : 'Add income / expense'} wide onClose={onClose} submitLabel={tx ? 'Save' : 'Add entry'}
      initial={{ type: tx?.type || 'income', category: tx?.category || INCOME_CATS[0], amount: tx?.amount, date: tx?.date || today(), item_id: tx?.item_id ?? defaultItemId ?? '', description: tx?.description }}
      fields={v => {
        const cats = v.type === 'expense' ? EXPENSE_CATS : INCOME_CATS;
        const catOpts = (cats.includes(v.category) || !v.category ? cats : [v.category, ...cats]).map(c => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }));
        return [
          { name: 'type', label: 'Type', type: 'select', required: true, options: [{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }] },
          { name: 'category', label: 'Category', type: 'select', required: true, options: catOpts },
          { name: 'amount', label: 'Amount ({cur})', type: 'number', required: true },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'item_id', label: 'Unit (optional)', type: 'select', options: items.map(i => ({ value: i.id, label: i.name })), span: 2 },
          { name: 'description', label: 'Description', type: 'textarea', span: 2 },
        ];
      }}
      onSubmit={async v => {
        const cats = v.type === 'expense' ? EXPENSE_CATS : INCOME_CATS;
        const body = { ...v, item_id: v.item_id || null, category: cats.includes(v.category) ? v.category : cats[0] };
        if (tx) await api(`/projects/${projectId}/transactions/${tx.id}`, { method: 'PUT', body });
        else await api(`/projects/${projectId}/transactions`, { body });
        onDone();
      }} />
  );
}
