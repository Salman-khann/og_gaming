import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RichText } from '../../src/components/RichText';
import { formatMarkdown } from '../../src/lib/markdown-edit';
it('renders headings, bold, lists and tables while rejecting executable markup', () => {
  const html = renderToStaticMarkup(
    createElement(RichText, {
      text: '## Rules\n\n**Bold** and *italic*\n\n- First\n- Second\n\n| Round | Time |\n| --- | --- |\n| Final | 8 PM |\n\n<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)',
    }),
  );
  expect(html).toContain('<h2>Rules</h2>');
  expect(html).toContain('<strong>Bold</strong>');
  expect(html).toContain('<em>italic</em>');
  expect(html).toContain('<ul>');
  expect(html).toContain('<table>');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('href="javascript:');
});
it('formats selected text and multiline lists without discarding surrounding text', () => {
  expect(formatMarkdown('hello world', 6, 11, 'bold').value).toBe('hello **world**');
  expect(formatMarkdown('First\nSecond', 0, 12, 'bullets').value).toBe('- First\n- Second');
  expect(formatMarkdown('First\nSecond', 0, 12, 'numbers').value).toBe('1. First\n2. Second');
});
