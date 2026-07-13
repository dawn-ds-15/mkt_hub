import { useState } from 'react';

const initialMembers = [
  { id: 1, initials: 'AN', name: 'Anh Nguyen', email: 'anh.nguyen@mkthub.io', role: 'Manager', active: true, lastActive: '2m ago', color: 'bg-primary-fixed/30 text-primary border-primary/20' },
  { id: 2, initials: 'HL', name: 'Hoang Lam', email: 'lam.h@mkthub.io', role: 'Specialist', active: true, lastActive: '45m ago', color: 'bg-success/20 text-success border-success/20' },
  { id: 3, initials: 'MT', name: 'Minh Tu', email: 'tu.m@mkthub.io', role: 'Specialist', active: false, lastActive: '3h ago', color: 'bg-tertiary/20 text-tertiary border-tertiary/20' },
  { id: 4, initials: 'TV', name: 'Thai Vu', email: 'vu.t@mkthub.io', role: 'Specialist', active: true, lastActive: 'Yesterday', color: 'bg-primary-fixed/20 text-primary-fixed border-primary-fixed/20' },
];

export default function TeamMembers() {
  const [members, setMembers] = useState(initialMembers);

  const toggleActive = (id) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, active: !m.active } : m));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Thành viên Nhóm</h2>
          <p className="text-on-surface-variant text-body-md">Quản lý quyền truy cập và vai trò trong không gian làm việc</p>
        </div>
        <button className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-title-md flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined">person_add</span>
          Thêm Member
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
          <span className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">DANH SÁCH • {members.length} THÀNH VIÊN</span>
          <div className="flex gap-2">
            <button className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">filter_list</span>
            </button>
            <button className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">more_vert</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-on-surface-variant/70 border-b border-outline-variant">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">THÀNH VIÊN</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">EMAIL</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">VAI TRÒ</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">TRẠNG THÁI</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-primary/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${member.color} flex items-center justify-center font-bold text-sm border`}>
                        {member.initials}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-on-surface font-semibold text-sm">{member.name}</span>
                        <span className="text-xs text-on-surface-variant">Hoạt động gần nhất: {member.lastActive}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-on-surface-variant">{member.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
                      member.role === 'Manager'
                        ? 'bg-primary-fixed/20 text-primary border-primary/20'
                        : 'bg-outline-variant/20 text-on-surface-variant border-outline-variant/30'
                    }`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={member.active}
                          onChange={() => toggleActive(member.id)}
                        />
                        <div className="w-9 h-5 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-success" />
                      </label>
                      <span className={`text-xs font-medium ${member.active ? 'text-success' : 'text-on-surface-variant'}`}>
                        {member.active ? 'Hoạt động' : 'Không hoạt động'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Edit member">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button className="p-2 rounded-lg hover:bg-error/10 text-error transition-colors" title="Delete member">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-surface-container-low/30 flex items-center justify-between">
          <span className="text-xs text-on-surface-variant">Hiển thị 1-{members.length} trong tổng số {members.length} thành viên</span>
          <div className="flex gap-1">
            <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high disabled:opacity-30" disabled>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary text-on-primary font-medium text-xs">1</button>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high disabled:opacity-30" disabled>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
