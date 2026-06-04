import { useEffect, useState } from 'react';

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('enter'); // 'enter' | 'visible' | 'exit'

  useEffect(() => {
    // Fase 1: entra (0 → 600ms)
    const t1 = setTimeout(() => setPhase('visible'), 600);
    // Fase 2: resta visibile fino a 4300ms, poi inizia exit
    const t2 = setTimeout(() => setPhase('exit'), 4300);
    // Fase 3: dopo il fade-out notifica il parent
    const t3 = setTimeout(() => onDone(), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#050505',
      transition: 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
      opacity: phase === 'exit' ? 0 : 1,
      pointerEvents: phase === 'exit' ? 'none' : 'all',
    }}>

      {/* Glow radiale dietro il testo */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)',
        filter: 'blur(40px)',
        transition: 'opacity 0.8s ease',
        opacity: phase === 'enter' ? 0 : 1,
      }} />

      {/* Testo principale */}
      <div style={{
        position: 'relative',
        textAlign: 'center',
        transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: phase === 'enter' ? 0 : 1,
        transform: phase === 'enter' ? 'translateY(24px)' : 'translateY(0)',
      }}>
        <h1 style={{
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 800,
          fontSize: 'clamp(2.8rem, 8vw, 5rem)',
          letterSpacing: '-0.03em',
          color: '#ffffff',
          lineHeight: 1.1,
          marginBottom: '0.6rem',
        }}>
          Captive Portal
        </h1>
        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 300,
          fontSize: 'clamp(0.8rem, 2vw, 1rem)',
          color: 'rgba(160,160,160,0.75)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          transition: 'opacity 0.8s ease 0.2s',
          opacity: phase === 'enter' ? 0 : 1,
        }}>
          By 5D
        </p>
      </div>

      {/* Lineetta decorativa sotto */}
      <div style={{
        position: 'absolute',
        bottom: '12vh',
        width: '40px',
        height: '2px',
        background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.7), transparent)',
        borderRadius: '2px',
        transition: 'opacity 0.8s ease 0.3s, width 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s',
        opacity: phase === 'enter' ? 0 : 0.8,
      }} />
    </div>
  );
}
