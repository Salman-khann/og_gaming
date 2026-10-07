'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  fadeSpeed: number;
  color: string;
  glow: number;
}

export function CyberBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Mouse coordinates for subtle interactive reaction
    const mouse = { x: -1000, y: -1000, radius: 120 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // Particle colors matching OG Gaming aesthetic
    const colors = [
      'rgba(255, 106, 18, ', // Signature OG Orange
      'rgba(255, 178, 122, ', // Soft Warm Orange
      'rgba(201, 78, 12, ', // Deep Amber
      'rgba(255, 215, 0, ', // Gold spark
    ];

    const particleCount = Math.min(Math.floor((width * height) / 22000), 55);
    const particles: Particle[] = [];

    const createParticle = (randomY = true): Particle => {
      const colorBase = colors[Math.floor(Math.random() * colors.length)];
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : height + 10,
        size: Math.random() * 2.8 + 1.2,
        speedY: -(Math.random() * 0.7 + 0.35), // Upward drift
        speedX: (Math.random() - 0.5) * 0.4, // Slight drift left/right
        opacity: Math.random() * 0.6 + 0.2,
        fadeSpeed: (Math.random() * 0.008 + 0.003) * (Math.random() > 0.5 ? 1 : -1),
        color: colorBase,
        glow: Math.random() * 12 + 6,
      };
    };

    for (let i = 0; i < particleCount; i++) {
      particles.push(createParticle(true));
    }

    let tick = 0;

    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      // Draw each floating ember/particle
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move particle
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(tick * 0.02 + i) * 0.15;

        // Opacity pulsation
        p.opacity += p.fadeSpeed;
        if (p.opacity > 0.85 || p.opacity < 0.15) {
          p.fadeSpeed = -p.fadeSpeed;
        }

        // Mouse interaction: slight repulsive/glow aura
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (1 - dist / mouse.radius) * 1.5;
          p.x -= (dx / dist) * force;
          p.y -= (dy / dist) * force;
        }

        // Reset if went above viewport
        if (p.y < -20 || p.x < -20 || p.x > width + 20) {
          particles[i] = createParticle(false);
          continue;
        }

        // Draw radial glowing particle
        ctx.save();
        ctx.beginPath();
        const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.glow);
        radGrad.addColorStop(0, `${p.color}${p.opacity})`);
        radGrad.addColorStop(0.3, `${p.color}${p.opacity * 0.4})`);
        radGrad.addColorStop(1, `${p.color}0)`);

        ctx.fillStyle = radGrad;
        ctx.arc(p.x, p.y, p.glow, 0, Math.PI * 2);
        ctx.fill();

        // Bright spark center
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(p.opacity * 0.9, 0.9)})`;
        ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw faint cyber connection lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 90) {
            const alpha = (1 - dist / 90) * 0.12 * Math.min(particles[i].opacity, particles[j].opacity);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 106, 18, ${alpha})`;
            ctx.lineWidth = 0.75;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Animated Floating Ambient Nebula Orbs */}
      <div className="ambient-orb ambient-orb-1" />
      <div className="ambient-orb ambient-orb-2" />
      <div className="ambient-orb ambient-orb-3" />

      {/* Cyber Moving Grid Scanline Beam */}
      <div className="cyber-scanline" />

      {/* Interactive HTML5 Canvas for Floating Embers & Cyber Network */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-85"
      />
    </div>
  );
}
