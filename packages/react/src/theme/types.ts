/** Semantic color tokens for HarnessKit chat UI */
export type HarnessChatColors = {
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentForeground: string;
  danger: string;
  dangerForeground: string;
  /** User message bubble background */
  userBubble?: string;
  /** Assistant message bubble background */
  assistantBubble?: string;
  /** Composer / input area background */
  composerBackground?: string;
  /** Tool trace / code block background */
  codeBackground?: string;
};

export type HarnessChatRadius = {
  sm: string;
  md: string;
  lg: string;
};

export type HarnessChatTheme = {
  colors: HarnessChatColors;
  radius?: HarnessChatRadius;
  fontFamily?: string;
};

/** Partial override — unset fields fall back to preset or parent theme */
export type HarnessChatThemeInput = {
  colors?: Partial<HarnessChatColors>;
  radius?: Partial<HarnessChatRadius>;
  fontFamily?: string;
};

/** Map host app CSS variable names → HarnessKit semantic tokens */
export type CssVariableMap = {
  background?: string;
  surface?: string;
  surfaceHover?: string;
  border?: string;
  borderStrong?: string;
  text?: string;
  textMuted?: string;
  accent?: string;
  accentForeground?: string;
  danger?: string;
  dangerForeground?: string;
};

export const DEFAULT_CSS_VAR_MAP: Required<CssVariableMap> = {
  background: '--background',
  surface: '--surface',
  surfaceHover: '--surface-hover',
  border: '--border',
  borderStrong: '--border-strong',
  text: '--text',
  textMuted: '--text-muted',
  accent: '--accent',
  accentForeground: '--accent-fg',
  danger: '--danger',
  dangerForeground: '--danger-fg',
};
