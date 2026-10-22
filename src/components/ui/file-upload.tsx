'use client';
import { createContext, useContext, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { useDropzone, type DropzoneOptions, type DropzoneState } from 'react-dropzone';
import { X } from 'lucide-react';
import styles from './file-upload.module.css';

type UploadContext = { dropzone: DropzoneState; files: File[]; disabled: boolean; inputDisabled: boolean; remove: (index: number) => void };
const Context = createContext<UploadContext | null>(null);
function useUploader() {
  const context = useContext(Context);
  if (!context) throw new Error('File upload controls must be inside FileUploader.');
  return context;
}
export function FileUploader({ value, onValueChange, dropzoneOptions, disabled = false, children, className = '' }: {
  value: File[] | null; onValueChange: (files: File[]) => void; dropzoneOptions: DropzoneOptions;
  disabled?: boolean; children: ReactNode; className?: string;
}) {
  const files = value || [], max = dropzoneOptions.maxFiles || 5;
  const [error, setError] = useState('');
  const dropzone = useDropzone({ ...dropzoneOptions, multiple:true,
    disabled:disabled || files.length >= max, maxFiles:Math.max(1,max-files.length),
    onDrop: (accepted,rejected) => {
      const next = [...files];
      for (const file of accepted) if (!next.some(old=>old.name===file.name && old.size===file.size && old.lastModified===file.lastModified)) next.push(file);
      const codes = rejected.flatMap(file=>file.errors.map(error=>error.code));
      setError(codes.includes('file-too-large') ? 'Each screenshot must be 5 MB or smaller.' : codes.includes('file-invalid-type') ? 'Choose PNG, JPG or WebP images.' : rejected.length ? `You can select up to ${max} screenshot${max===1?'':'s'} here.` : '');
      onValueChange(next.slice(0,max));
    },
  });
  return <Context.Provider value={{dropzone,files,disabled,inputDisabled:disabled||files.length>=max,remove:index=>{ if (!disabled) { onValueChange(files.filter((_,i)=>i!==index)); setError(''); } }}}><div className={styles.uploader + ' ' + className}>{children}{error && (files.length>0||dropzone.acceptedFiles.length===0) && <p className={styles.error} role="alert">{error}</p>}</div></Context.Provider>;
}
export function FileInput({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { dropzone, inputDisabled } = useUploader();
  return <div {...dropzone.getRootProps({className:styles.dropzone + (dropzone.isDragActive ? ' ' + styles.active : '') + ' ' + className,role:'button','aria-label':'Click to upload screenshots or drag and drop','aria-disabled':inputDisabled})}>
    <input {...dropzone.getInputProps({'aria-label':'Choose CS2 screenshots'})}/>{children}
  </div>;
}
export function FileUploaderContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={styles.previews + ' ' + className} {...props}/>;
}
export function FileUploaderItem({ index, children, className = '', ...props }: HTMLAttributes<HTMLDivElement> & {index:number}) {
  const { files, remove, disabled } = useUploader();
  return <div className={styles.item + ' ' + className} {...props}>{children}<span title={files[index]?.name}>{files[index]?.name}</span><button type="button" disabled={disabled} aria-label={'Remove selected file ' + files[index]?.name} onClick={()=>remove(index)}><X size={13}/></button></div>;
}
export function FileUploadPreview({ file }: { file: File }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(()=>{
    const url = URL.createObjectURL(file);
    if (ref.current) ref.current.src = url;
    return ()=>URL.revokeObjectURL(url);
  },[file]);
  // Local blob thumbnails do not need the remote image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} alt={file.name} width={80} height={80}/>;
}
