'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const Arena = dynamic(() => import('./ArenaWorkspace').then((module) => module.ArenaWorkspace));
export function HomeArena() {
  const section = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    if (section.current) observer.observe(section.current);
    return () => observer.disconnect();
  }, []);
  return (
    <section id="arena" ref={section} style={{ minHeight: 180 }}>
      {visible ? (
        <Arena embedded />
      ) : (
        <div className="wrap section-heading">
          <h2>Find your next match</h2>
          <Link className="button" href="/matches">
            Browse 5v5 matches
          </Link>
        </div>
      )}
    </section>
  );
}
