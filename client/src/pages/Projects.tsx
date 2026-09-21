import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Project } from '../lib/types';
import { money, pct } from '../lib/format';
import { Badge, Empty, FormModal, PageHeader, Spinner, ErrorBanner, type FieldDef } from '../components/ui';

export const projectFields: FieldDef[] = [
  { name: 'name', label: 'Project name', required: true, placeholder: 'e.g. Al Noor Tower' },
  { name: 'location', label: 'Location', placeholder: 'Area, city' },
  { name: 'type', label: 'Type', type: 'select', required: true, options: [
    { value: 'building', label: 'Building' }, { value: 'plaza', label: 'Plaza / Mall' }, { value: 'warehouse', label: 'Warehouse' },
    { value: 'residential', label: 'Residential' }, { value: 'land', label: 'Land' }, { value: 'other', label: 'Other' } ] },
  { name: 'status', label: 'Status', type: 'select', required: true, options: [
    { value: 'active', label: 'Active' }, { value: 'planning', label: 'Planning' }, { value: 'completed', label: 'Completed' } ] },
  { name: 'total_investment', label: 'Total investment ({cur})', type: 'number' },
  { name: 'description', label: 'Description', type: 'textarea', span: 2 },
];

export default function Projects() {
  const { user } = useAuth();
  const [list, setList] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  const isAdmin = user?.role === 'admin';
  const load = () => api<Project[]>('/projects').then(setList).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader title="Projects" subtitle={isAdmin ? 'All properties in the portfolio.' : 'Projects you hold shares in.'}
        actions={isAdmin && <button className="btn-primary" onClick={() => setCreate(true)}><Plus className="h-4 w-4" />New project</button>} />
      <ErrorBanner message={error} />
      {!list ? <Spinner /> : list.length === 0 ? (
        <div className="card"><Empty title="No projects" hint={isAdmin ? 'Create a project, then add units, shareholders and transactions.' : 'Ask the administrator to assign you shares.'} /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map(p => {
            const net = isAdmin ? p.net : (p.my_net ?? 0);
            const occ = p.item_count ? Math.round((p.rented_count / p.item_count) * 100) : 0;
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="card p-5 transition hover:border-brand-500/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{p.name}</h3>
                    {p.location && <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-2"><MapPin className="h-3 w-3" />{p.location}</div>}
                  </div>
                  <Badge tone={p.status}>{p.status}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-ink-3">{isAdmin ? 'Net profit' : 'My net profit'}</div><div className={`font-semibold ${net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{money(net)}</div></div>
                  <div><div className="text-xs text-ink-3">{isAdmin ? 'Shareholders' : 'My share'}</div><div className="font-semibold">{isAdmin ? p.shareholder_count : pct(p.share_percent)}</div></div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-ink-2"><span>Occupancy</span><span>{p.rented_count}/{p.item_count} units</span></div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${occ}%` }} /></div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {create && (
        <FormModal title="New project" fields={projectFields} wide submitLabel="Create project" onClose={() => setCreate(false)}
          initial={{ type: 'building', status: 'active' }}
          onSubmit={async v => { await api('/projects', { body: v }); setCreate(false); load(); }} />
      )}
    </div>
  );
}
