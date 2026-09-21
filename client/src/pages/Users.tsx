import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { User } from '../lib/types';
import { date } from '../lib/format';
import { Badge, Card, Empty, FormModal, PageHeader, Spinner, ErrorBanner, type FieldDef } from '../components/ui';

export default function Users() {
  const { user: me } = useAuth();
  const [list, setList] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'new' | User>(null);
  const load = () => api<User[]>('/users').then(setList).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const fields = (edit: boolean): FieldDef[] => [
    { name: 'name', label: 'Full name', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone', type: 'tel' },
    { name: 'role', label: 'Role', type: 'select', required: true, options: [{ value: 'user', label: 'Shareholder (user)' }, { value: 'admin', label: 'Administrator' }] },
    { name: 'password', label: edit ? 'New password' : 'Password', type: 'password', required: !edit, hint: edit ? 'Leave blank to keep the current password' : 'Share this with the user; they can change it later' },
  ];

  return (
    <div>
      <PageHeader title="Users" subtitle="Administrators manage everything. Shareholders see only the projects they hold shares in."
        actions={<button className="btn-primary" onClick={() => setModal('new')}><Plus className="h-4 w-4" />Add user</button>} />
      <ErrorBanner message={error} />
      <Card padded={false}>
        {!list ? <Spinner /> : list.length === 0 ? <Empty title="No users" /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Projects</th><th>Joined</th><th /></tr></thead>
            <tbody>
              {list.map(u => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}{u.id === me?.id && <span className="ml-2 text-xs text-brand-600">you</span>}</td>
                  <td>{u.email}</td>
                  <td>{u.phone || <span className="text-ink-3">—</span>}</td>
                  <td><Badge tone={u.role}>{u.role}</Badge></td>
                  <td>{u.project_count}</td>
                  <td className="whitespace-nowrap">{date(u.created_at)}</td>
                  <td className="text-right whitespace-nowrap">
                    <button className="btn-ghost p-1.5" onClick={() => setModal(u)}><Pencil className="h-4 w-4" /></button>
                    {u.id !== me?.id && <button className="btn-ghost p-1.5 text-red-500" onClick={async () => {
                      if (window.confirm(`Delete ${u.name}? Their shares and feedback will be removed.`)) { await api(`/users/${u.id}`, { method: 'DELETE' }); load(); }
                    }}><Trash2 className="h-4 w-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
      {modal === 'new' && (
        <FormModal title="Add user" fields={fields(false)} initial={{ role: 'user' }} submitLabel="Create user" onClose={() => setModal(null)}
          onSubmit={async v => { await api('/users', { body: v }); setModal(null); load(); }} />
      )}
      {modal && modal !== 'new' && (
        <FormModal title={`Edit ${modal.name}`} fields={fields(true)} initial={{ ...modal }} onClose={() => setModal(null)}
          onSubmit={async v => { const body = { ...v, password: v.password || undefined }; await api(`/users/${modal.id}`, { method: 'PUT', body }); setModal(null); load(); }} />
      )}
    </div>
  );
}
