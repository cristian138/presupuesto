import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Wallet, 
  CalendarDays, 
  CreditCard, 
  FileText, 
  Users, 
  ClipboardList, 
  Settings, 
  LogOut,
  Bell
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_audit-pay-track/artifacts/ha0eypok_ICONO-NEGATIVO--SIN-FONDO.png";

export const Sidebar = () => {
  const { user, logout, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/budgets', icon: Wallet, label: 'Presupuestos' },
    { to: '/monthly', icon: CalendarDays, label: 'Vista Mensual' },
    { to: '/payments', icon: CreditCard, label: 'Pagos' },
    { to: '/reports', icon: FileText, label: 'Reportes' },
  ];

  const adminItems = [
    { to: '/users', icon: Users, label: 'Usuarios' },
    { to: '/audit', icon: ClipboardList, label: 'Auditoría' },
    { to: '/notifications', icon: Bell, label: 'Notificaciones' },
  ];

  return (
    <aside className="bg-[#002D54] text-white h-screen fixed left-0 top-0 w-64 flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-sm flex items-center justify-center">
            <img src={LOGO_URL} alt="Logo" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <h1 className="font-chivo font-bold text-sm">Control Presupuestal</h1>
            <p className="text-[10px] text-white/50 uppercase tracking-wider">Sistema Financiero</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-3 mb-2">
          <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold px-3">
            Principal
          </span>
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => 
              `sidebar-link mx-2 ${isActive ? 'active' : ''}`
            }
            data-testid={`nav-${item.to.replace('/', '')}`}
          >
            <item.icon size={18} />
            <span className="text-sm">{item.label}</span>
          </NavLink>
        ))}

        {isSuperAdmin() && (
          <>
            <div className="px-3 mt-6 mb-2">
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold px-3">
                Administración
              </span>
            </div>
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 
                  `sidebar-link mx-2 ${isActive ? 'active' : ''}`
                }
                data-testid={`nav-${item.to.replace('/', '')}`}
              >
                <item.icon size={18} />
                <span className="text-sm">{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-[10px] text-white/50 uppercase tracking-wider">
              {user?.role === 'super_admin' ? 'Super Admin' : 'Contable'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white/10 hover:bg-white/20 rounded-sm text-sm transition-colors"
          data-testid="logout-btn"
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
};

export const Header = ({ title, subtitle, children }) => {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-chivo font-bold text-xl text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {children && <div className="flex items-center gap-3">{children}</div>}
      </div>
    </header>
  );
};

export const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Sidebar />
      <main className="ml-64">
        {children}
      </main>
    </div>
  );
};
