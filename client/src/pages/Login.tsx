import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ErrorBanner, Field } from '../components/ui';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(email, password); navigate('/'); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm"><Building2 className="h-5 w-5" /></div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Sign in to Rahazone</h1>
          <p className="mt-1 text-sm text-ink-2">Property portfolio &amp; shareholder portal</p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          <Field label="Email"><input className="input" type="email" autoFocus autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></Field>
          <Field label="Password"><input className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></Field>
          <ErrorBanner message={error} />
          <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Sign in</button>
        </form>
      </div>
    </div>
  );
}
