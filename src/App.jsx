import { Bell, Flame, LayoutDashboard, Settings, Sun, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SolarAssessment from './components/SolarAssessment';
import VillageMap from './components/VillageMap';
import ViIPGenerator from './components/ViIPGenerator';
import MRVDashboard from './components/MRVDashboard';
import SchemeFinder from './components/SchemeFinder';
import WaterSolar from './components/WaterSolar';
import CleanCooking from './components/CleanCooking';
import Toast from './components/Toast';
import SettingsModal from './components/SettingsModal';
import ProfileModal from './components/ProfileModal';
import Environment3D from './components/Environment3D';
import { Canvas } from '@react-three/fiber';
import {
  fetchVillages,
  fetchAssessments,
  fetchMrvRecords,
  fetchViipDocuments,
  subscribeToAssessments,
} from './utils/supabaseClient';
import { initialAssessments, initialMrvRecords, initialVillages } from './data/sampleData';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',         icon: LayoutDashboard },
  { id: 'suryaghar', label: 'PM Surya Ghar',     icon: Sun },
  { id: 'cooking',   label: 'Clean Cooking',     icon: Flame },
];

const STATIC_USER = { name: 'Field User', role: 'Field Officer', initials: 'FU', email: '' };
const DEFAULT_SETTINGS = { animations: true, notifications: true, compact: false };

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = { ...fallback, ...JSON.parse(raw) };
    if (key === 'urjagram.user' && String(parsed.role || '').toLowerCase() === 'admin') {
      const safeName = parsed.name?.trim() ? parsed.name : fallback.name;
      const safeInitials = safeName.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
      return { ...parsed, role: 'Field Officer', name: safeName, initials: safeInitials || fallback.initials };
    }
    return parsed;
  } catch {
    return fallback;
  }
}

