import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ScrollControls, Scroll, useScroll, Float, Stars, Sparkles } from '@react-three/drei';
import { motion } from 'framer-motion';
import { ArrowRight, Leaf, BatteryCharging } from 'lucide-react';

function RotatingSun() {
  const sunRef = useRef();
  useFrame((state, delta) => {
    if (sunRef.current) {
      sunRef.current.rotation.y += delta * 0.2;
      sunRef.current.rotation.x += delta * 0.1;
    }
  });
  
  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <mesh ref={sunRef} position={[0, 0, -5]}>
        <sphereGeometry args={[2.5, 64, 64]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={2} wireframe />
      </mesh>
    </Float>
  );
}

function FloatingPanels() {
  const scroll = useScroll();
  const group = useRef();
  
  useFrame(() => {
    if (group.current) {
      const offset = scroll.offset; // 0 to 1
      group.current.position.y = offset * 10 - 5;
      group.current.rotation.y = offset * Math.PI * 2;
    }
  });

  return (
    <group ref={group}>
      <Float speed={1.5} rotationIntensity={1} floatIntensity={2}>
        <mesh position={[-3, 2, -2]} rotation={[0.5, 0.5, 0]}>
          <boxGeometry args={[2, 0.1, 1]} />
          <meshStandardMaterial color="#0f766e" metalness={0.8} roughness={0.2} />
        </mesh>
      </Float>
      <Float speed={1} rotationIntensity={1.5} floatIntensity={1.5}>
        <mesh position={[3, -1, -3]} rotation={[-0.5, 0.2, 0.1]}>
          <boxGeometry args={[1.5, 0.1, 1.5]} />
          <meshStandardMaterial color="#0369a1" metalness={0.8} roughness={0.2} />
        </mesh>
      </Float>
    </group>
  );
}

function StoryText({ onEnter }) {
  return (
    <div className="w-full relative pointer-events-auto">
      {/* Page 1 */}
      <section className="h-screen flex flex-col justify-center items-center text-center p-8 text-white relative">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.5 }}
          transition={{ duration: 1 }}
        >
          <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-orange-500">
            The Sun is Calling
          </h1>
          <p className="text-xl md:text-3xl max-w-2xl font-light text-white/80">
            Every day, boundless energy pours from the sky. It's time we capture it.
          </p>
          <div className="mt-12 animate-bounce">
            <p className="text-sm uppercase tracking-widest text-white/50 mb-2">Scroll Down</p>
            <div className="w-px h-16 bg-gradient-to-b from-white/50 to-transparent mx-auto"></div>
          </div>
        </motion.div>
      </section>

      {/* Page 2 */}
      <section className="h-screen flex flex-col justify-center items-start text-left p-8 md:p-24 text-white relative">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false, amount: 0.5 }}
          transition={{ duration: 1 }}
          className="max-w-xl"
        >
          <div className="bg-emerald-500/20 p-4 rounded-2xl w-fit mb-6 border border-emerald-500/30 backdrop-blur-md">
            <Leaf className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-emerald-100">
            Powering Rural India
          </h2>
          <p className="text-lg md:text-2xl font-light text-white/70 leading-relaxed">
            From dark nights to bright futures. UrjaGram is bridging the gap with clean, affordable, and sustainable energy for every household.
          </p>
        </motion.div>
      </section>

      {/* Page 3 */}
      <section className="h-screen flex flex-col justify-center items-end text-right p-8 md:p-24 text-white relative">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false, amount: 0.5 }}
          transition={{ duration: 1 }}
          className="max-w-xl flex flex-col items-end"
        >
          <div className="bg-blue-500/20 p-4 rounded-2xl w-fit mb-6 border border-blue-500/30 backdrop-blur-md">
            <BatteryCharging className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-blue-100">
            Take Control
          </h2>
          <p className="text-lg md:text-2xl font-light text-white/70 leading-relaxed mb-12">
            Predict your demand. Estimate your savings. Join the PM Surya Ghar initiative in just 10 seamless steps.
          </p>
          <button
            onClick={onEnter}
            className="group relative px-8 py-5 bg-white text-emerald-900 font-black rounded-full overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] transition-all cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="relative z-10 flex items-center gap-3 text-lg group-hover:text-white transition-colors duration-500">
              Enter UrjaGram <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </motion.div>
      </section>
    </div>
  );
}

export default function StorybookLanding({ onEnter }) {
  return (
    <div className="w-full h-screen bg-[#020617] overflow-hidden fixed inset-0 z-50">
      <Canvas shadows camera={{ position: [0, 0, 10], fov: 50 }}>
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#020617', 10, 20]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} castShadow />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Sparkles count={100} scale={12} size={2} speed={0.4} opacity={0.2} color="#fbbf24" />

        <ScrollControls pages={3} damping={0.2}>
          <RotatingSun />
          <FloatingPanels />
          <Scroll html style={{ width: '100%', height: '100%' }}>
            <StoryText onEnter={onEnter} />
          </Scroll>
        </ScrollControls>
      </Canvas>
    </div>
  );
}
