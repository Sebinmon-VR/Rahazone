import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { X, Loader2, Inbox } from 'lucide-react';
import { currencyCode } from '../lib/format';

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6">
      {back && <div className="mb-2 text-sm">{back}</div>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className = '', title, actions, padded = true }:
  { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode; padded?: boolean }) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
          <h3 className="text-sm font-semibold">{title}</h3>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'pos' | 'neg' | 'neutral' }) {
  const color = tone === 'pos' ? 'text-emerald-700' : tone === 'neg' ? 'text-red-600' : 'text-ink';
  return (
    <div className="card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-2">{hint}</div>}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  rented: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  vacant: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  maintenance: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  expired: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  terminated: 'bg-red-50 text-red-700 ring-red-600/20',
  income: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  expense: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  admin: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  user: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  completed: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  planning: 'bg-blue-50 text-blue-700 ring-blue-600/20',
};
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const cls = badgeTones[tone || String(children)] || 'bg-slate-100 text-slate-700 ring-slate-500/20';
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize ${cls}`}>{children}</span>;
}

export function Spinner({ className = '' }: { className?: string }) {
  return <div className={`flex justify-center py-16 text-ink-3 ${className}`}><Loader2 className="h-6 w-6 animate-spin" /></div>;
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="rounded-full bg-slate-100 p-3 text-ink-3"><Inbox className="h-5 w-5" /></div>
      <div className="mt-3 text-sm font-medium">{title}</div>
      {hint && <div className="mt-1 text-sm text-ink-2 max-w-sm">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>;
}

export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4" onMouseDown={onClose}>
      <div className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl`}
        onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn-ghost -mr-2 p-1.5" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export type FieldDef = {
  name: string; label: string;
  type?: 'text' | 'number' | 'date' | 'email' | 'password' | 'textarea' | 'select' | 'tel';
  options?: { value: string | number; label: string }[];
  required?: boolean; placeholder?: string; hint?: string; span?: 1 | 2; step?: string;
};

type Values = Record<string, unknown>;
const toStr = (v: unknown) => (v == null || typeof v === 'object' ? '' : String(v));

/** Generic modal form driven by a field list. */
export function FormModal({ title, fields: fieldsProp, initial = {}, onSubmit, onClose, submitLabel = 'Save', wide, footer }: {
  title: ReactNode; fields: FieldDef[] | ((values: Record<string, string>) => FieldDef[]); initial?: Values;
  onSubmit: (values: Record<string, string>) => Promise<void>; onClose: () => void; submitLabel?: string; wide?: boolean; footer?: ReactNode;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const names = (typeof fieldsProp === 'function' ? fieldsProp({}) : fieldsProp).map(f => f.name);
    return Object.fromEntries(names.map(n => [n, toStr(initial[n])]));
  });
  const fields = typeof fieldsProp === 'function' ? fieldsProp(values) : fieldsProp;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try { await onSubmit(values); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const set = (name: string, v: string) => setValues(s => ({ ...s, [name]: v }));

  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <form onSubmit={submit} className="space-y-4">
        <div className={`grid gap-4 ${wide ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
          {fields.map(f => (
            <Field key={f.name} label={f.label.replace('{cur}', currencyCode()) + (f.required ? ' *' : '')} hint={f.hint}
              className={f.span === 2 || (!wide) ? 'sm:col-span-2' : ''}>
              {f.type === 'textarea' ? (
                <textarea className="input min-h-[88px]" value={values[f.name]} placeholder={f.placeholder}
                  required={f.required} onChange={e => set(f.name, e.target.value)} />
              ) : f.type === 'select' ? (
                <select className="input" value={values[f.name]} required={f.required} onChange={e => set(f.name, e.target.value)}>
                  {!f.required && <option value="">—</option>}
                  {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input className="input" type={f.type || 'text'} value={values[f.name]} placeholder={f.placeholder}
                  required={f.required} step={f.step ?? (f.type === 'number' ? 'any' : undefined)} onChange={e => set(f.name, e.target.value)} />
              )}
            </Field>
          ))}
        </div>
        <ErrorBanner message={error} />
        <div className="flex items-center justify-between gap-2 pt-1">
          <div>{footer}</div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{submitLabel}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string; count?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line mb-5 -mx-1 px-1">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`relative px-3 py-2.5 text-sm whitespace-nowrap transition ${value === t.key ? 'text-brand-600 font-medium' : 'text-ink-2 hover:text-ink'}`}>
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-ink-2">{t.count}</span>}
          {value === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
        </button>
      ))}
    </div>
  );
}

export function ConfirmButton({ onConfirm, children, className = 'btn-danger', message = 'Are you sure? This cannot be undone.' }:
  { onConfirm: () => Promise<void> | void; children: ReactNode; className?: string; message?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button className={className} disabled={busy} onClick={async () => {
      if (!window.confirm(message)) return;
      setBusy(true); try { await onConfirm(); } finally { setBusy(false); }
    }}>{children}</button>
  );
}
