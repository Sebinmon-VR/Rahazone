import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CURRENCIES, money } from '../lib/format';
import { Badge, Card, ErrorBanner, Field, PageHeader } from '../components/ui';

export default function Settings() {
  const { user } = useAuth();
  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Settings" />
      <Card title="Account">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-ink-3">Name</dt><dd className="font-medium">{user?.name}</dd></div>
          <div><dt className="text-xs text-ink-3">Email</dt><dd className="font-medium">{user?.email}</dd></div>
          <div><dt className="text-xs text-ink-3">Phone</dt><dd className="font-medium">{user?.phone || '—'}</dd></div>
          <div><dt className="text-xs text-ink-3">Role</dt><dd><Badge tone={user?.role}>{user?.role}</Badge></dd></div>
        </dl>
        <p className="mt-3 text-xs text-ink-3">Contact the administrator to update your details.</p>
      </Card>
      {user?.role === 'admin' && <WorkspaceSettings />}
      <ChangePassword />
    </div>
  );
}

function WorkspaceSettings() {
  const { settings, updateSettings } = useAuth();
  const known = CURRENCIES.some(c => c.code === settings.currency);
  const [choice, setChoice] = useState(known ? settings.currency : 'other');
  const [custom, setCustom] = useState(known ? '' : settings.currency);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const code = (choice === 'other' ? custom : choice).trim().toUpperCase();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setOk(false); setBusy(true);
    try { await updateSettings({ currency: code }); setOk(true); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card title="Workspace">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Currency" hint="Used for every amount shown to admins and shareholders. Existing figures are not converted; only the label changes.">
          <div className="flex gap-2">
            <select className="input" value={choice} onChange={e => setChoice(e.target.value)}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
              <option value="other">Other…</option>
            </select>
            {choice === 'other' && (
              <input className="input w-28 uppercase" value={custom} maxLength={3} placeholder="e.g. MYR" required
                onChange={e => setCustom(e.target.value)} />
            )}
          </div>
        </Field>
        <div className="text-sm text-ink-2">Preview: <span className="font-medium text-ink">{previewWith(code)}</span></div>
        <ErrorBanner message={error} />
        {ok && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Currency updated to {settings.currency}.</div>}
        <button className="btn-primary" disabled={busy || code.length !== 3 || code === settings.currency}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}Save currency
        </button>
      </form>
    </Card>
  );
}

function previewWith(code: string) {
  if (!/^[A-Z]{3}$/.test(code)) return '—';
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'code', maximumFractionDigits: 0 }).format(191800).replace(/ /g, ' '); }
  catch { return money(191800); }
}

function ChangePassword() {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setOk(false);
    if (next !== confirm) return setError('New passwords do not match');
    setBusy(true);
    try { await api('/auth/change-password', { body: { current_password: cur, new_password: next } }); setOk(true); setCur(''); setNext(''); setConfirm(''); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card title="Change password">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Current password"><input className="input" type="password" value={cur} onChange={e => setCur(e.target.value)} required autoComplete="current-password" /></Field>
        <Field label="New password" hint="At least 6 characters"><input className="input" type="password" value={next} onChange={e => setNext(e.target.value)} required minLength={6} autoComplete="new-password" /></Field>
        <Field label="Confirm new password"><input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" /></Field>
        <ErrorBanner message={error} />
        {ok && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Password updated.</div>}
        <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Update password</button>
      </form>
    </Card>
  );
}