function App() {
  const [activeModule, setActiveModule] = useState('suryaghar');
  const [villages, setVillages] = useState(initialVillages);
  const [assessments, setAssessments] = useState(initialAssessments);
  const [mrvRecords, setMrvRecords] = useState(initialMrvRecords);
  const [viipDocuments, setViipDocuments] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [dbConnected, setDbConnected] = useState(false);
  const [user, setUser] = useState(() => loadStored('urjagram.user', STATIC_USER));
  const [settings, setSettings] = useState(() => loadStored('urjagram.settings', DEFAULT_SETTINGS));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const realtimeRef = useRef(null);

  useEffect(() => {
    loadAllData();
    realtimeRef.current = subscribeToAssessments((row) => {
      const normalised = {
        id: row.id, villageId: row.village_id, villageName: row.village_name, roofAreaSqm: row.roof_area_sqm, usableAreaSqm: row.usable_area_sqm, panelCount: row.panel_count, systemKWp: row.system_kwp, annualKWh: row.annual_kwh, co2OffsetT: row.co2_offset_t, coveragePct: row.coverage_pct, subsidyInr: row.subsidy_inr, confidence: row.confidence, orientation: row.orientation, shadingPct: row.shading_pct, roofTypeDetected: row.roof_type_detected, observations: row.observations, assessedAt: row.assessed_at,
      };
      setAssessments((prev) => {
        if (prev.find((a) => a.id === normalised.id)) return prev;
        return [normalised, ...prev];
      });
      showToast('New assessment synced from database ↗', 'success');
    });
    return () => realtimeRef.current?.unsubscribe();
  }, []);

  async function loadAllData() {
    const [vRes, aRes, mRes, dRes] = await Promise.all([ fetchVillages(), fetchAssessments(), fetchMrvRecords(), fetchViipDocuments() ]);
    if (vRes.data.length) setVillages(vRes.data.map((v) => ({
      id: v.id, name: v.name, gpName: v.gp_name, district: v.district, state: v.state, lat: Number(v.lat), lng: Number(v.lng), population: v.population, households: v.households, status: v.status,
    })));
    if (aRes.data.length) setAssessments(aRes.data);
    if (mRes.data.length) setMrvRecords(mRes.data);
    if (dRes.data.length) setViipDocuments(dRes.data);

    const anyError = vRes.error || aRes.error || mRes.error || dRes.error;
    setDbConnected(!anyError);
  }

  const showToast = (message, tone = 'success') => {
    if (!settings.notifications) return;
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((c) => [...c, { id, message, tone }]);
    setTimeout(() => setToasts((c) => c.filter((t) => t.id !== id)), 5000);
  };
  const removeToast = (id) => setToasts((c) => c.filter((t) => t.id !== id));
  const saveAssessment = (assessment) => {
    setAssessments((c) => { if (c.find((a) => a.id === assessment.id)) return c; return [assessment, ...c]; });
  };
  const saveViipDocument = (doc) => { setViipDocuments((c) => [doc, ...c]); showToast('ViIP document saved.'); };
  const addSchemeToViip = (scheme) => showToast(`${scheme.name} added to active ViIP ✓`);

  useEffect(() => { try { localStorage.setItem('urjagram.user', JSON.stringify(user)); } catch { } }, [user]);
  useEffect(() => {
    try { localStorage.setItem('urjagram.settings', JSON.stringify(settings)); } catch { }
    const root = document.documentElement;
    root.classList.toggle('no-motion', !settings.animations);
    root.classList.toggle('compact', settings.compact);
  }, [settings]);

  const handleSignOut = () => { setProfileOpen(false); showToast('Sign-out is disabled in this demo build.', 'error'); };

  const sharedModuleProps = { villages, assessments, mrvRecords, viipDocuments, setVillages, setAssessments, setMrvRecords, saveAssessment, saveViipDocument, addSchemeToViip, showToast, currentUser: user };

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return <Dashboard villages={villages} assessments={assessments} mrvRecords={mrvRecords} />;
      case 'suryaghar': return <SolarAssessment {...sharedModuleProps} />;
      case 'cooking':   return <CleanCooking showToast={showToast} />;
      default:          return <Dashboard villages={villages} assessments={assessments} mrvRecords={mrvRecords} />;
    }
  };

  return (
    <>
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <Canvas shadows camera={{ position: [0, 2, 8], fov: 45 }}>
          <Environment3D />
        </Canvas>
      </div>

      <div className="min-h-screen bg-transparent text-ink">
        <div className="flex min-h-screen">
          <Sidebar
            activeModule={activeModule}
            navItems={NAV_ITEMS}
            onSelect={setActiveModule}
            settingsIcon={Settings}
            onSettings={() => setSettingsOpen(true)}
            onProfile={() => setProfileOpen(true)}
            user={user}
          />

          <main className="min-w-0 flex-1 overflow-hidden z-10">
            <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/20 px-4 backdrop-blur-2xl md:px-6">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {NAV_ITEMS.find((n) => n.id === activeModule)?.label ?? 'Dashboard'}
                </span>
                <span className="hidden text-white/40 sm:inline">/</span>
                <span className="hidden text-xs text-emerald-400 font-medium tracking-wide uppercase sm:inline">UrjaGram VET-OS</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  title={dbConnected ? 'Supabase connected' : 'Using sample data'}
                  className={`hidden items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${
                    dbConnected ? 'bg-meadow/10 text-meadow' : 'bg-amber/15 text-amber'
                  }`}
                >
                  {dbConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {dbConnected ? 'Live' : 'Sample'}
                </span>
                <button
                  onClick={() => setSettingsOpen(true)}
                  title="Settings"
                  className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white backdrop-blur-md transition hover:border-emerald-400 hover:bg-emerald-400/20 sm:flex pointer-events-auto"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setProfileOpen(true)}
                  title="Your profile"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-bold text-slate-900 ring-2 ring-transparent transition hover:ring-emerald-400/50 pointer-events-auto shadow-[0_0_15px_rgba(52,211,153,0.5)]"
                >
                  {user.initials}
                </button>
              </div>
            </div>

            <div className="overflow-auto p-4 md:p-6 pointer-events-auto">{renderModule()}</div>
          </main>
        </div>

        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onChange={setSettings} dbConnected={dbConnected} counts={{ villages: villages.length, assessments: assessments.length, mrv: mrvRecords.length }} onReload={() => { loadAllData(); showToast('Reloading data from source…'); }} />
        <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} user={user} onSave={(next) => { setUser(next); showToast('Profile updated ✓'); }} onOpenSettings={() => setSettingsOpen(true)} onSignOut={handleSignOut} />

        <div className="fixed right-4 top-4 z-[1000] flex w-full max-w-sm flex-col gap-3 pointer-events-auto">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onClose={removeToast} />
          ))}
        </div>
      </div>
    </>
  );
}

export default App;
