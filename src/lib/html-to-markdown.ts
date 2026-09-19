/**
 * Lightweight HTML to Markdown converter for problem statements
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let clean = html;

  // Remove scripts, styles, svg
  clean = clean
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

  // MathJax / KaTeX formatting:
  // Convert Codeforces $$$formula$$$ to inline LaTeX $formula$
  clean = clean.replace(/\$\$\$([^\$]+)\$\$\$/g, '$$$1$');

  // Codeforces typography helper classes
  clean = clean.replace(/<span[^>]*class=["'][^"']*tex-font-style-it[^"']*["'][^>]*>(.*?)<\/span>/gi, '*$1*');
  clean = clean.replace(/<span[^>]*class=["'][^"']*tex-font-style-bf[^"']*["'][^>]*>(.*?)<\/span>/gi, '**$1**');
  clean = clean.replace(/<span[^>]*class=["'][^"']*tex-font-style-tt[^"']*["'][^>]*>(.*?)<\/span>/gi, '`$1`');

  // Convert headers
  clean = clean.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
  clean = clean.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
  clean = clean.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');
  clean = clean.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n');

  // Bold / Italics
  clean = clean.replace(/<(b|strong)[^>]*>(.*?)<\/(b|strong)>/gi, '**$2**');
  clean = clean.replace(/<(i|em)[^>]*>(.*?)<\/(i|em)>/gi, '*$2*');

  // Code blocks & inline code
  // In <pre>, ensure <div> and <br> become line breaks before stripping tags
  clean = clean.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_match, innerCode) => {
    let formatted = innerCode
      .replace(/<div[^>]*>/gi, '')
      .replace(/<\/div>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    return `\n\`\`\`text\n${formatted.trim()}\n\`\`\`\n`;
  });

  clean = clean.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

  // Lists
  clean = clean.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  clean = clean.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

  // Paragraphs, divs, breaks
  clean = clean.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  clean = clean.replace(/<br\s*\/?>/gi, '\n');
  clean = clean.replace(/<\/div>/gi, '\n');

  // Strip remaining tags
  clean = clean.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  clean = clean
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&le;/g, '<=')
    .replace(/&ge;/g, '>=')
    .replace(/&ne;/g, '!=');

  // Normalize blank lines
  return clean.replace(/\n{3,}/g, '\n\n').trim();
}
