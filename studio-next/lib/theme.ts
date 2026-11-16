'use client';
/** Tema de la aplicación Studio (no del documento del cliente). Fuente única: <html data-theme>. */
import { useSyncExternalStore } from 'react';

export type StudioTheme = 'light' | 'dark';
const KEY = 'wayup-studio-theme';
const EVENT = 'wayup-theme-change';

function current(): StudioTheme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}
export function setStudioTheme(theme: StudioTheme): void {
  const root = document.documentElement;
  root.classList.add('wu-theme-anim');
  root.dataset.theme = theme;
  root.dataset.studioTheme = theme; // compatibilidad con estilos heredados del editor de demostración
  try { localStorage.setItem(KEY, theme); } catch {}
  window.dispatchEvent(new Event(EVENT));
  window.setTimeout(() => root.classList.remove('wu-theme-anim'), 220);
}
function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
      document.documentElement.dataset.theme = e.newValue;
      document.documentElement.dataset.studioTheme = e.newValue;
      callback();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener('storage', onStorage); };
}
export function useStudioTheme(): [StudioTheme, () => void] {
  const theme = useSyncExternalStore(subscribe, current, () => 'dark' as StudioTheme);
  return [theme, () => setStudioTheme(theme === 'dark' ? 'light' : 'dark')];
}
