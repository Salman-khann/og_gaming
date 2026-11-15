'use client';
import { useId, useRef, useState } from 'react';
import { RichText } from './RichText';
import { formatMarkdown, type Format } from '@/lib/markdown-edit';
import styles from './RichText.module.css';
const tools: [Format, string][] = [
  ['bold', 'Bold'],
  ['italic', 'Italic'],
  ['strike', 'Strikethrough'],
  ['heading', 'Heading'],
  ['bullets', 'Bullets'],
  ['numbers', 'Numbered list'],
  ['quote', 'Quote'],
  ['link', 'Link'],
  ['code', 'Code'],
  ['table', 'Table'],
];
export function MarkdownEditor({
  label,
  value,
  onChange,
  maxLength,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows?: number;
}) {
  const id = useId(),
    input = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false),
    [error, setError] = useState('');
  return (
    <div className={'field wide ' + styles.editor}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.toolbar} role="group" aria-label={label + ' formatting'}>
        {!preview &&
          tools.map(([format, name]) => (
            <button
              key={format}
              type="button"
              aria-label={name + ' in ' + label}
              onClick={() => {
                const textarea = input.current;
                if (!textarea) return;
                const next = formatMarkdown(
                  value,
                  textarea.selectionStart,
                  textarea.selectionEnd,
                  format,
                );
                if (next.value.length > maxLength) {
                  setError('Formatting would exceed the character limit.');
                  return;
                }
                setError('');
                onChange(next.value);
                requestAnimationFrame(() => {
                  textarea.focus();
                  textarea.setSelectionRange(next.start, next.end);
                });
              }}
            >
              {name}
            </button>
          ))}
        <button
          type="button"
          aria-pressed={preview}
          onClick={() => setPreview((current) => !current)}
        >
          {preview ? 'Edit ' + label : 'Preview ' + label}
        </button>
      </div>
      {preview ? (
        <div className={styles.preview} role="region" aria-label={label + ' preview'}>
          {value ? <RichText text={value} /> : <p className="muted">Nothing to preview yet.</p>}
        </div>
      ) : (
        <textarea
          id={id}
          ref={input}
          rows={rows}
          maxLength={maxLength}
          value={value}
          onChange={(event) => {
            setError('');
            onChange(event.target.value);
          }}
          aria-describedby={id + '-help'}
        />
      )}
      <small id={id + '-help'} className="muted">
        Use the toolbar or Markdown. {value.length}/{maxLength} characters.
      </small>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </div>
  );
}
