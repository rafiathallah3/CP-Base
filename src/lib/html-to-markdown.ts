/**
 * Lightweight HTML to Markdown converter for problem statements
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  // Remove scripts, styles, iframes
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

  // MathJax / KaTeX formatting
  clean = clean.replace(/\$\$\$([^\$]+)\$\$\$/g, '$$$1$$');

  // Convert headers
  clean = clean.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
  clean = clean.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
  clean = clean.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');
  clean = clean.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n');

  // Bold / Italics
  clean = clean.replace(/<(b|strong)[^>]*>(.*?)<\/(b|strong)>/gi, '**$2**');
  clean = clean.replace(/<(i|em)[^>]*>(.*?)<\/(i|em)>/gi, '*$2*');

  // Code blocks & inline code
  clean = clean.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
  clean = clean.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
  clean = clean.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

  // Lists
  clean = clean.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  clean = clean.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

  // Paragraphs and breaks
  clean = clean.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  clean = clean.replace(/<br\s*\/?>/gi, '\n');

  // Strip remaining tags
  clean = clean.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  clean = clean
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&le;/g, '<=')
    .replace(/&ge;/g, '>=')
    .replace(/&ne;/g, '!=');

  // Normalize blank lines
  return clean.replace(/\n{3,}/g, '\n\n').trim();
}
