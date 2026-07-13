export default function CreateProjectForm() {
  return (
    <div className="sticky top-24 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Create Project</h3>
        <button className="text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1">
          <label className="text-label-sm font-bold text-on-surface-variant uppercase">Project Name</label>
          <input
            className="w-full px-4 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="e.g. Annual Report 2024"
            type="text"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-label-sm font-bold text-on-surface-variant uppercase">Type</label>
            <select className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none">
              <option>Social Media</option>
              <option>Campaign</option>
              <option>Product Launch</option>
              <option>SEO/SEM</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-label-sm font-bold text-on-surface-variant uppercase">Status</label>
            <select className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none">
              <option>Planned</option>
              <option>In Progress</option>
              <option>On Hold</option>
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-label-sm font-bold text-on-surface-variant uppercase">Owner</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">person</span>
            <input
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              placeholder="Assign owner..."
              type="text"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-label-sm font-bold text-on-surface-variant uppercase">Deadline</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">event</span>
            <input
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              type="date"
            />
          </div>
        </div>
        <div className="border-t border-outline-variant pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Financials</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Direct Budget</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md text-right focus:ring-1 focus:ring-primary outline-none" placeholder="$0.00" type="text" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Overhead</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md text-right focus:ring-1 focus:ring-primary outline-none" placeholder="$0.00" type="text" />
            </div>
          </div>
        </div>
        <div className="border-t border-outline-variant pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Performance KPI</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Planned (Goal)</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary outline-none" placeholder="100,000" type="text" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Actual (Reach)</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary outline-none" placeholder="0" type="text" />
            </div>
          </div>
        </div>
        <button className="w-full py-3 bg-primary text-on-primary rounded font-bold text-label-md mt-6 hover:shadow-lg transition-all active:scale-[0.98]" type="submit">
          Save Changes
        </button>
        <button className="w-full py-3 bg-transparent text-on-surface-variant border border-outline-variant rounded font-bold text-label-md hover:bg-surface-container transition-all" type="button">
          Reset Form
        </button>
      </form>
    </div>
  );
}
