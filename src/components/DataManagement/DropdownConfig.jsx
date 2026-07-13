import { useEffect, useState } from 'react';
import { getDropdownKeys, addDropdownValue, deleteDropdownValue } from '../../services/api';

export default function DropdownConfig() {
  const [keys, setKeys] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    getDropdownKeys().then((res) => {
      setKeys(res.data);
      if (res.data.length > 0) setActiveKey(res.data[0]);
      setLoading(false);
    });
  }, []);

  const handleAdd = () => {
    if (!newValue.trim()) return;
    addDropdownValue(activeKey.id, newValue).then((res) => {
      setKeys(prev => prev.map(k => k.id === activeKey.id ? { ...k, values: [...k.values, res.data] } : k));
      setActiveKey(prev => ({ ...prev, values: [...prev.values, res.data] }));
      setNewValue('');
    });
  };

  const handleDelete = (valueId) => {
    deleteDropdownValue(activeKey.id, valueId).then(() => {
      setKeys(prev => prev.map(k => k.id === activeKey.id ? { ...k, values: k.values.filter(v => v.id !== valueId) } : k));
      setActiveKey(prev => ({ ...prev, values: prev.values.filter(v => v.id !== valueId) }));
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-on-surface-variant">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Dropdown Configuration</h2>
        <p className="text-body-md text-on-surface-variant">Manage the system-wide options available in the application dropdown menus.</p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Keys List */}
        <div className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <div className="p-4 border-b border-outline-variant">
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Dropdown Keys</h3>
          </div>
          <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
            {keys.map((key) => (
              <button
                key={key.id}
                onClick={() => setActiveKey(key)}
                className={`w-full text-left p-4 rounded-lg flex items-center justify-between group transition-all ${
                  activeKey?.id === key.id
                    ? 'bg-primary-fixed/20 border border-primary/30 text-primary'
                    : 'hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-title-md">{key.label}</span>
                  <span className="text-xs opacity-60">{key.values.length} values defined</span>
                </div>
                <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
              </button>
            ))}
          </div>
        </div>

        {/* Values Editor */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">{activeKey?.label}</h3>
                <p className="text-body-md text-on-surface-variant">Click to edit. Delete to remove from global list.</p>
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-high hover:bg-surface-container text-on-surface rounded-lg transition-all border border-outline-variant">
                  <span className="material-symbols-outlined text-sm">undo</span>
                  <span className="text-body-md">Reset</span>
                </button>
                <button className="flex items-center gap-2 px-6 py-2 bg-primary text-on-primary rounded-lg transition-all font-bold shadow-lg shadow-primary/10 active:scale-95">
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span className="text-body-md">Save Changes</span>
                </button>
              </div>
            </div>

            {/* Values List */}
            <div className="space-y-2 mb-8">
              {activeKey?.values.map((val) => (
                <div key={val.id} className="flex items-center gap-3 p-3 bg-surface-container-low border border-outline-variant rounded-xl group hover:border-primary/30 transition-all">
                  <span className="material-symbols-outlined text-on-surface-variant/40 cursor-grab active:cursor-grabbing">drag_indicator</span>
                  <div className="flex-1 text-body-md text-on-surface">{val.label}</div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 hover:bg-surface-container-high rounded-lg text-on-surface-variant" title="Edit">
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(val.id)}
                      className="p-1.5 hover:bg-error/10 rounded-lg text-error"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Value */}
            <div className="pt-6 border-t border-outline-variant">
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-label-md text-on-surface-variant uppercase px-1">Add new value</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-body-md"
                    placeholder="e.g. Influencer Collaboration"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  />
                  <button
                    onClick={handleAdd}
                    className="px-6 bg-surface-container-high hover:bg-surface-container text-primary border border-primary/20 rounded-lg transition-all font-bold flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined">add</span>
                    <span className="text-body-md">Add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 border-l-4 border-secondary flex gap-4 items-start">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <span className="material-symbols-outlined text-secondary">info</span>
            </div>
            <div>
              <h4 className="font-title-md text-title-md text-secondary mb-1">Global Impact Warning</h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Changes made here will immediately affect all <span className="text-on-surface font-semibold underline decoration-secondary/30">active project filters</span> and <span className="text-on-surface font-semibold underline decoration-secondary/30">analytics groupings</span> across the workspace. Deleting a key that is currently in use will leave existing records with a null value.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
