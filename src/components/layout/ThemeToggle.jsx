import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { writeStoredString } from '@/lib/browserStorage';
import { cn } from '@/lib/utils';

const THEME_STORAGE_KEY = 'theme';

function currentTheme() {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  writeStoredString('local', THEME_STORAGE_KEY, theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#050914' : '#f5f8fd');
}

export default function ThemeToggle({ className = undefined }) {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className={cn('findit-header-action shrink-0', className)}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
