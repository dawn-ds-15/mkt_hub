export default function Topbar({ title = 'Dashboard Overview' }) {
  return (
    <header className="fixed top-0 right-0 h-topbar-height bg-surface border-b border-border-light flex justify-between items-center px-container-margin w-[calc(100%-260px)] ml-auto z-40">
      <div className="flex items-center gap-4">
        <h2 className="font-headline-sm text-headline-sm text-primary font-bold">{title}</h2>
        <span className="px-2 py-0.5 bg-surface-container text-[10px] font-bold text-secondary rounded flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
          Syncing...
        </span>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <button className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer relative">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full" />
          </button>
          <button className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
            <span className="material-symbols-outlined">history</span>
          </button>
        </div>
        <div className="h-8 w-[1px] bg-border-light" />
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right">
            <p className="text-body-sm font-bold text-on-surface">Minh Tran</p>
            <p className="text-[10px] text-on-surface-variant">Admin Manager</p>
          </div>
          <div className="w-10 h-10 bg-primary-container text-white rounded-full flex items-center justify-center font-bold">
            MT
          </div>
        </div>
      </div>
    </header>
  );
}
