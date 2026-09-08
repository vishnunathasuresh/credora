'use client';

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from './icons';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('credora-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    window.localStorage.setItem('credora-theme', next ? 'dark' : 'light');
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      type="button"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={dark}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
      <span>{dark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
