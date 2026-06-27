import type { Config } from 'tailwindcss';

const FONT_SERIF = [
  '"Source Serif 4"',
  '"Source Han Serif SC"',
  '"Noto Serif CJK SC"',
  '"Songti SC"',
  'serif',
].join(', ');

const FONT_MONO = [
  '"JetBrains Mono"',
  '"Fira Code"',
  '"SF Mono"',
  'ui-monospace',
  'monospace',
].join(', ');

/** Tailwind typography variant for chat markdown — use as `prose prose-hk-chat`. */
export const harnessChatTypography = {
  chat: {
    css: {
      fontSize: '0.9375rem',
      lineHeight: '1.65',
      color: 'var(--tw-prose-body)',
      p: { marginTop: '0', marginBottom: '0.65em' },
      'h1, h2, h3, h4, h5, h6': {
        color: 'var(--tw-prose-headings)',
        fontWeight: '600',
        letterSpacing: '-0.005em',
        lineHeight: '1.4',
        scrollMarginTop: '4rem',
      },
      'h1, h2, h3, h4': { fontFamily: FONT_SERIF },
      h1: {
        fontSize: '1.4em',
        fontWeight: '700',
        marginTop: '1.3em',
        marginBottom: '0.5em',
        paddingBottom: '0.3em',
        borderBottom: '1px solid var(--hk-border, var(--border))',
      },
      h2: { fontSize: '1.2em', fontWeight: '700', marginTop: '1.2em', marginBottom: '0.4em' },
      h3: { fontSize: '1.075em', fontWeight: '600', marginTop: '1.05em', marginBottom: '0.3em' },
      h4: { fontSize: '1em', fontWeight: '600', marginTop: '0.95em', marginBottom: '0.25em' },
      ':where(h1, h2, h3, h4, h5, h6):first-child': { marginTop: '0' },
      'ul, ol': { marginTop: '0.35em', marginBottom: '0.65em', paddingLeft: '1.4em' },
      li: { marginTop: '0.1em', marginBottom: '0.1em', paddingLeft: '0.2em', lineHeight: '1.6' },
      a: {
        color: 'var(--tw-prose-links)',
        fontWeight: '500',
        textDecoration: 'none',
        borderBottom: '1px solid color-mix(in srgb, var(--hk-accent, var(--accent)) 35%, transparent)',
      },
      code: {
        fontWeight: '500',
        fontSize: '0.86em',
        fontFamily: FONT_MONO,
        backgroundColor: 'var(--hk-surface-hover, var(--surface-hover))',
        padding: '0.12em 0.4em',
        borderRadius: '5px',
        border: '1px solid var(--hk-border, var(--border))',
      },
      'code::before': { content: '""' },
      'code::after': { content: '""' },
      pre: {
        marginTop: '0.7em',
        marginBottom: '0.7em',
        padding: '0',
        border: '1px solid var(--hk-border, var(--border))',
        borderRadius: '10px',
        backgroundColor: 'var(--hk-surface-hover, var(--surface-hover))',
        overflow: 'hidden',
        fontSize: '0.86em',
        lineHeight: '1.55',
        fontFamily: FONT_MONO,
      },
      'pre code': {
        display: 'block',
        padding: '0.75em 1em',
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: '0',
        fontWeight: '400',
        fontSize: 'inherit',
      },
      blockquote: {
        marginTop: '0.75em',
        marginBottom: '0.75em',
        paddingLeft: '0.9em',
        borderLeftWidth: '3px',
        borderLeftColor: 'var(--tw-prose-quote-borders)',
        fontFamily: FONT_SERIF,
        fontStyle: 'italic',
        color: 'var(--tw-prose-quotes)',
      },
      table: { width: '100%', fontSize: '0.875em', lineHeight: '1.5', borderCollapse: 'collapse' },
      '> :first-child': { marginTop: '0' },
      '> :last-child': { marginBottom: '0' },
    },
  },
} as const;

/** Drop-in Tailwind preset for HarnessKit chat UI. */
const harnessKitPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        background: 'var(--hk-background, var(--background))',
        surface: 'var(--hk-surface, var(--surface))',
        'surface-hover': 'var(--hk-surface-hover, var(--surface-hover))',
        border: 'var(--hk-border, var(--border))',
        'border-strong': 'var(--hk-border-strong, var(--border-strong))',
        foreground: 'var(--hk-text, var(--text))',
        'foreground-muted': 'var(--hk-text-muted, var(--text-muted))',
        accent: {
          DEFAULT: 'var(--hk-accent, var(--accent))',
          foreground: 'var(--hk-accent-fg, var(--accent-fg))',
        },
      },
      typography: () => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': 'var(--hk-text, var(--text))',
            '--tw-prose-headings': 'var(--hk-text, var(--text))',
            '--tw-prose-links': 'var(--hk-accent, var(--accent))',
            '--tw-prose-bold': 'var(--hk-text, var(--text))',
            '--tw-prose-counters': 'var(--hk-text-muted, var(--text-muted))',
            '--tw-prose-bullets': 'var(--hk-border-strong, var(--border-strong))',
            '--tw-prose-hr': 'var(--hk-border, var(--border))',
            '--tw-prose-quotes': 'var(--hk-text-muted, var(--text-muted))',
            '--tw-prose-quote-borders': 'var(--hk-accent, var(--accent))',
            '--tw-prose-code': 'var(--hk-text, var(--text))',
            '--tw-prose-pre-bg': 'var(--hk-surface-hover, var(--surface-hover))',
            maxWidth: 'none',
          },
        },
        ...harnessChatTypography,
      }),
    },
  },
};

export default harnessKitPreset;
