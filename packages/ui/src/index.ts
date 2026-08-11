export const designTokens = {
  colors: {
    ink: '#252620',
    paper: '#f6f1e7',
    green: '#407a5e',
    muted: '#706d63',
  },
  radii: { pill: 999, card: 2 },
  motion: { calm: 220, reveal: 420 },
} as const;

export type ThemeMode = 'light' | 'dark';
