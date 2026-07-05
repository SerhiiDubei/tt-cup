'use client';
import { useEffect } from 'react';

/** Mounts preloader/cursor/scroll-progress behaviour + reveal observer. Render once in layout. */
export default function Chrome() {
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const pre = document.getElementById('preloader');
    const t = setTimeout(() => pre?.classList.add('done'), reduce ? 0 : 850);

    const prog = document.getElementById('progress');
    const onScroll = () => {
      const h = document.documentElement;
      const p = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
      if (prog) prog.style.width = (p * 100).toFixed(2) + '%';
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    const observeAll = () => document.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el));
    observeAll();
    const mo = new MutationObserver(observeAll);
    mo.observe(document.body, { childList: true, subtree: true });

    let raf = 0;
    if (!reduce && matchMedia('(hover:hover)').matches) {
      const dot = document.createElement('div'); dot.className = 'cursor-dot';
      const ring = document.createElement('div'); ring.className = 'cursor-ring';
      document.body.append(dot, ring);
      let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
      addEventListener('pointermove', (e) => {
        x = e.clientX; y = e.clientY; dot.style.left = x + 'px'; dot.style.top = y + 'px';
      });
      addEventListener('pointerover', (e) => {
        const hit = (e.target as HTMLElement).closest('a,button,.swatch,.pick,.fx-tab,.hero-card,.fcard,.icon-btn');
        ring.classList.toggle('hovering', !!hit);
      });
      const loop = () => { rx += (x - rx) * 0.18; ry += (y - ry) * 0.18; ring.style.left = rx + 'px'; ring.style.top = ry + 'px'; raf = requestAnimationFrame(loop); };
      loop();
    }

    const th = localStorage.getItem('tt_theme');
    if (th === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

    return () => { clearTimeout(t); removeEventListener('scroll', onScroll); mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
      <div id="preloader">
        <div className="pre-shapes"><i /><i /><i /><i /></div>
        <div className="pre-text">ЗАВАНТАЖЕННЯ</div>
      </div>
      <div id="progress" />
    </>
  );
}
