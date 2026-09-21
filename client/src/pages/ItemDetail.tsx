import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Phone, Mail, IdCard, MapPin, Building2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ItemDetail as ID, Contract } from '../lib/types';
import { money, date, num, daysUntil } from '../lib/format';
import { Badge, Card, ConfirmButton, Empty, FormModal, PageHeader, Spinner, Stat, Tabs, ErrorBanner, type FieldDef } from '../components/ui';
import { DocumentList } from '../components/Documents';
import FeedbackThread from '../components/FeedbackThread';
import { itemFields, TxModal } from './ProjectDetail';

type Tab = 'contract' | 'history' | 'transactions' | 'documents' | 'feedback';

const contractFields: FieldDef[] = [
  { name: 'tenant_name', label: 'Tenant name', required: true },
  { name: 'business_name', label: 'Business / trade name' },
  { name: 'tenant_phone', label: 'Phone', type: 'tel' },
  { name: 'tenant_email', label: 'Email', type: 'email' },
  { name: 'tenant_id_number', label: 'ID / licence number' },
  { name: 'tenant_address', label: 'Address' },
  { name: 'start_date', label: 'Start date', type: 'date', required: true },
  { name: 'end_date', label: 'End date', type: 'date', required: true },
  { name: 'monthly_rent', label: 'Monthly rent ({cur})', type: 'number', required: true },
  { name: 'deposit', label: 'Security deposit ({cur})', type: 'number' },
  { name: 'payment_day', label: 'Rent due day of month', type: 'number' },
  { name: 'status', label: 'Status', type: 'select', required: true, options: [
    { value: 'active', label: 'Active' }, { value: 'expired', label: 'Expired' }, { value: 'terminated', label: 'Terminated' } ] },
  { name: 'notes', label: 'Notes / terms', type: 'textarea', span: 2 },
];

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [it, setIt] = useState<ID | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('contract');
  const [modal, setModal] = useState<null | 'edit' | 'contract' | 'tx'>(null);
  const [editContract, setEditContract] = useState<Contract | null>(null);

  const load = useCallback(() => api<ID>(`/items/${id}`).then(setIt).catch(e => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorBanner message={error} />;
  if (!it) return <Spinner />;
  const active = it.contracts.find(c => c.status === 'active') || null;
  const history = it.contracts.filter(c => c.status !== 'active');

  return (
    <div>
      <PageHeader
        back={<Link to={`/projects/${it.project_id}`} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"><ArrowLeft className="h-4 w-4" />{it.project.name}</Link>}
        title={<span className="flex items-center gap-3">{it.name} <Badge tone={it.status}>{it.status}</Badge></span>}
        subtitle={<span className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="capitalize">{it.type}</span>
          {it.floor && <span>Floor {it.floor}</span>}
          {it.area_sqft && <span>{num(it.area_sqft)} sq ft</span>}
          <span>Expected rent {money(it.expected_rent)}/mo</span>
        </span>}
        actions={isAdmin && <>
          <button className="btn-secondary" onClick={() => setModal('edit')}><Pencil className="h-4 w-4" />Edit unit</button>
          <ConfirmButton message={`Delete "${it.name}" and its contracts, documents and feedback?`} onConfirm={async () => { await api(`/items/${it.id}`, { method: 'DELETE' }); navigate(`/projects/${it.project_id}`); }}><Trash2 className="h-4 w-4" />Delete</ConfirmButton>
        </>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <Stat label="Net from this unit" value={money(it.net)} tone={it.net >= 0 ? 'pos' : 'neg'} />
        <Stat label="Income" value={money(it.income)} />
        <Stat label="Expenses" value={money(it.expense)} />
        <Stat label="Current rent" value={active ? money(active.monthly_rent) : '—'} hint={active ? `${active.tenant_name}` : 'No active tenant'} />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'contract', label: 'Current contract' },
        { key: 'history', label: 'Contract history', count: history.length },
        { key: 'transactions', label: 'Transactions', count: it.transactions.length },
        { key: 'documents', label: 'Unit documents', count: it.documents.length },
        { key: 'feedback', label: 'Feedback' },
      ]} />

      {tab === 'contract' && (active ? <ContractCard c={active} isAdmin={isAdmin} onEdit={() => { setEditContract(active); setModal('contract'); }} onChange={load} /> : (
        <Card><Empty title="No active contract" hint="This unit is currently not rented out."
          action={isAdmin && <button className="btn-primary" onClick={() => { setEditContract(null); setModal('contract'); }}><Plus className="h-4 w-4" />New contract</button>} /></Card>
      ))}

      {tab === 'history' && (
        history.length === 0 ? <Card><Empty title="No past contracts" /></Card> : (
          <div className="space-y-4">{history.map(c => <ContractCard key={c.id} c={c} isAdmin={isAdmin} onEdit={() => { setEditContract(c); setModal('contract'); }} onChange={load} />)}</div>
        )
      )}

      {tab === 'transactions' && (
        <Card padded={false} title="Transactions for this unit" actions={isAdmin && <button className="btn-primary" onClick={() => setModal('tx')}><Plus className="h-4 w-4" />Add entry</button>}>
          {it.transactions.length === 0 ? <Empty title="No transactions" /> : (
            <div className="overflow-x-auto"><table className="tbl">
              <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th className="text-right">Amount</th></tr></thead>
              <tbody>{it.transactions.map(t => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{date(t.date)}</td><td><Badge tone={t.type}>{t.type}</Badge></td><td className="capitalize">{t.category}</td>
                  <td className="text-ink-2">{t.description}</td>
                  <td className={`text-right font-medium whitespace-nowrap ${t.type === 'income' ? 'text-emerald-700' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '−'}{money(t.amount)}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Card>
      )}

      {tab === 'documents' && <Card title="Unit documents"><DocumentList docs={it.documents} scope={{ item_id: it.id }} onChange={load} /></Card>}
      {tab === 'feedback' && <FeedbackThread itemId={it.id} />}

      {it.notes && <Card className="mt-6" title="Notes"><p className="text-sm text-ink-2 whitespace-pre-wrap">{it.notes}</p></Card>}

      {modal === 'edit' && (
        <FormModal title="Edit unit" fields={itemFields} wide initial={{ ...it }} onClose={() => setModal(null)}
          onSubmit={async v => { await api(`/items/${it.id}`, { method: 'PUT', body: v }); setModal(null); load(); }} />
      )}
      {modal === 'contract' && (
        <FormModal title={editContract ? 'Edit contract' : 'New tenancy contract'} fields={contractFields} wide
          initial={editContract ? { ...editContract } : { status: 'active', payment_day: 1, monthly_rent: it.expected_rent }}
          submitLabel={editContract ? 'Save' : 'Create contract'} onClose={() => setModal(null)}
          onSubmit={async v => {
            if (editContract) await api(`/contracts/${editContract.id}`, { method: 'PUT', body: v });
            else await api('/contracts', { body: { ...v, item_id: it.id } });
            setModal(null); load();
          }} />
      )}
      {modal === 'tx' && (
        <TxModal projectId={it.project_id} items={[{ ...it }]} defaultItemId={it.id} tx={null} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

function ContractCard({ c, isAdmin, onEdit, onChange }: { c: Contract; isAdmin: boolean; onEdit: () => void; onChange: () => void }) {
  const left = daysUntil(c.end_date);
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2"><h3 className="text-base font-semibold">{c.tenant_name}</h3><Badge tone={c.status}>{c.status}</Badge></div>
          {c.business_name && <div className="text-sm text-ink-2 flex items-center gap-1 mt-0.5"><Building2 className="h-3.5 w-3.5" />{c.business_name}</div>}
        </div>
        {isAdmin && <div className="flex gap-2">
          <button className="btn-secondary" onClick={onEdit}><Pencil className="h-4 w-4" />Edit</button>
          {c.status === 'active' && <ConfirmButton className="btn-secondary" message="Mark this contract as terminated? The unit will become vacant."
            onConfirm={async () => { await api(`/contracts/${c.id}`, { method: 'PUT', body: { status: 'terminated' } }); onChange(); }}>End contract</ConfirmButton>}
          <ConfirmButton message="Delete this contract and its documents?" onConfirm={async () => { await api(`/contracts/${c.id}`, { method: 'DELETE' }); onChange(); }}><Trash2 className="h-4 w-4" /></ConfirmButton>
        </div>}
      </div>
      <div className="grid gap-6 p-5 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Tenant details</h4>
          <dl className="space-y-2 text-sm">
            <Info icon={Phone} label="Phone" value={c.tenant_phone} />
            <Info icon={Mail} label="Email" value={c.tenant_email} />
            <Info icon={IdCard} label="ID / licence" value={c.tenant_id_number} />
            <Info icon={MapPin} label="Address" value={c.tenant_address} />
          </dl>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Terms</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <KV k="Start" v={date(c.start_date)} />
            <KV k="End" v={<>{date(c.end_date)}{c.status === 'active' && <span className={`ml-1 text-xs ${left < 0 ? 'text-red-600' : left <= 60 ? 'text-amber-600' : 'text-ink-3'}`}>({left < 0 ? `${-left}d overdue` : `${left}d left`})</span>}</>} />
            <KV k="Monthly rent" v={money(c.monthly_rent)} />
            <KV k="Deposit" v={money(c.deposit)} />
            <KV k="Rent due" v={`Day ${c.payment_day} of month`} />
            <KV k="Annual value" v={money(c.monthly_rent * 12)} />
          </dl>
          {c.notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-ink-2 whitespace-pre-wrap">{c.notes}</p>}
        </div>
      </div>
      <div className="border-t border-line px-5 py-4">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Contract documents</h4>
        <DocumentList docs={c.documents || []} scope={{ contract_id: c.id }} onChange={onChange} compact />
      </div>
    </Card>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value?: string | null }) {
  return <div className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" /><div><dt className="text-xs text-ink-3">{label}</dt><dd>{value || <span className="text-ink-3">—</span>}</dd></div></div>;
}
function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="text-xs text-ink-3">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
