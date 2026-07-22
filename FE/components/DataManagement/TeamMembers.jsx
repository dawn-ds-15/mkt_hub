import { useEffect, useState, useCallback } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getMembers, createMember, updateMember, deleteMember } from '../../services/api';

function getInitials(name) {
  return name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
}

function getColor(name) {
  const colors = [
    'bg-primary-fixed/30 text-primary border-primary/20',
    'bg-success/20 text-success border-success/20',
    'bg-tertiary/20 text-tertiary border-tertiary/20',
    'bg-primary-fixed/20 text-primary-fixed border-primary-fixed/20',
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function TeamMembers() {
  const { locale } = useDashboard();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'Specialist', password: '', active: true });
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const load = useCallback(async () => {
    try {
      const res = await getMembers();
      setMembers(res.data || []);
    } catch {
      showToast(locale === 'vi' ? 'Không thể tải danh sách thành viên' : 'Unable to load member list', 'error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ name: '', email: '', role: 'Specialist', password: '', active: true });
    setShowModal('add');
  };

  const openEdit = (m) => {
    setForm({ name: m.name, email: m.email, role: m.role, password: '', active: m.active });
    setShowModal('edit');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      showToast(locale === 'vi' ? 'Vui lòng nhập họ tên và email' : 'Please enter name and email', 'error');
      return;
    }
    if (showModal === 'add' && !form.password) {
      showToast(locale === 'vi' ? 'Vui lòng nhập mật khẩu' : 'Please enter a password', 'error');
      return;
    }
    try {
      if (showModal === 'add') {
        await createMember(form);
        showToast(locale === 'vi' ? 'Thêm member thành công' : 'Member added successfully');
      } else {
        const m = members.find(m => m.email === form.email);
        if (m) await updateMember(m.id, form);
        showToast(locale === 'vi' ? 'Cập nhật member thành công' : 'Member updated successfully');
      }
      setShowModal(null);
      load();
    } catch (err) {
      const msg = err?.response?.data?.message || (locale === 'vi' ? 'Lỗi khi lưu member' : 'Error saving member');
      showToast(Array.isArray(msg) ? msg.join('; ') : msg, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(locale === 'vi' ? 'Xóa member này?' : 'Delete this member?')) return;
    setMembers(prev => prev.filter(m => m.id !== id));
    try {
      await deleteMember(id);
      showToast(locale === 'vi' ? 'Đã xóa member' : 'Member deleted');
    } catch {
      showToast(locale === 'vi' ? 'Lỗi khi xóa member' : 'Error deleting member', 'error');
    }
  };

  const toggleActive = async (m) => {
    try {
      await updateMember(m.id, { name: m.name, email: m.email, role: m.role, active: !m.active });
      load();
    } catch {
      showToast(locale === 'vi' ? 'Lỗi khi cập nhật trạng thái' : 'Error updating status', 'error');
    }
  };

  const getRelativeTime = (d) => {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (diff < 1) return locale === 'vi' ? 'Vừa xong' : 'Just now';
    if (diff < 60) return locale === 'vi' ? `${diff}m trước` : `${diff}m ago`;
    if (diff < 1440) return locale === 'vi' ? `${Math.floor(diff / 60)}h trước` : `${Math.floor(diff / 60)}h ago`;
    return locale === 'vi' ? `${Math.floor(diff / 1440)} ngày trước` : `${Math.floor(diff / 1440)} days ago`;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-on-surface-variant">{locale === 'vi' ? 'Đang tải...' : 'Loading...'}</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">{locale === 'vi' ? 'Thành viên Nhóm' : 'Team Members'}</h2>
          <p className="text-on-surface-variant text-body-md">{locale === 'vi' ? 'Quản lý quyền truy cập và vai trò trong không gian làm việc' : 'Manage access permissions and roles in the workspace'}</p>
        </div>
        <button onClick={openAdd} className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-title-md flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined">person_add</span>
          {locale === 'vi' ? 'Thêm Member' : 'Add Member'}
        </button>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
          <span className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">{locale === 'vi' ? `DANH SÁCH • ${members.length} THÀNH VIÊN` : `LIST • ${members.length} MEMBERS`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-on-surface-variant/70 border-b border-outline-variant">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{locale === 'vi' ? 'THÀNH VIÊN' : 'MEMBER'}</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">EMAIL</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{locale === 'vi' ? 'VAI TRÒ' : 'ROLE'}</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">{locale === 'vi' ? 'TRẠNG THÁI' : 'STATUS'}</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-right">{locale === 'vi' ? 'THAO TÁC' : 'ACTIONS'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-primary/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${getColor(member.name)} flex items-center justify-center font-bold text-sm border`}>
                        {getInitials(member.name)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-on-surface font-semibold text-sm">{member.name}</span>
                        <span className="text-xs text-on-surface-variant">{locale === 'vi' ? 'Hoạt động:' : 'Active:'} {getRelativeTime(member.lastActive)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4"><span className="text-sm text-on-surface-variant">{member.email}</span></td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
                      member.role === 'Manager' ? 'bg-primary-fixed/20 text-primary border-primary/20' : 'bg-outline-variant/20 text-on-surface-variant border-outline-variant/30'
                    }`}>{member.role}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={member.active} onChange={() => toggleActive(member)} />
                        <div className="w-9 h-5 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-success" />
                      </label>
                      <span className={`text-xs font-medium ${member.active ? 'text-success' : 'text-on-surface-variant'}`}>
                        {member.active ? (locale === 'vi' ? 'Hoạt động' : 'Active') : (locale === 'vi' ? 'Không hoạt động' : 'Inactive')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(member)} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors" title={locale === 'vi' ? 'Sửa' : 'Edit'}>
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      {!member.locked && (
                        <button onClick={() => handleDelete(member.id)} className="p-2 rounded-lg hover:bg-error/10 text-error transition-colors" title={locale === 'vi' ? 'Xóa' : 'Delete'}>
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowModal(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md pointer-events-auto mx-4 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">{showModal === 'add' ? (locale === 'vi' ? 'Thêm Member' : 'Add Member') : (locale === 'vi' ? 'Sửa Member' : 'Edit Member')}</h3>
                <button onClick={() => setShowModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Họ và tên' : 'Full Name'}</label>
                  <input className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary outline-none" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">Email</label>
                  <input className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary outline-none" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Vai trò' : 'Role'}</label>
                  <select className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary outline-none" value={form.role} onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))}>
                    <option value="Manager">Manager</option>
                    <option value="Specialist">Specialist</option>
                  </select>
                </div>
                {showModal === 'add' && (
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase">{locale === 'vi' ? 'Mật khẩu' : 'Password'}</label>
                    <input type="password" className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary outline-none" value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowModal(null)} className="px-4 py-2 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-gray-50">{locale === 'vi' ? 'Hủy' : 'Cancel'}</button>
                <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:opacity-90">{locale === 'vi' ? 'Lưu' : 'Save'}</button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-semibold ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}
