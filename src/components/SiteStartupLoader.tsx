'use client';
import { useState } from 'react';
import Image from 'next/image';
import { ShimmerLoader } from './ui/shimmer-loader';
import styles from './SiteStartupLoader.module.css';

export function SiteStartupLoader() {
  const [visible, setVisible] = useState(true);
  if(!visible)return null;
  return <div data-startup-loader className={styles.screen}><div className={styles.content}>
    <Image src="/site_assets/logo_0.png" alt="OG Gaming" width={150} height={78} priority className={styles.logo}/>
    <p className={styles.kicker}>OG GAMING / INITIALISING</p>
    <div className={styles.rows}>
      <ShimmerLoader labels={['Analysing.', 'Analysing..', 'Analysing...']} icons={['\u2726','\u25c6','\u2736','\u274b','\u2738']} duration={2000} tokenTarget={0.16} showPercent fontSize={14} paddingY={4} cellPadding={2} onComplete={()=>setVisible(false)}/>
      <ShimmerLoader labels={['Booting\u2026', 'Loading\u2026', 'Preparing\u2026', 'Initializing\u2026']} icons={['\u2726','\u25c6','\u2736','\u274b','\u2738']} duration={2000} tokenTarget={0.8} showPercent fontSize={14} paddingY={4} cellPadding={2}/>
      <ShimmerLoader labels={['Syncing\u2026', 'Configuring\u2026', 'Setting up\u2026', 'Onboarding\u2026']} icons={['\u25c8','\u25c9','\u2b21','\u2b22','\u25cd']} duration={2000} tokenTarget={0.92} showPercent fontSize={14} paddingY={4} cellPadding={2}/>
    </div>
  </div></div>;
}
