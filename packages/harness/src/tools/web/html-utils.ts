const decodeHtmlEntities = (input: string) =>
  input
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&apos;/g, '\'')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

export { decodeHtmlEntities };

export const stripTags = (input: string) => decodeHtmlEntities(input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

export const normalizeWhitespace = (input: string) => input.replace(/\n{3,}/g, '\n\n').trim();

export const truncate = (input: string, maxChars: number) => (input.length > maxChars ? `${input.slice(0, maxChars)}...` : input);

const trackingParamPattern = /^(utm_|spm$|from$|src$|source$|ref$|referer$|campaign$|yclid$|gclid$|fbclid$)/i;

export const canonicalizeUrl = (input: string) => {
  try {
    const url = new URL(input);
    url.hash = '';
    const entries = [...url.searchParams.entries()];
    url.search = '';
    for (const [key, value] of entries) {
      if (!trackingParamPattern.test(key)) {
        url.searchParams.append(key, value);
      }
    }
    return url.toString();
  } catch {
    return input;
  }
};

const stripScriptsAndStyles = (input: string) => input
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ');

const extractMetaContent = (html: string, key: string) => {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+name=["']${key}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+property=["']${key}["'][^>]*>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return stripTags(match[1]);
    }
  }

  return '';
};

export const extractHtmlExcerpt = (html: string, maxChars: number) => {
  const sanitized = stripScriptsAndStyles(html);
  const title = stripTags(sanitized.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const description = extractMetaContent(sanitized, 'description') || extractMetaContent(sanitized, 'og:description');
  const body = stripTags(
    sanitized
      .replace(/<\/(p|div|section|article|li|tr|h[1-6])>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n'),
  );
  const excerpt = normalizeWhitespace(body).slice(0, maxChars);

  return [
    title ? `标题：${title}` : '',
    description ? `摘要：${description}` : '',
    excerpt ? `正文：\n${excerpt}` : '',
  ].filter(Boolean).join('\n\n');
};
