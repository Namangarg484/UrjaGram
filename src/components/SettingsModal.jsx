import { Settings, Wifi, WifiOff, Bell, Sparkles, RefreshCw, Database, Info } from 'lucide-react';
import Modal from './Modal';

function Toggle({ checked, onChange, label, description, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-4 rounded-2xl border border-border/60 bg-white/70 px-4 py-3.5 text-left transition hover:border-meadow/50"
    >
      {Icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest/8 text-meadow">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${
          checked ? 'bg-meadow' : 'bg-border'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function SettingsModal({ open, onClose, settings, onChange, dbConnected, counts, onReload }) {
  const set = (key) => (value) => onChange({ ...settings, [key]: value });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      subtitle="Personalise how UrjaGram looks and behaves"
      icon={Settings}
      footer={
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">UrjaGram VET-OS · v2.0</span>
          <button onClick={onClose} className="btn-grad px-5 py-2.5 text-sm">Done</button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Connection status */}
        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-white to-parchment/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  dbConnected ? 'bg-meadow/12 text-meadow' : 'bg-amber/15 text-amber'
                }`}
              >
                {dbConnected ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
              </span>
              <div>
                <div className="text-sm font-semibold text-ink">
                  {dbConnected ? 'Database connected' : 'Sample data mode'}
                </div>
                <div className="text-xs text-muted">
                  {dbConnected ? 'Realtime Supabase sync active' : 'Run the SQL migration to go live'}
                </div>
              </div>
            </div>
            <button
              onClick={onReload}
              title="Reload data"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-white text-muted transition hover:rotate-180 hover:border-meadow hover:text-meadow"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Villages', value: counts.villages },
              { label: 'Assessments', value: counts.assessments },
              { label: 'MRV records', value: counts.mrv },
            ].map((c) => (
              <div key={c.label} className="rounded-xl bg-white/70 py-2">
                <div className="text-lg font-bold text-forest">{c.value}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted">{c.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Preferences */}
        <div className="space-y-3">
          <div className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Preferences</div>
          <Toggle
            icon={Sparkles}
            label="Animations & motion"
            description="Smooth transitions and floating effects"
            checked={settings.animations}
            onChange={set('animations')}
          />
          <Toggle
            icon={Bell}
            label="Notification toasts"
            description="Show pop-up confirmations and sync alerts"
            checked={settings.notifications}
            onChange={set('notifications')}
          />
          <Toggle
            icon={Database}
            label="Compact density"
            description="Tighten spacing to fit more on screen"
            checked={settings.compact}
            onChange={set('compact')}
          />
        </div>

        {/* About */}
        <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-white/60 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-meadow" />
          <p className="text-xs leading-relaxed text-muted">
            UrjaGram is a Village Energy Transition OS — solar assessment, water-energy planning,
            MRV tracking and government scheme matching for NetZero 2047.
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default SettingsModal;
