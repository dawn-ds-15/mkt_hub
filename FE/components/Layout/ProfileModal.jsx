import { useState } from 'react';

function getLocalUser() {
  try {
    const raw = localStorage.getItem('mkt_hub_user');
    return raw ? JSON.parse(raw) : { name: '', email: '' };
  } catch { return { name: '', email: '' }; }
}

function saveLocalUser(data) {
  const current = getLocalUser();
  const updated = { ...current, ...data };
  localStorage.setItem('mkt_hub_user', JSON.stringify(updated));
  return updated;
}

export default function ProfileModal({ onClose }) {
  const user = getLocalUser();
  const [name, setName] = useState(user.name || '');
  const [email] = useState(user.email || '');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('success');

  const handleSave = () => {
    if (!name.trim()) {
      setMessage('Vui lòng nhập tên'); setMsgType('error'); return;
    }
    saveLocalUser({ name: name.trim() });

    if (newPw || confirmPw || oldPw) {
      if (!oldPw || !newPw || !confirmPw) {
        setMessage('Vui lòng điền đầy đủ thông tin mật khẩu'); setMsgType('error'); return;
      }
      if (newPw !== confirmPw) {
        setMessage('Mật khẩu mới không khớp'); setMsgType('error'); return;
      }
      if (newPw.length < 6) {
        setMessage('Mật khẩu phải có ít nhất 6 ký tự'); setMsgType('error'); return;
      }
      const stored = localStorage.getItem('mkt_hub_password');
      if (stored && stored !== oldPw) {
        setMessage('Mật khẩu cũ không đúng'); setMsgType('error'); return;
      }
      localStorage.setItem('mkt_hub_password', newPw);
    }

    setMessage('Cập nhật thành công'); setMsgType('success');
    setTimeout(() => { setMessage(''); onClose(); }, 1200);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md pointer-events-auto mx-4">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-bold">Chỉnh sửa thông tin</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tên hiển thị</label>
              <input className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Email</label>
              <p className="px-3 py-2 bg-gray-50 rounded text-sm text-gray-500">{email || 'Chưa có email'}</p>
            </div>

            <hr className="border-gray-200" />

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Mật khẩu cũ</label>
              <input type="password" className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="Để trống nếu không đổi" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Mật khẩu mới</label>
              <input type="password" className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Để trống nếu không đổi" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Xác nhận mật khẩu mới</label>
              <input type="password" className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:border-blue-500 focus:ring-0 outline-none" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Để trống nếu không đổi" />
            </div>

            {message && (
              <p className={`text-xs flex items-center gap-1 ${msgType === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                <span className="material-symbols-outlined text-[14px]">{msgType === 'success' ? 'check_circle' : 'error'}</span>
                {message}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all">Hủy</button>
              <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:opacity-90 transition-all">Lưu</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
