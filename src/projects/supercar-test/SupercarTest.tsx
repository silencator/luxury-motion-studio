import { ThreeCanvas } from '@remotion/three';
import React from 'react';
import {
  AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { FilmGrade } from '../../lib/overlays/FilmGrade';
import { SupercarScene } from './SupercarScene';
import { DURATION_S } from './timeline.js';

export const SupercarTest: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const fadeIn = interpolate(t, [0, 0.7], [1, 0], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(t, [DURATION_S - 1.1, DURATION_S - 0.05], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // end title
  const titleIn = interpolate(t, [10.9, 11.9], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  });
  const tracking = interpolate(titleIn, [0, 1], [0.9, 0.42]);
  const subIn = interpolate(t, [11.4, 12.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
        camera={{ fov: 34, near: 0.05, far: 1500, position: [-5, 0.7, -3] }}
      >
        <SupercarScene t={t} />
      </ThreeCanvas>

      <FilmGrade frame={frame} />

      {/* end title */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
        <div
          style={{
            fontFamily: '"Inter Display", Inter, sans-serif',
            fontWeight: 200,
            fontSize: 92,
            color: '#f3efe6',
            letterSpacing: `${tracking}em`,
            paddingLeft: `${tracking}em`,
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * 14}px)`,
            textShadow: '0 0 40px rgba(0,0,0,0.6)',
          }}
        >
          SILENCATOR
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: '"Inter Display", Inter, sans-serif',
            fontWeight: 400,
            fontSize: 20,
            letterSpacing: '0.5em',
            paddingLeft: '0.5em',
            color: 'rgba(243,239,230,0.75)',
            opacity: subIn,
          }}
        >
          992 GT3 RS · BEVERLY HILLS
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ backgroundColor: '#000', opacity: Math.max(fadeIn, fadeOut) }} />

      {withAudio ? <Audio src={staticFile('audio/supercar-test.wav')} /> : null}
    </AbsoluteFill>
  );
};
