import React from 'react';
import { Composition } from 'remotion';
import { SupercarTest } from './projects/supercar-test/SupercarTest';
import { DURATION_FRAMES, FPS } from './projects/supercar-test/timeline.js';

export const Root: React.FC = () => (
  <>
    <Composition
      id="SupercarTest"
      component={SupercarTest}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ withAudio: true }}
    />
  </>
);
