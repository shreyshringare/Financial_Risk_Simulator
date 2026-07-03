"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COUNT = 4000;
const MAX_AGE = 6; // seconds a particle lives
const DRIFT = 0.02;
const VOL = 0.55;

function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function Particles() {
  const points = useRef<THREE.Points>(null!);
  const { positions, ages, prices, lanes } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const ages = new Float32Array(COUNT);
    const prices = new Float32Array(COUNT);
    const lanes = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      ages[i] = Math.random() * MAX_AGE;
      prices[i] = 0;
      lanes[i] = (Math.random() - 0.5) * 4;
    }
    return { positions, ages, prices, lanes };
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    for (let i = 0; i < COUNT; i++) {
      ages[i] += dt;
      if (ages[i] > MAX_AGE) {
        ages[i] = 0;
        prices[i] = 0;
      }
      prices[i] += DRIFT * dt + VOL * Math.sqrt(dt) * gauss();
      const t = ages[i] / MAX_AGE;
      positions[i * 3] = -4 + t * 9;
      positions[i * 3 + 1] = prices[i];
      positions[i * 3 + 2] = lanes[i] * t;
    }
    points.current.geometry.attributes.position.needsUpdate = true;
    const { x, y } = state.pointer;
    state.camera.position.x = Math.sin(state.clock.elapsedTime * 0.05) * 1.5 + x * 0.6;
    state.camera.position.y = 0.5 + y * 0.4;
    state.camera.lookAt(0.5, 0, 0);
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#003a70"
        transparent
        opacity={0.35}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.5, 6], fov: 55 }}
      gl={{ antialias: false, powerPreference: "low-power" }}
      dpr={[1, 1.5]}
      style={{ position: "absolute", inset: 0 }}
    >
      <Particles />
      <fog attach="fog" args={["#ffffff", 6, 12]} />
    </Canvas>
  );
}
