'use client';
import { Moon, Sun } from 'lucide-react';
import { useStudioTheme } from '@/lib/theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, toggle] = useStudioTheme();
  const label = theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro';
  return <button type="button" onClick={toggle} title={label} aria-label={label}
    className={'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mist transition-colors hover:bg-raised hover:text-ink ' + className}>
    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
  </button>;
}
