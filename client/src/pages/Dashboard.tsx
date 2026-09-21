import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Portfolio } from '../lib/types';
import { money, num, pct, date, daysUntil } from '../lib/format';
import { Card, Empty, PageHeader, Spinner, Stat, ErrorBanner } from '../components/ui';
import MonthlyChart from '../components/MonthlyChart';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<Portfolio>('/projects/portfolio').then(setData).catch(e => setError(e.message)); }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <Spinner />;
  const isAdmin = user?.role === 'admin';
  const t = data.totals;
  const occupancy = t.items ? (t.rented / t.items) * 100 : 0;

  return (
    <div>
      <PageHeader title={`Good ${greeting()}, ${user?.name.split(' ')[0]}`}
        subtitle={isAdmin ? 'Portfolio overview across all projects.' : 'Your share of income and expenses across the projects you hold.'} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={isAdmin ? 'Net profit' : 'My net profit'} value={money(t.net)} tone={t.net >= 0 ? 'pos' : 'neg'} hint="All time" />
        <Stat label={isAdmin ? 'Income' : 'My income'} value={money(t.income)} />
        <Stat label={isAdmin ? 'Expenses' : 'My expenses'} value={money(t.expense)} />
        <Stat label="Occupancy" value={`${num(occupancy)}%`} hint={`${t.rented} of ${t.items} units rented`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={isAdmin ? 'Monthly income vs expense' : 'My monthly share'}>
          <MonthlyChart data={data.monthly} />
        </Card>
        <Card title="At a glance">
          <dl className="space-y-3 text-sm">
            <Row k="Projects" v={data.project_count} />
            <Row k="Total units" v={t.items} />
            <Row k={isAdmin ? 'Total investment' : 'My investment'} v={money(t.invested)} />
            <Row k={isAdmin ? 'Unanswered feedback' : 'My feedback posts'} v={data.feedback_count} />
          </dl>
          <Link to="/projects" className="btn-secondary mt-5 w-full">View projects <ArrowRight className="h-4 w-4" /></Link>
        </Card>
      </div>

      <div className={`mt-6 grid gap-6 ${isAdmin ? 'lg:grid-cols-3' : ''}`}>
        <Card className={isAdmin ? 'lg:col-span-2' : ''} title="Projects" padded={false}>
          {data.projects.length === 0 ? <Empty title="No projects yet" hint={isAdmin ? 'Create your first project to get started.' : 'You have not been assigned shares in any project yet.'} /> : (
            <table className="tbl">
              <thead><tr><th>Project</th><th>Units</th>{!isAdmin && <th>My share</th>}<th className="text-right">{isAdmin ? 'Net' : 'My net'}</th></tr></thead>
              <tbody>
                {data.projects.map(p => (
                  <tr key={p.id} className="clickable" onClick={() => location.assign(`/projects/${p.id}`)}>
                    <td><Link to={`/projects/${p.id}`} className="font-medium hover:text-brand-600" onClick={e => e.stopPropagation()}>{p.name}</Link><div className="text-xs text-ink-3">{p.location}</div></td>
                    <td>{p.rented_count}/{p.item_count} rented</td>
                    {!isAdmin && <td>{pct(p.share_percent)}</td>}
                    <td className={`text-right font-medium ${(isAdmin ? p.net : p.my_net ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{money(isAdmin ? p.net : p.my_net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        {isAdmin && (
          <Card title="Contracts ending soon" padded={false}>
            {data.expiring_contracts.length === 0 ? <div className="p-5 text-sm text-ink-3">Nothing expiring in the next 60 days.</div> : (
              <ul className="divide-y divide-line">
                {data.expiring_contracts.map(c => {
                  const d = daysUntil(c.end_date);
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                      <AlertCircle className={`h-4 w-4 shrink-0 ${d < 0 ? 'text-red-500' : d <= 30 ? 'text-amber-500' : 'text-ink-3'}`} />
                      <div className="min-w-0 flex-1 text-sm">
                        <Link to={`/items/${c.item_id}`} className="font-medium hover:text-brand-600">{c.item_name}</Link>
                        <span className="text-ink-3"> · {c.project_name}</span>
                        <div className="text-xs text-ink-2 truncate">{c.tenant_name}</div>
                      </div>
                      <div className="text-right text-xs"><div>{date(c.end_date)}</div><div className={d < 0 ? 'text-red-600' : 'text-ink-3'}>{d < 0 ? `${-d}d overdue` : `${d}d left`}</div></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><dt className="text-ink-2">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
function greeting() { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; }
