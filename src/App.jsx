import { Bell, FileText, LayoutDashboard, Map, Search, Settings, Sun, BarChart2, Wifi, WifiOff, Droplets } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SolarAssessment from './components/SolarAssessment';
import VillageMap from './components/VillageMap';
import ViIPGenerator from './components/ViIPGenerator';
import MRVDashboard from './components/MRVDashboard';
import SchemeFinder from './components/SchemeFinder';
import WaterSolar from './components/WaterSolar';
import Toast from './components/Toast';
import SettingsModal from './components/SettingsModal';
import ProfileModal from './components/ProfileModal';
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
  { id: 'solar',     label: 'Solar Assessment',   icon: Sun },
  { id: 'water',     label: 'Water + Solar',       icon: Droplets },
  { id: 'map',       label: 'Village Map',        icon: Map },
  { id: 'viip',      label: 'ViIP Generator',     icon: FileText },
  { id: 'mrv',       label: 'MRV Dashboard',      icon: BarChart2 },
  { id: 'schemes',   label: 'Scheme Finder',      icon: Search },
];

const STATIC_USER = { name: 'Naman Garg', role: 'Admin', initials: 'NG', email: 'naman@urjagram.in' };

const DEFAULT_SETTINGS = { animations: true, notifications: true, compact: false };

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [activeModule, setActiveModule] = useState('dashboard');
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


  // ── Load data from Supabase on mount ───────────────────────────────────────
  useEffect(() => {
    loadAllData();
    // Real-time: new assessment inserted from any device → push into local state
    realtimeRef.current = subscribeToAssessments((row) => {
      const normalised = {
        id: row.id,
        villageId: row.village_id,
        villageName: row.village_name,
        roofAreaSqm: row.roof_area_sqm,
        usableAreaSqm: row.usable_area_sqm,
        panelCount: row.panel_count,
        systemKWp: row.system_kwp,
        annualKWh: row.annual_kwh,
        co2OffsetT: row.co2_offset_t,
        coveragePct: row.coverage_pct,
        subsidyInr: row.subsidy_inr,
        confidence: row.confidence,
        orientation: row.orientation,
        shadingPct: row.shading_pct,
        roofTypeDetected: row.roof_type_detected,
        observations: row.observations,
        assessedAt: row.assessed_at,
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
    const [vRes, aRes, mRes, dRes] = await Promise.all([
      fetchVillages(),
      fetchAssessments(),
      fetchMrvRecords(),
      fetchViipDocuments(),
    ]);

    // Only replace sample data if Supabase actually returned rows
    if (vRes.data.length) setVillages(vRes.data.map((v) => ({
      id: v.id,
      name: v.name,
      gpName: v.gp_name,
      district: v.district,
      state: v.state,
      lat: Number(v.lat),
      lng: Number(v.lng),
      population: v.population,
      households: v.households,
      status: v.status,
    })));
    if (aRes.data.length) setAssessments(aRes.data);
    if (mRes.data.length) setMrvRecords(mRes.data);
    if (dRes.data.length) setViipDocuments(dRes.data);

    const anyError = vRes.error || aRes.error || mRes.error || dRes.error;
    setDbConnected(!anyError);
    if (anyError) {
      console.warn('[UrjaGram] Supabase fetch error — using sample data. Run the SQL migration first.');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showToast = (message, tone = 'success') => {
    if (!settings.notifications) return;
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((c) => [...c, { id, message, tone }]);
    setTimeout(() => setToasts((c) => c.filter((t) => t.id !== id)), 5000);
  };

  const removeToast = (id) => setToasts((c) => c.filter((t) => t.id !== id));

  const saveAssessment = (assessment) => {
    setAssessments((c) => {
      if (c.find((a) => a.id === assessment.id)) return c;
      return [assessment, ...c];
    });
  };

  const saveViipDocument = (doc) => {
    setViipDocuments((c) => [doc, ...c]);
    showToast('ViIP document saved.');
  };

  const addSchemeToViip = (scheme) => {
    showToast(`${scheme.name} added to active ViIP ✓`);
  };

  // ── Persist user + settings, and reflect settings on the document root ──────
  useEffect(() => {
    try { localStorage.setItem('urjagram.user', JSON.stringify(user)); } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    try { localStorage.setItem('urjagram.settings', JSON.stringify(settings)); } catch { /* ignore */ }
    const root = document.documentElement;
    root.classList.toggle('no-motion', !settings.animations);
    root.classList.toggle('compact', settings.compact);
  }, [settings]);

  const handleSignOut = () => {
    setProfileOpen(false);
    showToast('Sign-out is disabled in this demo build.', 'error');
  };

  const sharedModuleProps = {
    villages, assessments, mrvRecords, viipDocuments,
    setVillages, setAssessments, setMrvRecords,
    saveAssessment, saveViipDocument, addSchemeToViip, showToast,
    currentUser: user,
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return <Dashboard villages={villages} assessments={assessments} mrvRecords={mrvRecords} />;
      case 'solar':     return <SolarAssessment {...sharedModuleProps} />;
      case 'water':     return <WaterSolar showToast={showToast} />;
      case 'map':       return <VillageMap villages={villages} assessments={assessments} showToast={showToast} />;
      case 'viip':      return <ViIPGenerator {...sharedModuleProps} />;
      case 'mrv':       return <MRVDashboard villages={villages} mrvRecords={mrvRecords} assessments={assessments} showToast={showToast} />;
      case 'schemes':   return <SchemeFinder addSchemeToViip={addSchemeToViip} showToast={showToast} />;
      default:          return <Dashboard villages={villages} assessments={assessments} mrvRecords={mrvRecords} />;
    }
  };

  return (
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

        <main className="min-w-0 flex-1 overflow-hidden">
          {/* Compact top bar — branding lives in sidebar */}
          <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/40 bg-white/70 px-4 backdrop-blur-xl md:px-6">
            {/* Left: current module label */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">
                {NAV_ITEMS.find((n) => n.id === activeModule)?.label ?? 'Dashboard'}
              </span>
              <span className="hidden text-muted sm:inline">/</span>
              <span className="hidden text-xs text-muted sm:inline">UrjaGram VET-OS</span>
            </div>

            {/* Right: status + user */}
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
              <span className="hidden rounded-full bg-amber/15 px-2.5 py-1 text-[11px] font-semibold text-amber lg:inline">
                NetZero 2047
              </span>
              <button
                title="Notifications"
                onClick={() => showToast(`${assessments.length} assessments · ${mrvRecords.length} MRV records · ${dbConnected ? 'realtime sync active' : 'offline sample data'}`, dbConnected ? 'success' : 'error')}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-white/80 text-muted backdrop-blur-sm transition hover:border-meadow hover:text-meadow"
              >
                <Bell className="h-4 w-4" />
                {dbConnected && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-meadow ring-2 ring-white" />}
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                title="Settings"
                className="hidden h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-white/80 text-muted backdrop-blur-sm transition hover:border-meadow hover:text-meadow sm:flex"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={() => setProfileOpen(true)}
                title="Your profile"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-xs font-bold text-white ring-2 ring-transparent transition hover:ring-amber/60"
              >
                {user.initials}
              </button>
            </div>
          </div>

          <div className="overflow-auto p-4 md:p-6">{renderModule()}</div>
        </main>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={setSettings}
        dbConnected={dbConnected}
        counts={{ villages: villages.length, assessments: assessments.length, mrv: mrvRecords.length }}
        onReload={() => { loadAllData(); showToast('Reloading data from source…'); }}
      />

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user}
        onSave={(next) => { setUser(next); showToast('Profile updated ✓'); }}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={handleSignOut}
      />

      <div className="fixed right-4 top-4 z-[1000] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </div>
  );
}

export default App;