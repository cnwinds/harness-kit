import { darkTheme, lightTheme, resolvePreset, type ThemePreset } from './presets.js';
import type {
  CssVariableMap,
  HarnessChatTheme,
  HarnessChatThemeInput,
} from './types.js';
import { DEFAULT_CSS_VAR_MAP } from './types.js';

const mergeTheme = (base: HarnessChatTheme, input?: HarnessChatThemeInput): HarnessChatTheme => ({
  ...base,
  fontFamily: input?.fontFamily ?? base.fontFamily,
  radius: { ...base.radius!, ...input?.radius },
  colors: { ...base.colors, ...input?.colors },
});

export type ResolveThemeOptions = {
  preset?: ThemePreset;
  theme?: HarnessChatThemeInput;
};

/** Resolve final theme from preset + partial overrides */
export const resolveTheme = (options: ResolveThemeOptions = {}): HarnessChatTheme => {
  const base = options.preset ? resolvePreset(options.preset) : lightTheme;
  return mergeTheme(base, options.theme);
};

/** Read host app CSS variables and map to HarnessChatTheme (for brand inheritance) */
export const themeFromCssVariables = (
  element: Element = document.documentElement,
  map: CssVariableMap = DEFAULT_CSS_VAR_MAP,
): HarnessChatThemeInput => {
  const style = getComputedStyle(element);
  const read = (varName: string | undefined) =>
    varName ? style.getPropertyValue(varName).trim() : '';

  return {
    colors: {
      background: read(map.background) || undefined,
      surface: read(map.surface) || undefined,
      surfaceHover: read(map.surfaceHover) || undefined,
      border: read(map.border) || undefined,
      borderStrong: read(map.borderStrong) || undefined,
      text: read(map.text) || undefined,
      textMuted: read(map.textMuted) || undefined,
      accent: read(map.accent) || undefined,
      accentForeground: read(map.accentForeground) || undefined,
      danger: read(map.danger) || undefined,
      dangerForeground: read(map.dangerForeground) || undefined,
    },
  };
};

/** CSS custom property names used inside .hk-chat scope */
export const HK_CSS_VARS = {
  background: '--hk-background',
  surface: '--hk-surface',
  surfaceHover: '--hk-surface-hover',
  border: '--hk-border',
  borderStrong: '--hk-border-strong',
  text: '--hk-text',
  textMuted: '--hk-text-muted',
  accent: '--hk-accent',
  accentForeground: '--hk-accent-fg',
  danger: '--hk-danger',
  dangerForeground: '--hk-danger-fg',
  userBubble: '--hk-user-bubble',
  assistantBubble: '--hk-assistant-bubble',
  composerBackground: '--hk-composer-bg',
  codeBackground: '--hk-code-bg',
  radiusSm: '--hk-radius-sm',
  radiusMd: '--hk-radius-md',
  radiusLg: '--hk-radius-lg',
  fontFamily: '--hk-font-family',
} as const;

export const themeToCssProperties = (theme: HarnessChatTheme): Record<string, string> => {
  const { colors, radius, fontFamily } = theme;
  return {
    [HK_CSS_VARS.background]: colors.background,
    [HK_CSS_VARS.surface]: colors.surface,
    [HK_CSS_VARS.surfaceHover]: colors.surfaceHover,
    [HK_CSS_VARS.border]: colors.border,
    [HK_CSS_VARS.borderStrong]: colors.borderStrong,
    [HK_CSS_VARS.text]: colors.text,
    [HK_CSS_VARS.textMuted]: colors.textMuted,
    [HK_CSS_VARS.accent]: colors.accent,
    [HK_CSS_VARS.accentForeground]: colors.accentForeground,
    [HK_CSS_VARS.danger]: colors.danger,
    [HK_CSS_VARS.dangerForeground]: colors.dangerForeground,
    [HK_CSS_VARS.userBubble]: colors.userBubble ?? colors.surface,
    [HK_CSS_VARS.assistantBubble]: colors.assistantBubble ?? colors.surface,
    [HK_CSS_VARS.composerBackground]: colors.composerBackground ?? colors.surface,
    [HK_CSS_VARS.codeBackground]: colors.codeBackground ?? colors.surfaceHover,
    [HK_CSS_VARS.radiusSm]: radius?.sm ?? '6px',
    [HK_CSS_VARS.radiusMd]: radius?.md ?? '10px',
    [HK_CSS_VARS.radiusLg]: radius?.lg ?? '14px',
    [HK_CSS_VARS.fontFamily]: fontFamily ?? 'system-ui, sans-serif',
  };
};

/** Merge preset + overrides + optional host CSS variable inheritance */
export const resolveThemeWithInheritance = (
  options: ResolveThemeOptions & {
    inheritCssVariables?: boolean | CssVariableMap;
  } = {},
): HarnessChatTheme => {
  let inherited: HarnessChatThemeInput | undefined;
  if (options.inheritCssVariables && typeof document !== 'undefined') {
    const map =
      options.inheritCssVariables === true ? DEFAULT_CSS_VAR_MAP : options.inheritCssVariables;
    inherited = themeFromCssVariables(document.documentElement, map);
  }
  const base = resolveTheme(options);
  return mergeTheme(base, { ...inherited, ...options.theme });
};

export { darkTheme, lightTheme };
