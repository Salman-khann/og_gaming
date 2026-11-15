export type Format =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'heading'
  | 'bullets'
  | 'numbers'
  | 'quote'
  | 'link'
  | 'code'
  | 'table';
export function formatMarkdown(value: string, start: number, end: number, format: Format) {
  const selection = value.slice(start, end) || 'text';
  const wrappers: Partial<Record<Format, [string, string]>> = {
    bold: ['**', '**'],
    italic: ['*', '*'],
    strike: ['~~', '~~'],
    code: ['`', '`'],
    link: ['[', '](https://example.com)'],
  };
  let inserted: string, selectStart: number, selectEnd: number;
  if (wrappers[format]) {
    const [before, after] = wrappers[format]!;
    inserted = before + selection + after;
    selectStart = start + before.length;
    selectEnd = selectStart + selection.length;
  } else {
    const content =
      format === 'table'
        ? '| Column | Column |\n| --- | --- |\n| Text | Text |'
        : selection
            .split('\n')
            .map(
              (line, index) =>
                (format === 'heading'
                  ? '## '
                  : format === 'bullets'
                    ? '- '
                    : format === 'numbers'
                      ? index + 1 + '. '
                      : '> ') + line,
            )
            .join('\n');
    const before = start > 0 && !value.slice(0, start).endsWith('\n') ? '\n\n' : '';
    const after = end < value.length && !value.slice(end).startsWith('\n') ? '\n\n' : '';
    inserted = before + content + after;
    selectStart = start + before.length;
    selectEnd = selectStart + content.length;
  }
  return {
    value: value.slice(0, start) + inserted + value.slice(end),
    start: selectStart,
    end: selectEnd,
  };
}
