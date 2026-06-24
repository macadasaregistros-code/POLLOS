import { lazy, Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Activity, BarChart3, CalendarClock, ClipboardList, FileText, Home, Map, Package, RefreshCcw, Shield, Truck, UserRound } from 'lucide-react';
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { getCurrentUser, getOrCreateSupabaseUser, switchRole } from './services/authService';
import { db, prepareRemoteLocalData, resetLocalDemoData, seedDemoDataIfNeeded } from './services/localDbService';
import { getSupabaseSession, isSupabaseAuthRequired, signInSupabase, type SupabaseSession } from './services/supabaseAuthService';
import { bootstrapFromRemote, processSyncQueue } from './services/syncService';
import type { MainView } from './types/navigation';
import type { Role, Usuario } from './types/entities';

const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const GalponeroHome = lazy(() => import('./features/galponero/GalponeroHome').then((module) => ({ default: module.GalponeroHome })));

const FORCE_RESET_KEY = 'pollos.forceResetDb';
const RESET_ATTEMPTED_KEY = 'pollos.resetAttempted';

const adminNavItems: Array<{ view: MainView; label: string; icon: typeof Home }> = [
  { view: 'inicio', label: 'Inicio', icon: Home },
  { view: 'actividades', label: 'Hechas', icon: Activity },
  { view: 'galpones', label: 'Galpones', icon: Map },
  { view: 'lotes', label: 'Lotes', icon: ClipboardList },
  { view: 'hojasManejo', label: 'Hojas manejo', icon: FileText },
  { view: 'entradas', label: 'Entradas', icon: Truck },
  { view: 'programacion', label: 'Programacion', icon: CalendarClock },
  { view: 'inventario', label: 'Inventario', icon: Package },
  { view: 'reportes', label: 'Reportes', icon: BarChart3 },
];

const galponeroNavItems: Array<{ view: MainView; label: string; icon: typeof Home }> = [
  { view: 'actividades', label: 'Hoy', icon: Activity },
  { view: 'galpones', label: 'Galpones', icon: Map },
  { view: 'entrada', label: 'Entrada', icon: Truck },
];

function getDefaultViewForRole(role: Role): MainView {
  return role === 'GALPONERO' ? 'actividades' : 'inicio';
}

function getNavItemsForRole(role: Role): Array<{ view: MainView; label: string; icon: typeof Home }> {
  return role === 'GALPONERO' ? galponeroNavItems : adminNavItems;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'No se pudo iniciar la app.';
}

export function App() {
  const [user, setUser] = useState<Usuario>();
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [repairing, setRepairing] = useState(false);
  const [supabaseSession, setSupabaseSession] = useState<SupabaseSession | undefined>(() => getSupabaseSession());
  const supabaseRequired = isSupabaseAuthRequired();

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (supabaseRequired && !supabaseSession) {
        setUser(undefined);
        setBooting(false);
        return;
      }

      setBooting(true);
      setBootError('');
      try {
        if (supabaseRequired) {
          await prepareRemoteLocalData();
          if (!supabaseSession) throw new Error('Inicia sesion en Supabase.');
          if (!cancelled) setUser(await getOrCreateSupabaseUser(supabaseSession));
        } else {
          await seedDemoDataIfNeeded();
          if (!cancelled) setUser(await getCurrentUser());
        }
        localStorage.removeItem(RESET_ATTEMPTED_KEY);
      } catch (error) {
        if (localStorage.getItem(RESET_ATTEMPTED_KEY) !== '1') {
          localStorage.setItem(RESET_ATTEMPTED_KEY, '1');
          localStorage.setItem(FORCE_RESET_KEY, '1');
          window.location.reload();
          return;
        }
        if (!cancelled) setBootError(getErrorMessage(error));
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [supabaseRequired, supabaseSession]);

  async function handleEmergencyReset() {
    setRepairing(true);
    try {
      localStorage.removeItem(RESET_ATTEMPTED_KEY);
      localStorage.setItem(FORCE_RESET_KEY, '1');
      window.location.href = `${window.location.origin}${window.location.pathname}?resetDb=1`;
    } catch (error) {
      setBootError(getErrorMessage(error));
      setRepairing(false);
    }
  }

  if (bootError) {
    return (
      <div className="boot-screen boot-screen--error">
        <div>
          <strong>No se pudo cargar POLLOS</strong>
          <span>{bootError}</span>
          <button type="button" onClick={handleEmergencyReset} disabled={repairing}>
            {repairing ? 'Restaurando...' : 'Restaurar base local'}
          </button>
        </div>
      </div>
    );
  }

  if (supabaseRequired && !supabaseSession) {
    return <SupabaseLogin onSignedIn={setSupabaseSession} />;
  }

  if (booting || !user) {
    return <div className="boot-screen">Cargando POLLOS...</div>;
  }

  return (
    <AuthenticatedApp
      user={user}
      setUser={setUser}
      allowDemoReset={!supabaseRequired}
      allowRoleSwitch={!supabaseRequired}
    />
  );
}

