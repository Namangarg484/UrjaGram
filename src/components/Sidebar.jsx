function Sidebar({ activeModule, navItems, onSelect, settingsIcon: SettingsIcon, onSettings, onProfile, user }) {
  return (
    <aside className="no-print sticky top-0 flex h-screen w-16 shrink-0 flex-col overflow-hidden text-slate-800 md:w-[230px] bg-white/40 backdrop-blur-[40px] border-r border-white/60 z-40">
      {/* Light sweep for depth */}
      <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(120%_80%_at_30%_0%,rgba(255,255,255,0.8),transparent_60%)]" />

      <div className="border-b border-slate-900/10 px-3 py-5 md:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/40 text-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-slate-900/5 animate-floaty">
            🌿
          </div>
          <div className="hidden md:block">
            <div className="text-base font-extrabold tracking-tight text-slate-900">UrjaGram</div>
            <div className="text-[10px] uppercase font-bold tracking-[0.18em] text-slate-500">VET-OS Platform</div>
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
                    ? 'bg-white/60 text-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-slate-900/5'
                    : 'text-slate-600 hover:bg-white/30 hover:text-emerald-900'
                }`}
                title={item.label}
              >
                {/* Active accent bar */}
                <span
                  className={`absolute left-0 top-1/2 h-6 -translate-y-1/2 rounded-r-full bg-emerald-500 transition-all duration-300 ${
                    isActive ? 'w-1 opacity-100' : 'w-0 opacity-0'
                  }`}
                />
                <Icon className={`h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-emerald-600' : ''}`} />
                <span className="hidden text-sm font-medium md:inline">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-slate-900/10 px-2 py-4 md:px-3">
        <button
          onClick={onSettings}
          className="group mb-3 flex w-full items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-left text-slate-600 transition hover:bg-white/30 hover:text-slate-900 md:justify-start md:px-3"
          title="Settings"
        >
          <SettingsIcon className="h-5 w-5 shrink-0 transition-transform duration-500 group-hover:rotate-90" />
          <span className="hidden text-sm font-bold md:inline">Settings</span>
        </button>

        <button
          type="button"
          onClick={onProfile}
          title="Your profile"
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/60 bg-white/40 px-2 py-2.5 text-left backdrop-blur-md transition hover:border-emerald-200 hover:bg-white/60 md:justify-start md:px-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-300 text-xs font-bold text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            {user.initials}
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-bold text-slate-900">{user.name}</div>
            <div className="text-xs font-medium text-slate-500">{user.role}</div>
          </div>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;