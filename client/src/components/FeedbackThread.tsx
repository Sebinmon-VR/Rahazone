import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Reply, Trash2, Loader2, CornerDownRight } from 'lucide-react';
import type { Feedback } from '../lib/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date } from '../lib/format';
import { Empty, ErrorBanner, Spinner } from './ui';

type Props = { projectId?: number; itemId?: number; showContext?: boolean };

/** Feedback list with a compose box. Admins can reply; authors can delete their own. */
export default function FeedbackThread({ projectId, itemId, showContext }: Props) {
  const { user } = useAuth();
  const [list, setList] = useState<Feedback[] | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [reply, setReply] = useState('');
  const isAdmin = user?.role === 'admin';

  const load = () => {
    const qs = new URLSearchParams();
    if (itemId) qs.set('item_id', String(itemId));
    else if (projectId) qs.set('project_id', String(projectId));
    api<Feedback[]>(`/feedback?${qs}`).then(setList).catch(e => setError(e.message));
  };
  useEffect(load, [projectId, itemId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true); setError(null);
    try {
      await api('/feedback', { body: { project_id: projectId, item_id: itemId, message } });
      setMessage(''); load();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const sendReply = async (id: number) => {
    if (!reply.trim()) return;
    setBusy(true);
    try { await api(`/feedback/${id}/reply`, { body: { reply } }); setReply(''); setReplyTo(null); load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Delete this feedback?')) return;
    await api(`/feedback/${id}`, { method: 'DELETE' }); load();
  };

  if (!list) return <Spinner />;

  return (
    <div className="space-y-5">
      {(projectId || itemId) && (
        <form onSubmit={submit} className="card p-4">
          <textarea className="input min-h-[80px]" placeholder={isAdmin ? 'Add a note for shareholders…' : 'Share feedback, a question or a concern about this ' + (itemId ? 'unit' : 'project') + '…'}
            value={message} onChange={e => setMessage(e.target.value)} />
          <div className="mt-3 flex items-center justify-between">
            <ErrorBanner message={error} />
            <button className="btn-primary ml-auto" disabled={busy || !message.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}Post feedback
            </button>
          </div>
        </form>
      )}

      {list.length === 0 ? <Empty title="No feedback yet" hint="Feedback posted here is visible to the admin and to all shareholders of this project." /> : (
        <ul className="space-y-3">
          {list.map(f => (
            <li key={f.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-ink-2">
                  {f.user_name.split(' ').map(s => s[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium">{f.user_name}</span>
                    <span className="text-xs text-ink-3">{date(f.created_at)}</span>
                    {showContext && (
                      <span className="text-xs text-ink-3">
                        · <Link to={`/projects/${f.project_id}`} className="hover:text-brand-600">{f.project_name}</Link>
                        {f.item_id && <> / <Link to={`/items/${f.item_id}`} className="hover:text-brand-600">{f.item_name}</Link></>}
                      </span>
                    )}
                    {!showContext && f.item_name && !itemId && (
                      <Link to={`/items/${f.item_id}`} className="text-xs text-brand-600 hover:underline">{f.item_name}</Link>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{f.message}</p>

                  {f.admin_reply && (
                    <div className="mt-3 flex gap-2 rounded-lg bg-brand-50/70 px-3 py-2.5">
                      <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      <div className="text-sm">
                        <div className="text-xs text-brand-700 font-medium">Admin reply · {date(f.replied_at)}</div>
                        <p className="mt-0.5 whitespace-pre-wrap">{f.admin_reply}</p>
                      </div>
                    </div>
                  )}

                  {isAdmin && replyTo === f.id && (
                    <div className="mt-3">
                      <textarea className="input min-h-[70px]" autoFocus value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply…" />
                      <div className="mt-2 flex justify-end gap-2">
                        <button className="btn-secondary" onClick={() => setReplyTo(null)}>Cancel</button>
                        <button className="btn-primary" disabled={busy || !reply.trim()} onClick={() => sendReply(f.id)}>Send reply</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {isAdmin && replyTo !== f.id && (
                    <button className="btn-ghost p-1.5" title={f.admin_reply ? 'Edit reply' : 'Reply'} onClick={() => { setReplyTo(f.id); setReply(f.admin_reply || ''); }}>
                      <Reply className="h-4 w-4" />
                    </button>
                  )}
                  {(isAdmin || f.user_id === user?.id) && (
                    <button className="btn-ghost p-1.5 text-red-500 hover:text-red-600" title="Delete" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