function SupabaseLogin({ onSignedIn }: { onSignedIn: (session: SupabaseSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      onSignedIn(await signInSupabase(email.trim(), password));
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'No se pudo iniciar sesion.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="boot-screen boot-screen--auth">
      <form className="auth-panel" onSubmit={handleSubmit}>
        <strong>POLLOS</strong>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Clave</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        {error && <span className="auth-panel__error">{error}</span>}
        <button className="primary-action" type="submit" disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

function AuthenticatedApp({
  user,
  setUser,
  allowDemoReset,
  allowRoleSwitch,
}: {
  user: Usuario;
  setUser: (user: Usuario) => void;
  allowDemoReset: boolean;
  allowRoleSwitch: boolean;
}) {
  const [toast, setToast] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [bootstrappedRemote, setBootstrappedRemote] = useState(false);
  const [activeRoleView, setActiveRoleView] = useState<Role>(() => user.Rol);
  const [activeView, setActiveView] = useState<MainView>(() => getDefaultViewForRole(user.Rol));
  const online = useOnlineStatus();
  const pendingCount = useLiveQuery(() => db.syncQueue.where('EstadoSync').equals('PENDIENTE').count(), []);
  const failedCount = useLiveQuery(() => db.syncQueue.where('EstadoSync').equals('ERROR').count(), []);
  const visibleRole = user.Rol === 'ADMIN' ? activeRoleView : user.Rol;
  const canSwitchRoleView = user.Rol === 'ADMIN' || allowRoleSwitch;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (user.Rol === 'ADMIN') return;
    setActiveRoleView('GALPONERO');
    setActiveView((currentView) => (galponeroNavItems.some((item) => item.view === currentView) ? currentView : 'actividades'));
  }, [user.Rol]);

  useEffect(() => {
    if (online && user && (pendingCount ?? 0) + (failedCount ?? 0) > 0) {
      void handleSync();
    }
  }, [online, user, pendingCount, failedCount]);

  useEffect(() => {
    if (!online || !user || bootstrappedRemote) return;
    setBootstrappedRemote(true);
    bootstrapFromRemote(user).then((result) => {
      if (result.error) setToast(`Bootstrap remoto falló: ${result.error}`);
      else if (!result.skipped && result.updatedRows > 0) setToast(`Bootstrap remoto: ${result.updatedRows} fila(s) actualizada(s).`);
    });
  }, [bootstrappedRemote, online, user]);

  async function handleRoleChange(role: Role) {
    if (user.Rol === 'ADMIN') {
      setActiveRoleView(role);
      handleViewChange(getDefaultViewForRole(role));
      return;
    }

    if (!allowRoleSwitch) return;

    const nextUser = await switchRole(role);
    setUser(nextUser);
    setActiveRoleView(nextUser.Rol);
    handleViewChange(getDefaultViewForRole(nextUser.Rol));
    setBootstrappedRemote(false);
  }

  function handleViewChange(view: MainView) {
    setActiveView(view);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  async function handleSync() {
    if (!user || syncing) return;
    setSyncing(true);
    try {
      const result = await processSyncQueue(user);
      if (result.failed > 0) setToast(`${result.failed} registro(s) siguen guardados en este dispositivo; no se pudieron enviar.`);
      else if (result.synced > 0) setToast(`${result.synced} registro(s) enviados.`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleResetDemo() {
    await resetLocalDemoData();
    const nextUser = await getCurrentUser();
    setUser(nextUser);
    setToast('Datos demo restaurados.');
  }

  return (
    <div className="app">
      <header className="top-bar">
        <div className="top-bar__brand">
          <strong>POLLOS</strong>
          {canSwitchRoleView && (
            <div className="role-switch" aria-label={user.Rol === 'ADMIN' ? 'Selector de vista' : 'Selector de rol'}>
              <button className={visibleRole === 'GALPONERO' ? 'is-active' : ''} type="button" onClick={() => handleRoleChange('GALPONERO')}>
                <UserRound size={18} />
                Galponero
              </button>
              <button className={visibleRole === 'ADMIN' ? 'is-active' : ''} type="button" onClick={() => handleRoleChange('ADMIN')}>
                <Shield size={18} />
                Admin
              </button>
            </div>
          )}
        </div>
        <div className="top-bar__actions">
          {allowDemoReset && (
            <button className="icon-text-button" type="button" onClick={handleResetDemo} aria-label="Restaurar datos demo">
              <RefreshCcw size={17} />
              <span className="button-label">Demo</span>
            </button>
          )}
          <SyncStatusBadge pendingCount={pendingCount ?? 0} failedCount={failedCount ?? 0} online={online} syncing={syncing} onSync={handleSync} />
        </div>
      </header>

      {visibleRole === 'GALPONERO' && (
        <Suspense fallback={<div className="boot-screen">Cargando operacion...</div>}>
          <GalponeroHome user={user} activeView={activeView} onViewChange={handleViewChange} onToast={setToast} />
        </Suspense>
      )}
      {visibleRole === 'ADMIN' && (
        <Suspense fallback={<div className="boot-screen">Cargando administracion...</div>}>
          <AdminDashboard user={user} activeView={activeView} onToast={setToast} />
        </Suspense>
      )}

      <MainNavigation role={visibleRole} activeView={activeView} onViewChange={handleViewChange} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function MainNavigation({ role, activeView, onViewChange }: { role: Role; activeView: MainView; onViewChange: (view: MainView) => void }) {
  const navItems = getNavItemsForRole(role);
  return (
    <nav className="app-main-nav" aria-label="Menu principal">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.view}
            className={activeView === item.view ? 'is-active' : ''}
            type="button"
            aria-current={activeView === item.view ? 'page' : undefined}
            onClick={() => onViewChange(item.view)}
          >
            <Icon size={21} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
