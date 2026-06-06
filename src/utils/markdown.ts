const COLOR_MAP: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  pink: '#ec4899',
  gray: '#6b7280',
  cyan: '#06b6d4',
  lime: '#84cc16',
  indigo: '#6366f1',
  teal: '#14b8a6',
};

const RULES: [RegExp, string | ((match: string, ...groups: string[]) => string)][] = [
  // Colors: {red}text{/red} or {#ff0000}text{/#ff0000}
  [/\{(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\}(.*?)\{\/\1\}/g, (_match, color: string, text: string) => {
    const resolved = COLOR_MAP[color.toLowerCase()] || (color.startsWith('#') ? color : null);
    if (!resolved) return text;
    return `<span style="color:${resolved}">${text}</span>`;
  }],
  // Bold
  [/\*\*(.+?)\*\*/g, '<strong>$1</strong>'],
  // Italic
  [/\*(.+?)\*/g, '<em>$1</em>'],
  // Underline
  [/__(.+?)__/g, '<u>$1</u>'],
  // Strikethrough
  [/~~(.+?)~~/g, '<del>$1</del>'],
  // Highlight
  [/==(.+?)==/g, '<mark class="bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-200 px-0.5 rounded">$1</mark>'],
  // Inline code
  [/`(.+?)`/g, '<code class="bg-gray-100 dark:bg-gray-700 dark:text-gray-200 px-1 py-0.5 rounded text-xs font-mono">$1</code>'],
  // Line breaks
  [/\n/g, '<br/>'],
];

export function renderMarkdown(text: string): string {
  let html = text;
  for (const [pattern, replacement] of RULES) {
    if (typeof replacement === 'function') {
      html = html.replace(pattern, replacement as (...args: string[]) => string);
    } else {
      html = html.replace(pattern, replacement);
    }
  }
  return html;
}

export const FORMAT_COLORS = Object.keys(COLOR_MAP);
