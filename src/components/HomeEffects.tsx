'use client';
import { useEffect, useRef } from 'react';

export function HomeEffects() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const scroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const height = document.documentElement.scrollHeight - innerHeight;
        if (bar.current)
          bar.current.style.width = (height > 0 ? (scrollY / height) * 100 : 0) + '%';
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );
    document.querySelectorAll('.reveal-init').forEach((element) => observer.observe(element));
    window.addEventListener('scroll', scroll, { passive: true });
    scroll();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', scroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div
      ref={bar}
      aria-hidden="true"
      className="fixed top-0 left-0 h-[3.5px] z-[100] bg-gradient-to-r from-[#ff6a12] via-[#ffb27a] to-[#ff6a12] shadow-[0_0_12px_#ff6a12]"
      style={{ width: 0 }}
    />
  );
}
