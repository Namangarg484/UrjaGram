import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, Environment, ContactShadows, Float, Cloud, Clouds } from '@react-three/drei';

export default function Environment3D() {
  const cloudsRef = useRef();

  useFrame((state, delta) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <>
      {/* Bright, natural lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight 
        castShadow 
        position={[10, 20, 10]} 
        intensity={1.5} 
        shadow-mapSize={[1024, 1024]}
      >
        <orthographicCamera attach="shadow-camera" args={[-10, 10, 10, -10]} />
      </directionalLight>

      {/* Realistic Sky */}
      <Sky distance={450000} sunPosition={[10, 20, 10]} inclination={0.2} azimuth={0.25} />
      <Environment preset="city" />

      {/* Soft shadows on the ground */}
      <ContactShadows position={[0, -2, 0]} opacity={0.5} scale={50} blur={2} far={10} />

      {/* Gentle moving clouds for ambiance */}
      <group ref={cloudsRef} position={[0, 10, -10]}>
        <Clouds material="MeshBasicMaterial">
          <Cloud segments={40} bounds={[10, 2, 2]} volume={10} color="#ffffff" position={[-10, 0, 0]} speed={0.2} />
          <Cloud segments={40} bounds={[10, 2, 2]} volume={10} color="#ffffff" position={[10, 5, -5]} speed={0.3} />
        </Clouds>
      </group>

      {/* Simple 3D stylized terrain (a curved green surface) */}
      <mesh position={[0, -5, 0]} receiveShadow>
        <sphereGeometry args={[50, 64, 64]} />
        <meshStandardMaterial color="#86efac" roughness={0.8} />
      </mesh>
    </>
  );
}
