import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { ScrollControls, Scroll, Html, Float } from '@react-three/drei';
import { Sun, Flame, LayoutDashboard, ArrowRight } from 'lucide-react';
import Environment3D from './components/Environment3D';
import SolarAssessment from './components/SolarAssessment';
import Dashboard from './components/Dashboard';
import CleanCooking from './components/CleanCooking';
import { initialVillages, initialAssessments, initialMrvRecords } from './data/sampleData';

function FloatingMenu({ activeModule, setActiveModule }) {
  const modules = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-500' },
    { id: 'suryaghar', label: 'PM Surya Ghar', icon: Sun, color: 'text-amber-500' },
    { id: 'cooking', label: 'Clean Cooking', icon: Flame, color: 'text-rose-500' }
  ];

  return (
    <Html position={[0, 3, 0]} center transform>
      <div className="bg-white/80 backdrop-blur-xl p-4 rounded-3xl shadow-2xl flex gap-6 border border-white">
        {modules.map((m) => (
          <button
            key={m.id}
            onClick={() => setActiveModule(m.id)}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
              activeModule === m.id ? 'bg-emerald-50 shadow-inner border-emerald-200 scale-105' : 'hover:bg-white border-transparent'
            } border`}
          >
            <m.icon className={`w-8 h-8 ${m.color}`} />
            <span className="text-sm font-bold text-slate-800">{m.label}</span>
          </button>
        ))}
      </div>
    </Html>
  );
}

function Floating3DHouse() {
  return (
    <group position={[0, -1, -5]}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 3, 4]} />
          <meshStandardMaterial color="#fcd34d" />
        </mesh>
        <mesh position={[0, 2.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
          <coneGeometry args={[3.5, 2, 4]} />
          <meshStandardMaterial color="#b91c1c" />
        </mesh>
        {/* Solar Panel on Roof */}
        <mesh position={[0, 2, 1.5]} rotation={[0.6, 0, 0]} castShadow>
          <boxGeometry args={[2, 0.1, 1.5]} />
          <meshStandardMaterial color="#0369a1" metalness={0.8} roughness={0.2} />
        </mesh>
      </Float>
    </group>
  );
}

export default function App() {
  const [activeModule, setActiveModule] = useState('suryaghar');
  const [villages, setVillages] = useState(initialVillages);
  const [assessments, setAssessments] = useState(initialAssessments);
  const [mrvRecords, setMrvRecords] = useState(initialMrvRecords);
  const [viipDocuments, setViipDocuments] = useState([]);
  
  const showToast = (msg) => console.log(msg);

  const sharedModuleProps = {
    villages, assessments, mrvRecords, viipDocuments,
    setVillages, setAssessments, setMrvRecords,
    saveAssessment: () => {}, saveViipDocument: () => {}, addSchemeToViip: () => {}, showToast,
    currentUser: { name: 'User', role: 'Household' },
  };

  return (
    <div className="w-full h-screen bg-[#86efac] overflow-hidden">
      <Canvas shadows camera={{ position: [0, 2, 8], fov: 45 }}>
        <Environment3D />
        
        {/* The 3D Scene Elements */}
        <Floating3DHouse />
        <FloatingMenu activeModule={activeModule} setActiveModule={setActiveModule} />

        {/* Standard UI wrapped in HTML overlays so it floats in 3D space */}
        <ScrollControls pages={activeModule === 'suryaghar' ? 3 : 1} damping={0.2}>
          <Scroll html style={{ width: '100%', height: '100%' }}>
            <div className="w-full min-h-screen flex items-center justify-center pointer-events-none p-4 mt-40">
              <div className="w-full max-w-5xl pointer-events-auto bg-white/60 backdrop-blur-3xl p-6 rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white">
                {activeModule === 'dashboard' && <Dashboard villages={villages} assessments={assessments} mrvRecords={mrvRecords} />}
                {activeModule === 'suryaghar' && <SolarAssessment {...sharedModuleProps} />}
                {activeModule === 'cooking' && <CleanCooking showToast={showToast} />}
              </div>
            </div>
          </Scroll>
        </ScrollControls>
      </Canvas>
    </div>
  );
}