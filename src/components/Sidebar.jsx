function Sidebar({ activeModule, navItems, onSelect, settingsIcon: SettingsIcon, onSettings, onProfile, user }) {
  return (
    <aside className="no-print sticky top-0 flex h-screen w-16 shrink-0 flex-col overflow-hidden text-white md:w-[230px] bg-slate-900/30 backdrop-blur-[40px] border-r border-white/10 z-40">
      {/* Light sweep for depth */}
      <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(120%_80%_at_30%_0%,rgba(16,185,129,0.15),transparent_60%)]" />

      <div className="border-b border-white/10 px-3 py-5 md:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-white/15 animate-floaty">
            🌿
          </div>
          <div className="hidden md:block">
            <div className="text-base font-bold tracking-tight">UrjaGram</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">VET-OS Platform</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 md:px-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`group relative flex w-full items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-left transition-all duration-300 md:justify-start md:px-3 ${
                  isActive
                    ? 'bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-white/15'
                    : 'text-white/65 hover:bg-white/8 hover:text-white'
                }`}
                title={item.label}
              >
                {/* Active accent bar */}
                <span
                  className={`absolute left-0 top-1/2 h-6 -translate-y-1/2 rounded-r-full bg-amber transition-all duration-300 ${
                    isActive ? 'w-1 opacity-100' : 'w-0 opacity-0'
                  }`}
                />
                <Icon className={`h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-amber' : ''}`} />
                <span className="hidden text-sm font-medium md:inline">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 px-2 py-4 md:px-3">
        <button
          onClick={onSettings}
          className="group mb-3 flex w-full items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-left text-white/65 transition hover:bg-white/8 hover:text-white md:justify-start md:px-3"
          title="Settings"
        >
          <SettingsIcon className="h-5 w-5 shrink-0 transition-transform duration-500 group-hover:rotate-90" />
          <span className="hidden text-sm font-medium md:inline">Settings</span>
        </button>

        <button
          type="button"
          onClick={onProfile}
          title="Your profile"
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-2 py-2.5 text-left backdrop-blur-md transition hover:border-white/25 hover:bg-white/12 md:justify-start md:px-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber to-[#b8860b] text-xs font-bold text-forest shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
            {user.initials}
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-white/60">{user.role}</div>
          </div>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;