/**
 * Strip model-internal reasoning markers from user-visible assistant text.
 * Qwen / DashScope may emit `` or full
 * `...` blocks into output_text while reasoning lives elsewhere.
 */
export const sanitizeAssistantVisibleText = (text: string): string => {
  if (!text) {
    return text;
  }

  return text
    .replace(/<(?:think(?:ing)?|redacted_thinking)>[\s\S]*?<\/(?:think(?:ing)?|redacted_thinking)>/gi, '')
    .replace(/<(?:think(?:ing)?|redacted_thinking)>[\s\S]*$/i, '')
    .replace(/<\/?think(?:ing)?>/gi, '')
    .replace(/<\/?redacted_thinking>/gi, '')
    .replace(/^\s+/, '');
};
