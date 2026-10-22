'use client';
import { useState } from 'react';
import Image from 'next/image';
import { UploadCloud } from 'lucide-react';
import type { DropzoneOptions } from 'react-dropzone';
import type { TournamentMatch } from '@/types';
import { SCORECARD_LIMIT, scorecardSlots } from '@/lib/scorecard-slots';
import { SCORECARD_MAX_BYTES } from '@/lib/scorecard-image';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { FileInput, FileUploader, FileUploaderContent, FileUploaderItem, FileUploadPreview } from './ui/file-upload';
import { useResource, sendAction } from './useResource';
import styles from './TournamentBracket.module.css';

export function MatchScorecardDialog({ match, teamA, teamB, admin, onClose }: {
  match: TournamentMatch; teamA: string; teamB: string; admin: boolean; onClose: () => void;
}) {
  const { data, error, loading, reload } = useResource<{images:{map_number:number;url:string}[]}>('/api/tournaments/scorecards?match_id=' + match.id);
  const [selected, setSelected] = useState(1), [busy, setBusy] = useState(false), [failure, setFailure] = useState('');
  const [files, setFiles] = useState<File[]>([]), [progress, setProgress] = useState('');
  const uploaded = data?.images.map(image=>image.map_number) || [];
  const current = admin || uploaded.includes(selected) ? selected : uploaded[0] || 1;
  const image = data?.images.find(image=>image.map_number===current);
  const tabs = admin ? Array.from({length:SCORECARD_LIMIT},(_,i)=>i+1) : uploaded.length ? uploaded : [1];
  const targets = scorecardSlots(selected,uploaded);
  const dropzone = { accept:{'image/png':['.png'],'image/jpeg':['.jpg','.jpeg'],'image/webp':['.webp']}, multiple:true, maxFiles:targets.length, maxSize:SCORECARD_MAX_BYTES } satisfies DropzoneOptions;

  async function upload() {
    if (!files.length || files.length>targets.length || busy) return;
    setBusy(true); setFailure('');
    let saved = 0;
    try {
      for (let i=0;i<files.length;i++) {
        setProgress(`Uploading ${i+1} of ${files.length}...`);
        const body = new FormData(); body.set('match_id',match.id); body.set('map_number',String(targets[i])); body.set('file',files[i]);
        const response = await fetch('/api/tournaments/scorecards',{method:'POST',body});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to upload the screenshot.');
        saved++;
      }
      setSelected(targets[0]);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Unable to upload.');
      if (targets[saved]) setSelected(targets[saved]);
    } finally {
      if (saved) { setFiles(previous=>previous.slice(saved)); await reload(); }
      setBusy(false); setProgress('');
    }
  }
  async function remove() {
    setBusy(true); setFailure('');
    try { await sendAction('/api/tournaments/scorecards',{match_id:match.id,map_number:current},'DELETE'); await reload(); }
    catch (error) { setFailure(error instanceof Error ? error.message : 'Unable to remove.'); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className={styles.scorecardDialog} overlayClassName={styles.scorecardBackdrop} showCloseButton={!busy}>
    <DialogTitle>Match scorecard</DialogTitle>
    <DialogDescription>{teamA} &middot; {match.score_a}&ndash;{match.score_b} &middot; {teamB}</DialogDescription>
    <div className={styles.mapTabs} aria-label="Match screenshots">{tabs.map(number=><button key={number} type="button" disabled={busy} aria-pressed={current===number} onClick={()=>{setSelected(number);setFiles([]);setFailure('');}}>Match {number}{uploaded.includes(number)?' \u00b7 Uploaded':''}</button>)}</div>
    {(failure||error)&&<p role="alert" className={styles.scorecardError}>{failure||error}</p>}
    {loading&&!data?<p role="status">Loading screenshots...</p>:image?<figure className={styles.scorecardFigure}><a href={image.url} target="_blank" rel="noopener noreferrer" aria-label={'Open Match '+current+' scoreboard at full size'}><Image src={image.url} alt={`Match ${current} CS2 scoreboard: ${teamA} versus ${teamB}, showing rounds, kills and player stats`} width={1920} height={1080} unoptimized/></a><figcaption>Match {current} &middot; Click the screenshot to view full size.</figcaption></figure>:<p className={styles.noScorecard}>The admin has not uploaded a screenshot for this match yet.</p>}
    {admin&&<form className={styles.scorecardUpload} onSubmit={event=>{event.preventDefault();void upload();}}>
      <p>Up to 5 screenshots per match. PNG, JPG or WebP, 5 MB each.</p>
      <FileUploader key={selected} value={files} onValueChange={setFiles} dropzoneOptions={dropzone} disabled={busy||loading||!data}>
        <FileInput><UploadCloud size={30} strokeWidth={1.5}/><p><strong>Click to upload</strong> or drag and drop</p><small>{targets.length} {targets.length===1?'screenshot':'screenshots'} can be selected</small></FileInput>
        <FileUploaderContent>{files.map((file,index)=><FileUploaderItem key={`${file.name}-${file.lastModified}-${file.size}`} index={index} aria-label={'Selected screenshot '+(index+1)+': '+file.name}><FileUploadPreview file={file}/></FileUploaderItem>)}</FileUploaderContent>
      </FileUploader>
      <p className={styles.uploadStatus} role="status">{busy?progress||'Saving...':`${uploaded.length} of ${SCORECARD_LIMIT} uploaded`}</p>
      <div className={styles.scorecardActions}><button type="submit" className={styles.primaryButton} disabled={busy||loading||!files.length}>{busy?'Uploading...':image&&files.length===1?'Replace screenshot':files.length?`Upload ${files.length} screenshot${files.length===1?'':'s'}`:'Upload screenshots'}</button>{image&&<button type="button" className={styles.resetPairings} disabled={busy} onClick={()=>void remove()}>Remove screenshot</button>}</div>
    </form>}
    <button type="button" className={styles.resetPairings} disabled={busy||loading} onClick={()=>void reload()}>Refresh screenshots</button>
  </DialogContent></Dialog>;
}
