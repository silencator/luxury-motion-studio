import React from 'react';
import { AbsoluteFill } from 'remotion';

/**
 * Cinematic finishing layer composited over any scene:
 * thin letterbox, soft vignette, warm/teal split wash and per-frame film grain.
 */
export const FilmGrade: React.FC<{ frame: number; letterbox?: number; grain?: number }> = ({
  frame,
  letterbox = 56,
  grain = 0.09,
}) => {
  const seed = (frame * 7919) % 997;
  return (
    <>
      {/* split-tone wash: warm highlights / teal shadows */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(20,40,60,0.10) 0%, rgba(255,170,100,0.05) 100%)',
          mixBlendMode: 'soft-light',
        }}
      />
      {/* vignette */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at 50% 52%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)',
        }}
      />
      {/* grain */}
      <AbsoluteFill style={{ opacity: grain, mixBlendMode: 'overlay' }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id={`g${seed}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#g${seed})`} />
        </svg>
      </AbsoluteFill>
      {/* letterbox */}
      <AbsoluteFill style={{ justifyContent: 'space-between' }}>
        <div style={{ height: letterbox, background: '#000' }} />
        <div style={{ height: letterbox, background: '#000' }} />
      </AbsoluteFill>
    </>
  );
};
