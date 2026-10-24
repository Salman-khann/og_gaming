'use client';
import { useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { ShimmerLoader } from './ui/shimmer-loader';
import styles from './SiteStartupLoader.module.css';
const STARTUP_DURATION = 2000;

export function SiteStartupLoader() {
  const [visible, setVisible] = useState(true);
  const content = useRef<HTMLDivElement>(null);
  if(!visible)return null;
  return <div data-startup-loader className={styles.screen} style={{ '--startup-duration': `${STARTUP_DURATION}ms` } as CSSProperties}><div ref={content} className={styles.content}>
    <Image src="/site_assets/logo_0.png" alt="OG Gaming" width={150} height={78} priority className={styles.logo}/>
    <p className={styles.kicker}>OG GAMING / INITIALISING</p>
    <div className={styles.rows}>
      <ShimmerLoader labels={['Analysing.', 'Analysing..', 'Analysing...']} icons={['\u2726','\u25c6','\u2736','\u274b','\u2738']} duration={STARTUP_DURATION} tokenTarget={0.16} showPercent fontSize={14} paddingY={4} cellPadding={2} onProgress={progress => content.current?.style.setProperty('--shimmer-drift', `${Math.sin(progress * Math.PI * 2) * 1.5}px`)} onComplete={()=>setVisible(false)}/>
      <ShimmerLoader labels={['Booting\u2026', 'Loading\u2026', 'Preparing\u2026', 'Initializing\u2026']} icons={['\u2726','\u25c6','\u2736','\u274b','\u2738']} duration={STARTUP_DURATION} tokenTarget={0.8} showPercent fontSize={14} paddingY={4} cellPadding={2}/>
      <ShimmerLoader labels={['Syncing\u2026', 'Configuring\u2026', 'Setting up\u2026', 'Onboarding\u2026']} icons={['\u25c8','\u25c9','\u2b21','\u2b22','\u25cd']} duration={STARTUP_DURATION} tokenTarget={0.92} showPercent fontSize={14} paddingY={4} cellPadding={2}/>
    </div>
  </div></div>;
}
