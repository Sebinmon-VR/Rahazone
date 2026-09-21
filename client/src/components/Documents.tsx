import { useState, type FormEvent } from 'react';
import { FileText, Image as ImageIcon, Download, Trash2, Upload, Loader2 } from 'lucide-react';
import type { Doc } from '../lib/types';
import { api, documentUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date, fileSize } from '../lib/format';
import { Empty, ErrorBanner, Field, Modal } from './ui';

const CATEGORIES = ['contract', 'title deed', 'invoice', 'insurance', 'permit', 'photo', 'other'];

type Scope = { project_id?: number; item_id?: number; contract_id?: number };

export function DocumentList({ docs, scope, onChange, compact }: { docs: Doc[]; scope: Scope; onChange: () => void; compact?: boolean }) {
  const { user } = useAuth();
  const [upload, setUpload] = useState(false);
  const isAdmin = user?.role === 'admin';

  const remove = async (d: Doc) => {
    if (!window.confirm(`Delete "${d.title}"?`)) return;
    await api(`/documents/${d.id}`, { method: 'DELETE' });
    onChange();
  };

  return (
    <div>
      {docs.length === 0 ? (
        compact ? <div className="text-sm text-ink-3">No documents</div>
          : <Empty title="No documents yet" hint={isAdmin ? 'Upload contracts, deeds, invoices or photos.' : undefined}
              action={isAdmin && <button className="btn-primary" onClick={() => setUpload(true)}><Upload className="h-4 w-4" />Upload</button>} />
      ) : (
        <ul className="divide-y divide-line">
          {docs.map(d => (
            <li key={d.id} className="flex items-center gap-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-ink-2">
                {d.mime_type?.startsWith('image/') ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <a href={documentUrl(d.id, true)} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:text-brand-600">{d.title}</a>
                <div className="text-xs text-ink-3 capitalize">{d.category} · {fileSize(d.size)} · {date(d.created_at)}</div>
              </div>
              <a href={documentUrl(d.id)} className="btn-ghost p-1.5" title="Download"><Download className="h-4 w-4" /></a>
              {isAdmin && <button className="btn-ghost p-1.5 text-red-500 hover:text-red-600" title="Delete" onClick={() => remove(d)}><Trash2 className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>
      )}
      {isAdmin && docs.length > 0 && (
        <button className="btn-secondary mt-3" onClick={() => setUpload(true)}><Upload className="h-4 w-4" />Upload document</button>
      )}
      {upload && <UploadModal scope={scope} onClose={() => setUpload(false)} onDone={() => { setUpload(false); onChange(); }} />}
    </div>
  );
}

export function UploadButton({ scope, onDone, className = 'btn-secondary' }: { scope: Scope; onDone: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}><Upload className="h-4 w-4" />Upload</button>
      {open && <UploadModal scope={scope} onClose={() => setOpen(false)} onDone={() => { setOpen(false); onDone(); }} />}
    </>
  );
}

function UploadModal({ scope, onClose, onDone }: { scope: Scope; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(scope.contract_id ? 'contract' : 'other');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return setError('Choose a file');
    setBusy(true); setError(null);
    const form = new FormData();
    form.append('file', file);
    form.append('title', title || file.name);
    form.append('category', category);
    Object.entries(scope).forEach(([k, v]) => v && form.append(k, String(v)));
    try { await api('/documents', { form }); onDone(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Upload document" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="File *" hint="PDF, images, Word, Excel or text. Max 25 MB.">
          <input type="file" className="input file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"
            onChange={e => { const f = e.target.files?.[0] || null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '')); }} />
        </Field>
        <Field label="Title"><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Tenancy contract 2026" /></Field>
        <Field label="Category">
          <select className="input capitalize" value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <ErrorBanner message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Upload</button>
        </div>
      </form>
    </Modal>
  );
}
