import { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getMembers, savePermissionMatrix } from '../../services/api';
import {
  PERMISSION_MODULES,
  ROLE_DEFAULTS,
  normalizeRole,
  effectiveLevel,
  loadPermissionMatrix,
  setPermissionCache,
  currentUser,
} from '../../utils/permissions';

const LEVEL_STYLE = {
  edit: 'bg-success/10 text-success border-success/30',
  view: 'bg-primary/10 text-primary border-primary/30',
  none: 'bg-surface-container text-on-surface-variant border-border-light',
};

// Ma trận quyền: hàng = tài khoản, cột = module. Chỉ quản lý (quyền cao nhất) mở được tab này.
export default function PermissionMatrix() {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const levelLabel = { edit: t('Toàn quyền', 'Full'), view: t('Chỉ xem', 'View'), none: t('Không truy cập', 'No access') };

  const [members, setMembers] = useState([]);
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const me = currentUser();

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMembers(), loadPermissionMatrix({ force: true })])
      .then(([memRes, perm]) => {
        if (cancelled) return;
        setMembers((memRes.data || []).filter((m) => m.active !== false));
        setSaved(perm.matrix || {});
        setDraft(perm.matrix || {});
      })
      .catch(() => { if (!cancelled) setError(t('Không tải được danh sách tài khoản / ma trận quyền.', 'Could not load accounts / permissions.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const dirty = useMemo(() => JSON.stringify(saved || {}) !== JSON.stringify(draft), [saved, draft]);

  const setCell = (userId, moduleKey, level, role) => {
    setDraft((prev) => {
      const row = { ...(prev[userId] || {}) };
      // Trùng mặc định của vai trò → bỏ ghi đè để sau này đổi mặc định vai trò vẫn áp dụng
      if (level === ROLE_DEFAULTS[role][moduleKey]) delete row[moduleKey];
      else row[moduleKey] = level;
      const next = { ...prev };
      if (Object.keys(row).length === 0) delete next[userId]; else next[userId] = row;
      return next;
    });
  };

  const resetRow = (userId) => setDraft((prev) => {
    const next = { ...prev };
    delete next[userId];
    return next;
  });

  const handleSave = async () => {
    setSaving(true);
    setNotice('');
    try {
      const res = await savePermissionMatrix(draft);
      setSaved(res.matrix);
      setDraft(res.matrix);
      setPermissionCache(res);
      setNotice(t('Đã lưu ma trận quyền.', 'Permissions saved.'));
    } catch (err) {
      setNotice(err?.response?.status === 403
        ? t('Chỉ quản lý mới được sửa ma trận quyền.', 'Only managers can edit permissions.')
        : t('Lưu thất bại. Vui lòng thử lại.', 'Save failed. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const rows = members
    .filter((m) => `${m.name || ''} ${m.email || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => normalizeRole(a.role).localeCompare(normalizeRole(b.role)) || String(a.name).localeCompare(String(b.name)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant">
        <span className="material-symbols-outlined text-[40px] text-outline-variant animate-spin">sync</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">{t('Phân quyền tài khoản', 'Account permissions')}</h2>
          <p className="text-on-surface-variant text-body-md max-w-2xl">
            {t(
              'Đặt mức truy cập từng module cho từng tài khoản. Ô không đặt riêng theo mặc định của vai trò (in nghiêng). "Không truy cập" sẽ ẩn module khỏi menu và chặn mở trang.',
              'Set module access per account. Unset cells follow the role default (italic). "No access" hides the module and blocks the page.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="border border-border-light rounded-lg px-3 py-2 text-body-sm bg-surface-container-lowest focus:ring-1 focus:ring-primary outline-none w-56"
            placeholder={t('Tìm tài khoản...', 'Search account...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => setDraft(saved || {})}
            disabled={!dirty || saving}
            className="px-4 py-2 border border-border-light rounded-lg text-[13px] font-medium hover:bg-surface-container-low disabled:opacity-40"
          >
            {t('Hoàn tác', 'Discard')}
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg text-[13px] font-bold hover:brightness-110 disabled:opacity-40"
          >
            {saving ? t('Đang lưu...', 'Saving...') : t('Lưu thay đổi', 'Save changes')}
          </button>
        </div>
      </div>

      {error && <p className="text-[13px] text-danger">{error}</p>}
      {notice && <p className="text-[13px] text-on-surface-variant">{notice}</p>}

      <div className="bg-surface-container-lowest border border-border-light rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-muted border-b border-border-light">
                <th className="px-4 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider sticky left-0 bg-surface-muted min-w-[220px]">{t('Tài khoản', 'Account')}</th>
                {PERMISSION_MODULES.map((m) => (
                  <th key={m.key} className="px-2 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider text-center whitespace-nowrap">{m[locale] || m.vi}</th>
                ))}
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {rows.length === 0 ? (
                <tr><td colSpan={PERMISSION_MODULES.length + 2} className="px-4 py-8 text-center text-on-surface-variant text-body-sm">{t('Không có tài khoản', 'No accounts')}</td></tr>
              ) : rows.map((m) => {
                const role = normalizeRole(m.role);
                const isSelf = me?.id && m.id === me.id;
                const hasOverride = Boolean(draft[m.id]);
                return (
                  <tr key={m.id} className="hover:bg-surface-bright">
                    <td className="px-4 py-2.5 sticky left-0 bg-surface-container-lowest">
                      <p className="text-[13px] font-semibold text-on-surface">{m.name || m.email}{isSelf && <span className="ml-1 text-[11px] font-normal text-on-surface-variant">({t('bạn', 'you')})</span>}</p>
                      <p className="text-[11px] text-on-surface-variant">
                        {m.email} · <span className={role === 'manager' ? 'text-primary font-semibold' : ''}>{role === 'manager' ? t('Quản lý', 'Manager') : t('Chuyên viên', 'Specialist')}</span>
                      </p>
                    </td>
                    {PERMISSION_MODULES.map((mod) => {
                      const level = effectiveLevel(draft, { id: m.id, role }, mod.key);
                      const isDefault = draft[m.id]?.[mod.key] === undefined;
                      return (
                        <td key={mod.key} className="px-2 py-2 text-center">
                          <select
                            value={level}
                            onChange={(e) => setCell(m.id, mod.key, e.target.value, role)}
                            title={isDefault ? t('Mặc định theo vai trò', 'Role default') : t('Đặt riêng cho tài khoản', 'Set for this account')}
                            className={`text-[12px] rounded-md border px-1.5 py-1 outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 ${LEVEL_STYLE[level]} ${isDefault ? 'italic' : 'font-semibold'}`}
                          >
                            {['edit', 'view', 'none'].map((lv) => <option key={lv} value={lv}>{levelLabel[lv]}</option>)}
                          </select>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => resetRow(m.id)}
                        disabled={!hasOverride}
                        className="text-[12px] font-semibold text-primary hover:underline disabled:opacity-30 disabled:no-underline whitespace-nowrap"
                        title={t('Bỏ các ô đặt riêng, dùng mặc định của vai trò', 'Reset to role defaults')}
                      >
                        {t('Mặc định', 'Reset')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-on-surface-variant">
        {t(
          'Mặc định: mọi vai trò toàn quyền các module trên. Quản lý dữ liệu (thành viên, phân quyền, cấu hình, sao lưu) chỉ dành cho Quản lý. Đổi vai trò tài khoản ở tab Thành viên.',
          'Defaults: full access to the modules above. Data management is manager-only. Change roles in the Members tab.'
        )}
      </p>
    </div>
  );
}
