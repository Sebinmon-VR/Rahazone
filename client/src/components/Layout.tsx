import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, FileSignature, MessageSquare, Users, Settings, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../lib/auth';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: Building2 },
  { to: '/contracts', label: 'Contracts', icon: FileSignature, admin: true },
  { to: '/feedback', label: 'Feedback', icon: MessageSquare },
  { to: '/users', label: 'Users', icon: Users, admin: true },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = nav.filter(n => !n.admin || user?.role === 'admin');

  const links = (
    <nav className="flex flex-col gap-0.5">
      {items.map(n => (
        <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
            isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-ink-2 hover:bg-slate-100 hover:text-ink'}`}>
          <n.icon className="h-4 w-4" />{n.label}
        </NavLink>
      ))}
    </nav>
  );

  const userBlock = (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
        {user?.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{user?.name}</div>
        <div className="truncate text-xs text-ink-3 capitalize">{user?.role === 'admin' ? 'Administrator' : 'Shareholder'}</div>
      </div>
      <button className="btn-ghost p-1.5" title="Sign out" onClick={() => { logout(); navigate('/login'); }}><LogOut className="h-4 w-4" /></button>
    </div>
  );

  return (
    <div className="flex min-h-full">
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-line bg-white px-3 py-4">
        <Brand />
        <div className="mt-6 flex-1">{links}</div>
        {userBlock}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="lg:hidden flex items-center justify-between border-b border-line bg-white px-4 py-3">
          <Brand />
          <button className="btn-ghost p-1.5" onClick={() => setOpen(o => !o)} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </header>
        {open && (
          <div className="lg:hidden border-b border-line bg-white px-3 py-3">
            {links}
            <div className="mt-2 border-t border-line pt-2">{userBlock}</div>
          </div>
        )}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white"><Building2 className="h-4 w-4" /></div>
      <span className="text-base font-semibold tracking-tight">Rahazone</span>
    </div>
  );
}
