import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './RichText.module.css';
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={styles.content + ' ' + className}>
      <Markdown remarkPlugins={[remarkGfm]} skipHtml>
        {text}
      </Markdown>
    </div>
  );
}
