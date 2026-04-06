import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { NavBar, Sidebar } from './NavBar';
import { Icon } from './Icon';
import * as api from '@/lib/api';
import { useTheme, THEMES } from '@/lib/theme';
import { formatFullDate, formatTime } from '@/lib/locale';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function ThemeBackground({ theme }: { theme: string }) {
  const themeDef = THEMES.find(t => t.id === theme);
  if (!themeDef?.image) return null;

  return (
    <div
      className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat pointer-events-none"
      style={{ backgroundImage: `url(${themeDef.image})` }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
}

export function Layout() {
  const now = useClock();
  const { theme } = useTheme();
  const [serverIp, setServerIp] = useState<string | null>(null);
  const [wifiRssi, setWifiRssi] = useState<number | null>(null);
  const [cpuTemp, setCpuTemp] = useState<number | null>(null);

  useEffect(() => {
    api.health().then(h => {
      if (h.ip) setServerIp(h.ip);
      if (h.wifiRssi != null) setWifiRssi(h.wifiRssi);
    }).catch(() => {});

    // Poll system status for CPU temp
    const fetchTemp = () => api.getSystemStatus().then(s => setCpuTemp(s.cpuTempC)).catch(() => {});
    fetchTemp();
    const id = setInterval(fetchTemp, 30000);
    return () => clearInterval(id);
  }, []);

  const dateStr = formatFullDate(now);
  const timeStr = formatTime(now);

  return (
    <div className={`min-h-screen ${theme === 'none' ? 'bg-surface' : 'bg-transparent'}`} data-theme-bg={theme !== 'none' ? '' : undefined}>
      <ThemeBackground theme={theme} />
      <Sidebar />
      <div className="lg:pl-64">
        {/* Mobile top bar — sticky */}
        <header className={`sticky top-0 z-40 flex lg:hidden h-10 items-center justify-between px-4 border-b border-outline-variant/30 ${
          theme === 'none' ? 'bg-surface-container-lowest/90 backdrop-blur-sm' : 'glass'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-[0.625rem] text-on-surface-variant font-mono">
              {dateStr}
            </span>
            <span className="text-[0.625rem] text-primary font-mono font-medium">
              {timeStr}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
            <span className="text-[0.625rem] uppercase text-on-surface-variant tracking-widest">Online</span>
          </div>
        </header>

        {/* Desktop top bar */}
        <header className={`hidden lg:flex h-16 items-center justify-between px-8 border-b border-outline-variant ${
          theme === 'none' ? 'bg-surface-container-lowest/80 backdrop-blur-sm' : 'glass'
        }`}>
          <div className="flex items-center gap-4">
            <Icon name="calendar_today" size={16} className="text-on-surface-variant" />
            <span className="text-label-sm text-on-surface-variant tracking-wider font-mono">
              {dateStr}
            </span>
            <span className="text-label-sm text-primary font-mono font-medium tracking-wider">
              {timeStr}
            </span>
          </div>
          <div className="flex items-center gap-5">
            {cpuTemp != null && (
              <span className={`flex items-center gap-1.5 text-label-sm tracking-wider font-mono ${
                cpuTemp > 70 ? 'text-critical' : cpuTemp > 55 ? 'text-secondary' : 'text-on-surface-variant'
              }`}>
                <Icon name="thermostat" size={14} />
                {cpuTemp.toFixed(0)}°C
              </span>
            )}
            {serverIp && (
              <span className="flex items-center gap-2 text-label-sm text-on-surface-variant tracking-wider font-mono">
                <Icon name="lan" size={14} className="text-on-surface-variant" />
                {serverIp}
              </span>
            )}
            {wifiRssi != null && (
              <span className={`flex items-center gap-2 text-label-sm tracking-wider font-mono ${
                wifiRssi >= -50 ? 'text-primary' : wifiRssi >= -70 ? 'text-on-surface-variant' : 'text-critical'
              }`}>
                <Icon name="wifi" size={14} />
                {wifiRssi} dBm · {wifiRssi >= -50 ? 'Excellent' : wifiRssi >= -70 ? 'Good' : 'Bad'}
              </span>
            )}
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
              <span className="text-label-sm uppercase text-on-surface-variant tracking-widest">
                Online
              </span>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="px-4 pt-4 pb-40 lg:px-8 lg:pt-6 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom info strip — above nav bar */}
      <div className={`fixed bottom-[68px] left-0 right-0 z-40 flex items-center justify-center gap-4 px-4 py-1.5 border-t border-outline-variant/20 lg:hidden ${
        theme === 'none' ? 'bg-surface-container-lowest/90 backdrop-blur-sm' : 'glass'
      }`}>
        {serverIp && (
          <span className="flex items-center gap-1 text-[0.625rem] text-on-surface-variant font-mono">
            <Icon name="lan" size={11} className="text-on-surface-variant/60" />
            {serverIp}
          </span>
        )}
        {cpuTemp != null && (
          <span className={`flex items-center gap-1 text-[0.625rem] font-mono ${
            cpuTemp > 70 ? 'text-critical' : cpuTemp > 55 ? 'text-secondary' : 'text-on-surface-variant'
          }`}>
            <Icon name="thermostat" size={11} />
            {cpuTemp.toFixed(0)}°C
          </span>
        )}
      </div>
      <NavBar />
    </div>
  );
}
