import { createContext, useContext } from 'react';

export type ThemeId = 'none' | 'lawn' | 'japanese-garden' | 'topiary' | 'zen-garden';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  /** Path to background image (empty for none) */
  image: string;
}

export const THEMES: ThemeDef[] = [
  { id: 'none',            name: 'None',            image: '' },
  { id: 'lawn',            name: 'Lawn',            image: '/bg/lawn.png' },
  { id: 'japanese-garden', name: 'Japanese Garden',  image: '/bg/japanese-garden.webp' },
  { id: 'topiary',         name: 'Topiary',         image: '/bg/topiary.webp' },
  { id: 'zen-garden',      name: 'Zen Garden',      image: '/bg/zen-garden.webp' },
];

const STORAGE_KEY = 'hydra-theme';

export function loadTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES.some(t => t.id === saved)) return saved as ThemeId;
  } catch {}
  return 'none';
}

export function saveTheme(id: ThemeId): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
}

export const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}>({ theme: 'none', setTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}
