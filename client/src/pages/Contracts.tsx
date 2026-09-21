import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Contract } from '../lib/types';
import { money, date, daysUntil } from '../lib/format';
import { Badge, Card, Empty, PageHeader, Spinner, ErrorBanner } from '../components/ui';

export default function Contracts() {
  const [list, setList] = useState<Contract[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'ending' | 'inactive'>('active');
  const [search, setSearch] = useState('');
  useEffect(() => { api<Contract[]>('/contracts').then(setList).catch(e => setError(e.message)); }, []);

  const rows = (list || []).filter(c => {
    if (filter === 'active' && c.status !== 'active') return false;
    if (filter === 'inactive' && c.status === 'active') return false;
    if (filter === 'ending' && !(c.status === 'active' && daysUntil(c.end_date) <= 60)) return false;
    const s = search.toLowerCase();
    return !s || [c.tenant_name, c.business_name, c.item_name, c.project_name, c.tenant_phone].some(v => v?.toLowerCase().includes(s));
  });
  const activeRent = (list || []).filter(c => c.status === 'active').reduce((a, c) => a + c.monthly_rent, 0);

  return (
    <div>
      <PageHeader title="Contracts" subtitle={list ? `${list.filter(c => c.status === 'active').length} active · ${money(activeRent)} monthly rent roll` : 'All tenancy contracts across projects.'} />
      <ErrorBanner message={error} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="input sm:max-w-xs" placeholder="Search tenant, unit, project…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex rounded-lg border border-line bg-white p-0.5 text-sm">
          {(['active', 'ending', 'inactive', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1.5 capitalize transition ${filter === f ? 'bg-slate-100 font-medium' : 'text-ink-2 hover:text-ink'}`}>{f === 'ending' ? 'Ending soon' : f}</button>
          ))}
        </div>
      </div>
      <Card padded={false}>
        {!list ? <Spinner /> : rows.length === 0 ? <Empty title="No contracts match" hint="Contracts are created from a unit's page." /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Tenant</th><th>Unit</th><th>Project</th><th>Period</th><th className="text-right">Rent / month</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(c => {
                const left = daysUntil(c.end_date);
                return (
                  <tr key={c.id}>
                    <td><div className="font-medium">{c.tenant_name}</div>{c.business_name && <div className="text-xs text-ink-3">{c.business_name}</div>}</td>
                    <td><Link to={`/items/${c.item_id}`} className="hover:text-brand-600">{c.item_name}</Link></td>
                    <td><Link to={`/projects/${c.project_id}`} className="hover:text-brand-600">{c.project_name}</Link></td>
                    <td className="whitespace-nowrap">{date(c.start_date)} → {date(c.end_date)}
                      {c.status === 'active' && <div className={`text-xs ${left < 0 ? 'text-red-600' : left <= 60 ? 'text-amber-600' : 'text-ink-3'}`}>{left < 0 ? `${-left} days overdue` : `${left} days left`}</div>}</td>
                    <td className="text-right font-medium">{money(c.monthly_rent)}</td>
                    <td><Badge tone={c.status}>{c.status}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
