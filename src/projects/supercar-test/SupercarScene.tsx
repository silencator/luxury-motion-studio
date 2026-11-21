import { useThree } from '@react-three/fiber';
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { buildEnvironmentMap, buildStreet } from '../../lib/environment/buildStreet';
import { buildSupercar } from '../../lib/supercar/buildSupercar';
import { cameraAt, carAt } from './timeline.js';

/**
 * Everything inside the WebGL canvas. Objects are built once, then every frame is a
 * pure function of time: car pose, wheel spin, camera and moving shadow frustum.
 */
export const SupercarScene: React.FC<{ t: number }> = ({ t }) => {
  const { scene, gl, camera } = useThree();

  const rig = useMemo(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;

    scene.fog = new THREE.FogExp2('#35415f', 0.0065);
    scene.environment = buildEnvironmentMap(gl);
    scene.environmentIntensity = 0.85;

    const { world } = buildStreet();
    scene.add(world);

    const car = buildSupercar('SILENCATOR');
    scene.add(car.root);

    // blue-hour fill + last warm light from the west horizon
    const hemi = new THREE.HemisphereLight('#7088c0', '#1c1a18', 0.85);
    scene.add(hemi);
    const key = new THREE.DirectionalLight('#ffc08a', 1.1);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    const sc = key.shadow.camera;
    sc.left = -9;
    sc.right = 9;
    sc.top = 9;
    sc.bottom = -9;
    sc.near = 1;
    sc.far = 80;
    scene.add(key);
    scene.add(key.target);
    const rim = new THREE.DirectionalLight('#9db4ff', 0.55);
    rim.position.set(-30, 25, 40);
    scene.add(rim);

    return { car, key };
  }, [scene, gl]);

  // ---- per-frame state (pure function of t)
  const state = carAt(t);
  rig.car.update(state);

  rig.key.position.set(state.x + 28, 22, state.z - 10);
  rig.key.target.position.set(state.x, 0, state.z);
  rig.key.target.updateMatrixWorld();

  const cam = cameraAt(t);
  const pc = camera as THREE.PerspectiveCamera;
  pc.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  pc.fov = cam.fov;
  pc.near = 0.05;
  pc.far = 1500;
  pc.lookAt(cam.look[0], cam.look[1], cam.look[2]);
  pc.updateProjectionMatrix();

  return null;
};
