'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Camera selfie capture. Asks for camera, shows a mirrored preview, captures a
 * square JPEG dataURL via canvas. Calls onCaptured(dataUrl|null). If the camera
 * is unavailable / denied, calls onUnavailable so the parent can fall back.
 */
export default function SelfieCapture({
  onCaptured, onUnavailable,
}: { onCaptured: (d: string | null) => void; onUnavailable?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<'idle' | 'live' | 'shot' | 'error'>('idle');
  const [shot, setShot] = useState<string | null>(null);

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }
  useEffect(() => () => stop(), []);

  async function start() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false,
      });
      streamRef.current = s;
      setPhase('live');
      // video element renders after phase change → set source on next tick
      requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); } });
    } catch {
      setPhase('error');
      onUnavailable?.();
    }
  }

  function capture() {
    const v = videoRef.current; if (!v) return;
    const side = Math.min(v.videoWidth, v.videoHeight) || 720;
    const c = document.createElement('canvas'); c.width = c.height = 720;
    const ctx = c.getContext('2d')!;
    const sx = (v.videoWidth - side) / 2, sy = (v.videoHeight - side) / 2;
    ctx.drawImage(v, sx, sy, side, side, 0, 0, 720, 720);
    const d = c.toDataURL('image/jpeg', 0.9);
    setShot(d); onCaptured(d); setPhase('shot'); stop();
  }
  function retake() { setShot(null); onCaptured(null); start(); }

  const frame: React.CSSProperties = {
    width: '100%', maxWidth: 300, aspectRatio: '1', margin: '0 auto', borderRadius: 20,
    border: '3px solid var(--line)', overflow: 'hidden', background: 'var(--bg2,#eee)', boxShadow: 'var(--shadow)',
    display: 'grid', placeItems: 'center', position: 'relative',
  };

  return (
    <div style={{ display: 'grid', gap: 14, justifyItems: 'center' }}>
      {phase === 'idle' && (
        <>
          <div style={frame}><span style={{ fontSize: 52 }}>📸</span></div>
          <button className="btn cyan" onClick={start}>📸 Увімкнути камеру</button>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', textAlign: 'center', maxWidth: 300 }}>
            Фото піде на сервер для AI-стилізації і збережеться як твоя картка-герой.
          </p>
        </>
      )}
      {phase === 'live' && (
        <>
          <div style={frame}>
            <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          </div>
          <button className="btn pink" onClick={capture}>● Зняти кадр</button>
        </>
      )}
      {phase === 'shot' && shot && (
        <>
          <div style={frame}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot} alt="селфі" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          </div>
          <button className="btn ghost" onClick={retake}>↻ Перезняти</button>
        </>
      )}
      {phase === 'error' && (
        <div className="card" style={{ textAlign: 'center', maxWidth: 320 }}>
          <p style={{ fontWeight: 700 }}>Камера недоступна 📵</p>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 8 }}>Доступ відхилено або камери немає. Збери героя з рис нижче.</p>
        </div>
      )}
    </div>
  );
}
