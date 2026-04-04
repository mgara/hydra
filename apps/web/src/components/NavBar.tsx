import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';
import { useTheme } from '@/lib/theme';

const links = [
  { to: '/', icon: 'home', label: 'Home' },
  { to: '/schedules', icon: 'calendar_month', label: 'Schedule' },
  { to: '/alerts', icon: 'notifications', label: 'Alerts' },
  { to: '/settings', icon: 'settings', label: 'Settings' },
];

export function NavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-outline-variant lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={link.icon} filled={isActive} size={22} />
                <span className="text-label-sm">{link.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Sidebar() {
  const { theme } = useTheme();
  const hasBg = theme !== 'none';
  return (
    <aside className={`hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-40 border-r border-outline-variant ${
      hasBg ? 'glass' : 'bg-surface-container-low'
    }`}>
      {/* Branding */}
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Icon name="water_drop" className="text-primary" size={20} />
        </div>
        <div>
          <h1 className="font-headline text-sm font-bold text-on-surface tracking-wider">HYDRA</h1>
          <p className="text-label-sm text-on-surface-variant">CONTROLLER</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {[
          { to: '/', icon: 'dashboard', label: 'Dashboard' },
          { to: '/schedules', icon: 'calendar_month', label: 'Schedules' },
          { to: '/logs', icon: 'history', label: 'History' },
          { to: '/alerts', icon: 'notifications', label: 'Alerts' },
          { to: '/settings', icon: 'settings', label: 'Settings' },
          { to: '/advanced', icon: 'admin_panel_settings', label: 'Advanced' },
        ].map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={link.icon} filled={isActive} size={20} />
                {link.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-outline-variant">
        <p className="text-label-sm text-on-surface-variant">v3.0.0</p>
      </div>
    </aside>
  );
}
