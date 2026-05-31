import { useEffect, useState } from 'react';
import { User, Mail, Shield, Check, LogOut, Settings as SettingsIcon } from 'lucide-react';
import Modal from './Modal';

function ProfileModal({ open, onClose, user, onSave, onOpenSettings, onSignOut }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email || '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user.name);
      setEmail(user.email || '');
      setSaved(false);
    }
  }, [open, user]);

  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleSave = () => {
    onSave({ ...user, name: name.trim() || user.name, email: email.trim(), initials });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <Modal open={open} onClose={onClose} title="Your profile" subtitle="Manage your account details" icon={User}>
      <div className="space-y-6">
        {/* Avatar header */}
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber to-[#b8860b] text-2xl font-bold text-forest shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ring-4 ring-white">
              {initials}
            </div>
            <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-meadow ring-2 ring-white" />
          </div>
          <div className="mt-3 text-lg font-semibold text-ink">{name}</div>
          <span className="mt-1 inline-flex items-center gap-1 rounded-badge bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">
            <Shield className="h-3 w-3" /> {user.role}
          </span>
        </div>

        {/* Editable fields */}
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Display name
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className="input-base pl-10"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="email"
                className="input-base pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
          </div>
        </div>

        <button onClick={handleSave} className={`btn-grad w-full py-3 ${saved ? 'pointer-events-none' : ''}`}>
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : (
            'Save changes'
          )}
        </button>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
          <button
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="flex items-center justify-center gap-2 rounded-input border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-meadow hover:text-meadow"
          >
            <SettingsIcon className="h-4 w-4" /> Settings
          </button>
          <button
            onClick={onSignOut}
            className="flex items-center justify-center gap-2 rounded-input border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ProfileModal;
