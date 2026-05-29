function Sidebar({ activeModule, navItems, onSelect, settingsIcon: SettingsIcon, user }) {
  return (
    <aside className="no-print sticky top-0 flex h-screen w-16 shrink-0 flex-col bg-forest text-white md:w-[220px]">
      <div className="border-b border-white/10 px-3 py-5 md:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">🌿</div>
          <div className="hidden md:block">
            <div className="text-base font-semibold tracking-tight">UrjaGram</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/65">VET-OS Platform</div>
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
                className={`flex w-full items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-left transition md:justify-start md:px-3 ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/8 hover:text-white'
                }`}
                title={item.label}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="hidden text-sm font-medium md:inline">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 px-2 py-4 md:px-3">
        <button className="mb-3 flex w-full items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-left text-white/70 transition hover:bg-white/8 hover:text-white md:justify-start md:px-3" title="Settings">
          <SettingsIcon className="h-5 w-5 shrink-0" />
          <span className="hidden text-sm font-medium md:inline">Settings</span>
        </button>

        <div className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 md:justify-start md:px-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber text-xs font-semibold text-forest">
            {user.initials}
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-white/65">{user.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;