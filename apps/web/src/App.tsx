import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Schedules } from '@/pages/Schedules';
import { Alerts } from '@/pages/Alerts';
import { Logs } from '@/pages/Logs';
import { Settings } from '@/pages/Settings';
import { Advanced } from '@/pages/Advanced';
import { Setup } from '@/pages/Setup';
import * as api from '@/lib/api';
import { ThemeContext, loadTheme, saveTheme, type ThemeId } from '@/lib/theme';

export function App() {
  const [mode, setMode] = useState<'loading' | 'setup' | 'operational'>('loading');
  const [theme, setThemeState] = useState<ThemeId>(loadTheme);

  const setTheme = (id: ThemeId) => {
    setThemeState(id);
    saveTheme(id);
  };

  useEffect(() => {
    api.health()
      .then((h) => setMode(h.mode === 'setup' ? 'setup' : 'operational'))
      .catch(() => setMode('operational')); // fallback to operational if health fails
  }, []);

  if (mode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="h-3 w-3 rounded-full bg-primary animate-pulse-glow mx-auto mb-4" />
          <p className="text-label-sm uppercase tracking-widest text-on-surface-variant">Connecting</p>
        </div>
      </div>
    );
  }

  if (mode === 'setup') {
    return <Setup />;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/advanced" element={<Advanced />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeContext.Provider>
  );
}
