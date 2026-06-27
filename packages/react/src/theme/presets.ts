import type { HarnessChatTheme } from './types.js';

export const lightTheme: HarnessChatTheme = {
  colors: {
    background: '#fafaf7',
    surface: '#ffffff',
    surfaceHover: '#f3f3f0',
    border: '#e5e3df',
    borderStrong: '#d0cec9',
    text: '#191919',
    textMuted: '#6f6e6a',
    accent: '#2563eb',
    accentForeground: '#ffffff',
    danger: '#c64242',
    dangerForeground: '#ffffff',
    userBubble: '#f0f4ff',
    assistantBubble: '#ffffff',
    composerBackground: '#ffffff',
    codeBackground: '#f5f5f0',
  },
  radius: { sm: '6px', md: '10px', lg: '14px' },
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

export const darkTheme: HarnessChatTheme = {
  colors: {
    background: '#1a1a1a',
    surface: '#222222',
    surfaceHover: '#2a2a2a',
    border: '#333333',
    borderStrong: '#404040',
    text: '#f5f5f0',
    textMuted: '#a0a0a0',
    accent: '#3b82f6',
    accentForeground: '#ffffff',
    danger: '#e06363',
    dangerForeground: '#ffffff',
    userBubble: '#1e293b',
    assistantBubble: '#222222',
    composerBackground: '#222222',
    codeBackground: '#2a2a2a',
  },
  radius: { sm: '6px', md: '10px', lg: '14px' },
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

export type ThemePreset = 'light' | 'dark';

export const resolvePreset = (preset: ThemePreset): HarnessChatTheme =>
  preset === 'dark' ? darkTheme : lightTheme;
