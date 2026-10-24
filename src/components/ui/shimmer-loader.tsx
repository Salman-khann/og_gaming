/*! Adapted from UI Layouts shimmer-loader (https://www.ui-layouts.com/components/shimmer-loader).
 * MIT License
 * Copyright (c) 2024 UI LAYOUT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
'use client';
import { useEffect, useRef } from 'react';
import styles from './shimmer-loader.module.css';

const defaultLabels = ['Loading...', 'Preparing...', 'Ready'];
const defaultIcons = ['\u2726', '\u25c6', '\u2736', '\u274b', '\u2738'];

function computeShimmerColors(totalWidth: number, shimmerPos: number, pulse: number) {
  const radius = Math.max(1,Math.floor(totalWidth/2.5));
  return Array.from({length:totalWidth},(_,i)=>{
    const shimmer = Math.max(0,1-Math.abs(i-shimmerPos)/radius);
    const baseR=36+i/totalWidth*10, baseG=20+i/totalWidth*8, baseB=10+i/totalWidth*8;
    const p=1+pulse*.06;
    return [Math.min(255,Math.round((baseR+(255-baseR)*shimmer*.6)*p)),Math.min(255,Math.round((baseG+(155-baseG)*shimmer*.6)*p)),Math.min(255,Math.round((baseB+(80-baseB)*shimmer*.7)*p))];
  });
}

type ShimmerLoaderProps = {
  labels?: string[]; icons?: string[]; duration?: number; tokenTarget?: number; showPercent?: boolean;
  fontSize?: number; paddingY?: number; cellPadding?: number; textClassName?: string; onComplete?: () => void; onProgress?: (progress: number) => void;
};
export function ShimmerLoader({labels=defaultLabels,icons=defaultIcons,duration=3000,tokenTarget,showPercent=true,fontSize=14,paddingY=4,cellPadding=2,textClassName='',onComplete,onProgress}:ShimmerLoaderProps) {
  const cells=useRef<(HTMLSpanElement|null)[]>([]), icon=useRef<HTMLSpanElement>(null), tokens=useRef<HTMLSpanElement>(null);
  const complete=useRef(onComplete);
  const progressCallback=useRef(onProgress);
  useEffect(()=>{complete.current=onComplete;},[onComplete]);
  useEffect(()=>{progressCallback.current=onProgress;},[onProgress]);
  const safeLabels=labels.length?labels:defaultLabels, safeIcons=icons.length?icons:defaultIcons;
  const padding=Math.max(0,Math.floor(cellPadding));
  const longest=Math.max(...safeLabels.map(label=>(' '+label+' ').length+(showPercent?5:0)));
  const barWidth=longest+padding*2;
  const content=(label:string,pct:number)=>(' '.repeat(padding)+(' '+label+(showPercent?' '+pct+'%':'')+' ').padEnd(longest)+' '.repeat(padding)).split('');
  const initial=content(safeLabels[0],0);
  useEffect(()=>{
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frameMs=reduced?100:25, total=Math.max(1,duration);
    const radius=Math.max(1,Math.floor(barWidth/2.5)), cycle=barWidth+radius*2;
    const started=performance.now();
    let raf=0,last=0,done=false;
    function draw(timestamp:number) {
      const elapsed=timestamp-started;
      if(timestamp-last<frameMs-1&&elapsed<total){raf=requestAnimationFrame(draw);return;}
      last=timestamp;
      const progress=Math.min(Math.max(0,elapsed/total),1), frame=elapsed/frameMs;
      const label=safeLabels[Math.min(safeLabels.length-1,Math.floor(progress*safeLabels.length))];
      const raw=' '+label+(showPercent?' '+Math.round(progress*100)+'%':'')+' ';
      const text=(' '.repeat(padding)+raw.padEnd(longest)+' '.repeat(padding)).split('');
      const pulse=reduced?0:Math.sin(frame*.18);
      const colors=computeShimmerColors(barWidth,reduced?barWidth/2:progress*cycle-radius,pulse);
      progressCallback.current?.(progress);
      for(let i=0;i<barWidth;i++){
        const cell=cells.current[i];if(!cell)continue;
        cell.style.backgroundColor=`rgb(${colors[i].join(',')})`;
        if(cell.textContent!==text[i])cell.textContent=text[i]||' ';
      }
      if(icon.current){icon.current.textContent=progress===1?'\u2318':safeIcons[reduced?0:Math.floor(frame/5)%safeIcons.length];icon.current.style.color=`rgb(${Math.round(230+pulse*25)},${Math.round(110+pulse*12)},45)`;}
      if(tokens.current&&tokenTarget!==undefined)tokens.current.textContent=(progress*tokenTarget).toFixed(1)+'k';
      if(progress<1)raf=requestAnimationFrame(draw);
      else if(!done){done=true;complete.current?.();}
    }
    raf=requestAnimationFrame(draw);
    return ()=>cancelAnimationFrame(raf);
  },[duration,barWidth,longest,padding,safeLabels,safeIcons,showPercent,tokenTarget]);
  return <div className={styles.loader} style={{fontSize}} role="status" aria-label={safeLabels[0]}>
    <span ref={icon} className={styles.symbol} aria-hidden="true" style={{fontSize:fontSize*1.15}}>{safeIcons[0]}</span>
    <div className={styles.cells} aria-hidden="true">{initial.map((character,index)=><span key={index} ref={node=>{cells.current[index]=node;}} className={styles.cell+' '+textClassName} style={{paddingBlock:paddingY}}>{character}</span>)}</div>
    {tokenTarget!==undefined&&<span ref={tokens} className={styles.tokens} style={{fontSize:fontSize*.85}} aria-hidden="true">0.0k</span>}
  </div>;
}
