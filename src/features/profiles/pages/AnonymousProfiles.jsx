import LoadState from '@/features/profiles/components/LoadState';
import { downloadCsv } from '@/features/profiles/utils/profileExport';
import { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '@/shared/stores/DashboardContext';
import { ANON_STATUS } from '@/shared/mocks/profiles';
import {
  getAnonymousProfiles, getAnonymousConflicts, getIpClusters, getTrackingSites, getAnonymousAudit,
  convertAnonymousProfile, resolveAnonymousConflict, confirmIpCluster, rejectIpCluster,
  createTrackingSite, toggleTrackingSite,
} from '@/shared/api/httpClient';
import { normalizeAnonProfile, normalizeConflict, normalizeCluster, normalizeSite, normalizeAudit } from '@/features/profiles/utils/normalizeProfiles';
import {
  Card, SectionTitle, Badge, KpiCard, Toolbar, SearchInput, Select, Button, TabBar,
  Modal, Field, Input, Textarea, Toast, Th, Td, EmptyState,
} from '@/features/profiles/components/ui';

const statusOptions = [
  { value: 'all', label: 'Trạng thái: Tất cả' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'signal', label: 'Có tín hiệu định danh' },
  { value: 'duplicate', label: 'Có khả năng trùng' },
  { value: 'pending', label: 'Chờ MKT xử lý' },
  { value: 'inactive', label: 'Không hoạt động' },
  { value: 'identified', label: 'Đã định danh' },
];

const userTypeOptions = [
  { value: 'all', label: 'Loại user: Tất cả' },
  { value: 'new', label: 'User mới' },
  { value: 'returning', label: 'User quay lại' },
];

const siteOptions = [
  { value: 'all', label: 'Site: Tất cả domain' },
  { value: 'mkt.smartlog.vn', label: 'mkt.smartlog.vn' },
  { value: 'landing-event2026.com', label: 'landing-event2026.com' },
  { value: 'docs.smartlog.vn', label: 'docs.smartlog.vn' },
];

const tierOptions = [
  { value: 'all', label: 'Mức điểm: Tất cả' },
  { value: 'hot', label: 'Hot (>70)' },
  { value: 'warm', label: 'Warm (30–70)' },
  { value: 'cold', label: 'Cold (<30)' },
];

const mask = (v) => (v ? `${v.slice(0, 8)}***${v.slice(-3)}` : '—');
const fmt = (n) => Number(n).toLocaleString('vi-VN');

const normalizePhone = (raw) => {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (/^0\d{9}$/.test(digits)) return `+84${digits.slice(1)}`;
  if (/^84\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\+84\d{9}$/.test(digits)) return digits;
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  return null;
};

const formatPhone = (p) => {
  if (!p) return '';
  const m = p.match(/^\+84(\d{3})(\d{3})(\d{3})$/);
  return m ? `+84 ${m[1]} ${m[2]} ${m[3]}` : p;
};

export default function AnonymousProfiles() {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);

  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState('profiles');
  const [profiles, setProfiles] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [sites, setSites] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [pRes, cRes, clRes, sRes, aRes] = await Promise.all([
          getAnonymousProfiles(),
          getAnonymousConflicts(),
          getIpClusters(),
          getTrackingSites(),
          getAnonymousAudit(),
        ]);
        if (cancelled) return;
        if (Array.isArray(pRes?.data)) {
          const nextProfiles = pRes.data.map(normalizeAnonProfile);
          setProfiles(nextProfiles);
          setSelectedId((current) => (nextProfiles.some((p) => p.id === current) ? current : nextProfiles[0]?.id || ''));
        }
        if (Array.isArray(cRes?.data)) setConflicts(cRes.data.map(normalizeConflict));
        if (Array.isArray(clRes?.data)) setClusters(clRes.data.map(normalizeCluster));
        if (Array.isArray(sRes?.data)) setSites(sRes.data.map(normalizeSite));
        if (Array.isArray(aRes?.data)) setAuditTrail(aRes.data.map(normalizeAudit));
      } catch (err) {
        if (!cancelled) setLoadError(err.response?.data?.message || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [userType, setUserType] = useState('all');
  const [site, setSite] = useState('all');
  const [tier, setTier] = useState('all');
  const [toast, setToast] = useState('');
  const [convertTarget, setConvertTarget] = useState(null);
  const [convertPhone, setConvertPhone] = useState('');
  const [convertName, setConvertName] = useState('');
  const [convertCompany, setConvertCompany] = useState('');
  const [conflictAction, setConflictAction] = useState(null);
  const [conflictNote, setConflictNote] = useState('');
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [newSite, setNewSite] = useState({ name: '', domain: '' });

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (status !== 'all' && p.status !== status) return false;
      if (userType !== 'all' && p.userType !== userType) return false;
      if (site !== 'all' && p.site !== site) return false;
      if (tier !== 'all' && p.tier !== tier) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [p.id, p.cookie, p.device, p.ip, p.company || '', p.site].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [profiles, status, userType, site, tier, search]);

  const selected = profiles.find((p) => p.id === selectedId) || filtered[0] || profiles[0];

  if (loading || loadError) return <LoadState loading={loading} error={loadError} onRetry={() => setReload((n) => n + 1)} />;

  const activeCount = profiles.filter((p) => p.status === 'active').length;
  const newCount = profiles.filter((p) => p.userType === 'new').length;
  const returningCount = profiles.filter((p) => p.userType === 'returning').length;
  const signalCount = profiles.filter((p) => p.status === 'signal').length;
  const pendingCount = profiles.filter((p) => p.status === 'pending' || p.conflict).length;
  const engagedCount = profiles.filter((p) => p.engaged).length;

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setUserType('all');
    setSite('all');
    setTier('all');
  };

  const openConvert = (profile) => {
    setConvertTarget(profile);
    setConvertPhone('');
    setConvertName('');
    setConvertCompany(profile.company || '');
  };

  const confirmConvert = async () => {
    const normalized = normalizePhone(convertPhone);
    if (!normalized) {
      notify(t('Số điện thoại không hợp lệ về định dạng.', 'Invalid phone number format.'));
      return;
    }
    try {
      await convertAnonymousProfile(convertTarget?.id, {
        phone: normalized,
        name: convertName || undefined,
        company: convertCompany || undefined,
      });
    } catch (err) {
      notify({ error: true, message: err.response?.data?.message || err.message });
      return;
    }
    setProfiles((prev) =>
      prev.map((p) => (p.id === convertTarget?.id ? { ...p, status: 'identified' } : p))
    );
    setConvertTarget(null);
    const targetLabel = convertTarget?.displayId || convertTarget?.id;
    notify(t(`Đã chuyển ${targetLabel} thành Lead ${formatPhone(normalized)}.`, `Converted ${targetLabel} to Lead ${formatPhone(normalized)}.`));
  };

  const handleConflict = async (conflict, action) => {
    try {
      await resolveAnonymousConflict(conflict.id, {
        action,
        note: conflictNote || undefined,
      });
    } catch (err) {
      notify({ error: true, message: err.response?.data?.message || err.message });
      return;
    }
    setConflicts((prev) =>
      prev.map((c) =>
        c.id === conflict.id
          ? { ...c, status: action === 'insufficient' ? 'pending' : 'resolved', resolution: action }
          : c
      )
    );
    setConflictAction(null);
    setConflictNote('');
    const labels = {
      merge: t('Đã hợp nhất vào hồ sơ chính.', 'Merged into primary profile.'),
      keep: t('Đã giữ các hồ sơ độc lập.', 'Profiles kept separate.'),
      move: t('Đã chuyển khóa kỹ thuật được chọn.', 'Selected technical key moved.'),
      insufficient: t('Đã lưu ghi chú, tiếp tục chờ xử lý.', 'Note saved, remains in queue.'),
    };
    notify(labels[action] || '');
  };

  const setClusterStatus = async (cluster, next) => {
    try {
      if (next === 'confirmed') await confirmIpCluster(cluster.id);
      else if (next === 'rejected') await rejectIpCluster(cluster.id);
    } catch (err) {
      notify({ error: true, message: err.response?.data?.message || err.message });
      return;
    }
    setClusters((prev) => prev.map((c) => (c.id === cluster.id ? { ...c, status: next } : c)));
    notify(next === 'confirmed' ? t('Đã xác nhận quan hệ IP – Công ty.', 'IP–Company relation confirmed.') : t('Đã từ chối gợi ý công ty.', 'Company suggestion rejected.'));
  };

  const addSite = async () => {
    if (!newSite.name.trim() || !newSite.domain.trim()) return;
    try {
      const res = await createTrackingSite({ name: newSite.name.trim(), domain: newSite.domain.trim() });
      const created = res.data || {};
      if (!created.id || !created.siteId || !created.trackingKey) throw new Error(t('Phản hồi Site không hợp lệ.', 'Invalid site response.'));
      setSites((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name || newSite.name.trim(),
          domain: created.domain || newSite.domain.trim(),
          siteId: created.siteId,
          trackingKey: created.trackingKey,
          status: created.status || 'active',
          events: created.events || 0,
          lastEvent: created.lastEvent || '—',
        },
      ]);
    } catch (err) {
      notify({ error: true, message: err.response?.data?.message || err.message });
      return;
    }
    setNewSite({ name: '', domain: '' });
    setShowSiteModal(false);
    notify(t('Đã tạo Site và cấp Tracking Key.', 'Site created with a new Tracking Key.'));
  };

  const toggleSite = async (s) => {
    try {
      await toggleTrackingSite(s.id);
    } catch (err) {
      notify({ error: true, message: err.response?.data?.message || err.message });
      return;
    }
    setSites((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' } : x)));
    notify(t('Đã cập nhật trạng thái Site.', 'Site status updated.'));
  };

  const tabItems = [
    { key: 'profiles', label: t('Hồ sơ & Hành trình', 'Profiles & Journey'), count: profiles.length },
    { key: 'conflicts', label: t('Xung đột định danh', 'Identity Conflicts'), count: conflicts.filter((c) => c.status !== 'resolved').length },
    { key: 'clusters', label: t('Cụm IP & Công ty', 'IP Clusters & Companies') },
    { key: 'sites', label: t('Site & Tracking Keys', 'Sites & Tracking Keys'), count: sites.length },
    { key: 'audit', label: t('Audit Trail', 'Audit Trail') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-[22px]">visibility_off</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-headline-md text-[20px] font-bold text-on-surface tracking-tight">
                {t('Hồ sơ ẩn danh', 'Anonymous Profiles')}
              </h1>
              <Badge tone="brand">BDD-02</Badge>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t('Dữ liệu đã tải', 'Loaded data')}
              </span>
            </div>
            <p className="font-body-sm text-[12px] text-on-surface-variant mt-0.5">
              {t(
                'Cookie ID, Device Fingerprint, IP và tín hiệu hành vi trước khi khách để lại số điện thoại.',
                'Cookie ID, device fingerprint, IP and behavioral signals before identity is known.'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" onClick={() => downloadCsv('anonymous-profiles.csv', filtered.map((p) => ({ id: p.id, cookie: mask(p.cookie), device: mask(p.device), ip: mask(p.ip), company: p.company, score: p.score, status: p.status })))}>
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            {t('Xuất dữ liệu (đã che)', 'Export (masked)')}
          </Button>
          <Button variant="danger" onClick={() => setTab('conflicts')}>
            <span className="material-symbols-outlined text-[16px]">rule_folder</span>
            {t('Xử lý xung đột', 'Resolve conflicts')} ({conflicts.filter((c) => c.status !== 'resolved').length})
          </Button>
          <Button variant="primary" onClick={() => setTab('sites')}>
            <span className="material-symbols-outlined text-[16px]">tune</span>
            {t('Cấu hình Tracking', 'Configure tracking')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <KpiCard label={t('Đang hoạt động', 'Active')} value={fmt(activeCount)}  icon={() => <span className="material-symbols-outlined text-[18px]">group</span>} />
        <KpiCard label={t('User mới (30N)', 'New users (30D)')} value={fmt(newCount)}  icon={() => <span className="material-symbols-outlined text-[18px]">person_add</span>} />
        <KpiCard label={t('User quay lại', 'Returning users')} value={fmt(returningCount)}  icon={() => <span className="material-symbols-outlined text-[18px]">replay</span>} />
        <KpiCard label={t('Tín hiệu định danh', 'Identity signals')} value={fmt(signalCount)} sub={t('Chờ hoàn tất số điện thoại', 'Awaiting phone number')} icon={() => <span className="material-symbols-outlined text-[18px]">contact_phone</span>} />
        <KpiCard label={t('Cảnh báo quay lại', 'Return alerts')} value={fmt(pendingCount)} trend={t('SLA phản hồi < 15 phút', 'Response SLA < 15 min')} tone="danger" icon={() => <span className="material-symbols-outlined text-[18px]">notification_important</span>} />
        <KpiCard label={t('Engaged session', 'Engaged session')} value={`${((engagedCount / (profiles.length || 1)) * 100).toFixed(1)}%`} sub=">10s / ≥2 page view / conversion" progress={(engagedCount / (profiles.length || 1)) * 100} icon={() => <span className="material-symbols-outlined text-[18px]">timer</span>} />
      </div>

      <Card className="overflow-hidden">
        <TabBar tabs={tabItems} active={tab} onChange={setTab} />

        {tab === 'profiles' && (
          <>
            <Toolbar>
              <div className="flex-1 min-w-[220px]">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder={t('Tìm Anonymous ID, Cookie ID, Device ID, IP…', 'Search Anonymous ID, Cookie, Device, IP…')}
                />
              </div>
              <Select value={status} onChange={setStatus} options={statusOptions} />
              <Select value={userType} onChange={setUserType} options={userTypeOptions} />
              <Select value={site} onChange={setSite} options={[{ value: 'all', label: t('Site: Tất cả domain', 'Site: All domains') }, ...[...new Set([...sites.map((s) => s.domain), ...profiles.map((p) => p.site)].filter(Boolean))].map((domain) => ({ value: domain, label: domain }))]} />
              <Select value={tier} onChange={setTier} options={tierOptions} />
              <button onClick={resetFilters} className="font-label-sm text-[11px] text-secondary hover:underline px-1">
                {t('Xóa bộ lọc', 'Clear filters')}
              </button>
              <span className="ml-auto font-body-sm text-[11px] text-on-surface-variant">
                {t('Hiển thị', 'Showing')} <strong>{filtered.length}</strong> / {profiles.length}
              </span>
            </Toolbar>

            <div className="grid grid-cols-1 xl:grid-cols-12">
              <div className="xl:col-span-7 xl:border-r border-outline-variant/60">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-surface-container-low">
                      <tr>
                        <Th>{t('Hồ sơ / Khóa kỹ thuật', 'Profile / Keys')}</Th>
                        <Th>{t('Phân loại & Hành vi', 'Segment & Behavior')}</Th>
                        <Th>{t('Công ty dự đoán & IP', 'Predicted company & IP')}</Th>
                        <Th className="text-center">{t('Điểm', 'Score')}</Th>
                        <Th>{t('Touchpoint', 'Touchpoint')}</Th>
                        <Th className="text-right">{t('Thao tác', 'Actions')}</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      {filtered.map((p) => {
                        const st = ANON_STATUS[p.status] || ANON_STATUS.active;
                        const isSel = selected?.id === p.id;
                        return (
                          <tr
                            key={p.id}
                            onClick={() => setSelectedId(p.id)}
                            className={`cursor-pointer transition-colors ${isSel ? 'bg-primary-fixed/30' : 'bg-surface-container-lowest hover:bg-surface-container-low'}`}
                          >
                            <Td>
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-headline-sm text-[13px] font-bold text-primary-container">{p.displayId || p.id}</span>
                                  {p.status === 'active' && <span className="w-2 h-2 rounded-full bg-emerald-500" title={t('Đang online', 'Online now')} />}
                                  {p.conflict && <span className="w-2 h-2 rounded-full bg-red-500" title={t('Có xung đột', 'Conflict')} />}
                                </div>
                                <span className="font-mono text-[10px] text-on-surface-variant">{mask(p.cookie)}</span>
                                <span className="font-mono text-[10px] text-outline">{p.deviceLabel}</span>
                              </div>
                            </Td>
                            <Td>
                              <div className="flex flex-col gap-1 items-start">
                                <Badge tone={p.userType === 'returning' ? 'info' : 'neutral'}>
                                  {p.userType === 'returning' ? `${t('Quay lại', 'Returning')} (${p.sessions} ${t('phiên', 'sessions')})` : t('User mới', 'New')}
                                </Badge>
                                {p.engaged && <Badge tone="active">{t('Engaged', 'Engaged')}</Badge>}
                                <Badge tone={st.tone}>{st.label}</Badge>
                              </div>
                            </Td>
                            <Td>
                              <div className="flex flex-col gap-0.5">
                                <span className={`text-[12px] font-semibold ${p.company ? 'text-on-surface' : 'text-on-surface-variant italic font-normal'}`}>
                                  {p.company || t('Chưa xác định DN', 'Company unknown')}
                                </span>
                                <span className="font-mono text-[10px] text-on-surface-variant">{mask(p.ip)} · {p.ipLabel}</span>
                                {p.company && !p.companyConfirmed && (
                                  <span className="font-label-sm text-[9px] text-amber-600">
                                    {t('Tin cậy', 'Confidence')}: {p.companyConfidence}
                                  </span>
                                )}
                                <span className="font-label-sm text-[9px] text-outline">{p.location}</span>
                              </div>
                            </Td>
                            <Td className="text-center">
                              <div className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-lg ${
                                p.tier === 'hot' ? 'bg-red-50 text-red-700' : p.tier === 'warm' ? 'bg-surface-container-high text-on-surface' : 'bg-surface-container text-on-surface-variant'
                              }`}>
                                <span className="font-headline-sm text-[15px] font-bold leading-none num">{p.score}</span>
                                <span className="font-label-sm text-[8px] uppercase font-bold tracking-tight mt-0.5">{p.tier}</span>
                              </div>
                            </Td>
                            <Td>
                              <div className="flex flex-col max-w-[160px]">
                                <span className="text-[11px] font-medium text-on-surface truncate" title={p.firstTouch}>
                                  {t('First', 'First')}: {p.firstTouch}
                                </span>
                                <span className="text-[10px] text-on-surface-variant truncate" title={p.lastTouch}>
                                  {t('Last', 'Last')}: {p.lastTouch}
                                </span>
                                <span className="text-[9px] text-outline">{p.lastActive}</span>
                              </div>
                            </Td>
                            <Td className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openConvert(p); }}
                                  title={t('Định danh hồ sơ', 'Identify profile')}
                                  className="p-1.5 rounded-lg bg-primary-container text-on-primary hover:bg-secondary"
                                >
                                  <span className="material-symbols-outlined text-[15px]">how_to_reg</span>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}
                                  title={t('Xem hành trình', 'View journey')}
                                  className="p-1.5 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                                >
                                  <span className="material-symbols-outlined text-[15px]">timeline</span>
                                </button>
                              </div>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!filtered.length && <EmptyState message={t('Không có hồ sơ khớp bộ lọc.', 'No profiles match the filters.')} />}
                </div>
              </div>

              <div className="xl:col-span-5">
                {selected ? (
                  <div className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
                          <span className="material-symbols-outlined text-[18px]">fingerprint</span>
                        </div>
                        <div>
                          <div className="font-headline-sm text-[14px] font-bold text-on-surface flex items-center gap-2">
                            {selected.displayId || selected.id}
                            <Badge tone={(ANON_STATUS[selected.status] || {}).tone || 'neutral'}>{(ANON_STATUS[selected.status] || {}).label}</Badge>
                          </div>
                          <div className="font-body-sm text-[11px] text-on-surface-variant">
                            {t('Hoạt động cuối', 'Last active')}: {selected.lastActive} · {selected.site}
                          </div>
                        </div>
                      </div>
                      <button className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant" title={t('Mở rộng', 'Expand')}>
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { l: 'Cookie ID', v: mask(selected.cookie) },
                        { l: 'Device ID', v: selected.device === '—' ? '—' : mask(selected.device) },
                        { l: 'Session ID', v: (selected.sessionList || [])[0]?.id || '—' },
                        { l: 'External User ID', v: selected.userId || '—' },
                      ].map((x) => (
                        <div key={x.l} className="p-2 rounded-lg bg-surface-container-low">
                          <div className="font-label-sm text-[9px] uppercase tracking-wider text-on-surface-variant">{x.l}</div>
                          <div className="font-mono text-[10px] text-on-surface truncate" title={x.v}>{x.v}</div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-surface-container-low">
                        <div className="font-label-sm text-[9px] uppercase tracking-wider text-on-surface-variant">{t('Điểm tạm tính', 'Provisional score')}</div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xl font-bold num text-on-surface">{selected.score}</span>
                          <Badge tone={selected.tier === 'hot' ? 'danger' : selected.tier === 'warm' ? 'warm' : 'neutral'}>{selected.tier}</Badge>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-surface-container-low">
                        <div className="font-label-sm text-[9px] uppercase tracking-wider text-on-surface-variant">{t('Phiên / Trang', 'Sessions / Pages')}</div>
                        <div className="text-xl font-bold num text-on-surface">
                          {selected.sessions} <span className="text-[11px] font-normal text-on-surface-variant">/ {(selected.sessionList || []).reduce((s, x) => s + (x?.pages || 0), 0)}</span>
                        </div>
                      </div>
                    </div>

                    {selected.company && (
                      <div className="p-2.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest">
                        <div className="flex items-center justify-between">
                          <div className="font-label-sm text-[9px] uppercase tracking-wider text-on-surface-variant">{t('Công ty dự đoán', 'Predicted company')}</div>
                          <Badge tone={selected.companyConfidence === 'high' ? 'active' : selected.companyConfidence === 'medium' ? 'warm' : 'neutral'}>
                            {t('Tin cậy', 'Confidence')}: {selected.companyConfidence}
                          </Badge>
                        </div>
                        <div className="font-headline-sm text-[13px] font-semibold text-on-surface mt-1">{selected.company}</div>
                        <div className="flex items-center gap-1.5 mt-2">
                          <Button size="sm" disabled={!clusters.some((c) => c.suggestion === selected.company)} onClick={() => setClusterStatus(clusters.find((c) => c.suggestion === selected.company), 'confirmed')}>{t('Xác nhận', 'Confirm')}</Button>
                          <Button size="sm" variant="secondary" disabled={!clusters.some((c) => c.suggestion === selected.company)} onClick={() => setClusterStatus(clusters.find((c) => c.suggestion === selected.company), 'rejected')}>{t('Từ chối', 'Reject')}</Button>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-label-md text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant">{t('Timeline hành vi', 'Behavior timeline')}</span>
                        <span className="font-body-sm text-[10px] text-outline">{(selected.timeline || []).length} {t('sự kiện', 'events')}</span>
                      </div>
                      <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-1">
                        {(selected.timeline || []).map((ev, i) => (
                          <div key={i} className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-surface-container-low">
                            <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${i === 0 ? 'bg-primary-container' : 'bg-outline-variant'}`} />
                            <div className="min-w-0 flex-1">
                              <div className="font-body-sm text-[11px] font-medium text-on-surface capitalize">{String(ev.event || '').replace(/_/g, ' ')}</div>
                              <div className="font-mono text-[10px] text-on-surface-variant truncate">{ev.detail}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-label-sm text-[9px] text-outline">{ev.time}</div>
                              <div className="font-label-sm text-[9px] text-on-surface-variant">{ev.channel}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="font-label-md text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-1.5">{t('Phiên truy cập', 'Sessions')}</div>
                      <div className="space-y-1">
                        {(selected.sessionList || []).map((s) => (
                          <div key={s.id} className="flex items-center justify-between p-1.5 rounded-lg bg-surface-container-low">
                            <div>
                              <div className="font-mono text-[10px] text-on-surface">{s.id} · {s.source}</div>
                              <div className="font-body-sm text-[10px] text-on-surface-variant">{s.start} · {s.pages} {t('trang', 'pages')}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-body-sm text-[10px] text-on-surface">{s.duration}</div>
                              {s.engaged ? <Badge tone="active">{t('Engaged', 'Engaged')}</Badge> : <Badge tone="neutral">{t('Thoát', 'Bounce')}</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => openConvert(selected)} disabled={selected.status === 'identified'}>
                        <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                        {selected.status === 'identified' ? t('Đã định danh', 'Identified') : t('Chuyển thành Lead', 'Convert to Lead')}
                      </Button>
                      <Button variant="secondary" onClick={() => setTab('audit')}>
                        <span className="material-symbols-outlined text-[16px]">history</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <EmptyState message={t('Chọn một hồ sơ để xem hành trình.', 'Select a profile to view its journey.')} />
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'conflicts' && (
          <div>
            <div className="px-4 py-3 bg-red-50/60 border-b border-red-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-[18px]">warning</span>
              <p className="font-body-sm text-[11px] text-red-700">
                {t(
                  'Không tự động hợp nhất khi Cookie / Device / External User ID liên quan từ hai số điện thoại trở lên. Mọi quyết định đều được ghi audit.',
                  'Never auto-merge when a Cookie / Device / External User ID maps to two or more phone numbers. Every decision is audited.'
                )}
              </p>
            </div>
            <div className="divide-y divide-outline-variant/40">
              {conflicts.map((c) => (
                <div key={c.id} className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.severity === 'high' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                        <span className="material-symbols-outlined text-[18px]">sync_problem</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] text-on-surface-variant">{c.id}</span>
                          <Badge tone={c.status === 'resolved' ? 'active' : c.status === 'processing' ? 'purple' : 'danger'}>
                            {c.status === 'resolved' ? t('Đã xử lý', 'Resolved') : c.status === 'processing' ? t('Đang xử lý', 'Processing') : t('Chờ MKT xử lý', 'Pending')}
                          </Badge>
                          <span className="font-label-sm text-[10px] text-red-600 font-semibold">{c.sla}</span>
                        </div>
                        <div className="font-headline-sm text-[13px] font-semibold text-on-surface mt-1">{c.reason}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {c.keys?.map((k) => (
                            <span key={k} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">{k}</span>
                          ))}
                          <span className="font-body-sm text-[10px] text-outline">·</span>
                          {c.profiles?.map((p) => <Badge key={p} tone="neutral">{p}</Badge>)}
                        </div>
                        <div className="font-body-sm text-[11px] text-on-surface-variant mt-1.5">
                          {t('Hồ sơ ứng viên', 'Candidate records')}: {(c.candidates || []).join(' · ')}
                        </div>
                        <div className="font-label-sm text-[10px] text-outline mt-0.5">{c.createdAt}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap lg:justify-end">
                      <Button size="sm" variant="primary" disabled={c.status === 'resolved'} onClick={() => setConflictAction({ conflict: c, action: 'merge' })}>
                        {t('Hợp nhất', 'Merge')}
                      </Button>
                      <Button size="sm" variant="secondary" disabled={c.status === 'resolved'} onClick={() => setConflictAction({ conflict: c, action: 'keep' })}>
                        {t('Giữ độc lập', 'Keep separate')}
                      </Button>
                      <Button size="sm" variant="secondary" disabled={c.status === 'resolved'} onClick={() => setConflictAction({ conflict: c, action: 'move' })}>
                        {t('Chuyển khóa', 'Move key')}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={c.status === 'resolved'} onClick={() => setConflictAction({ conflict: c, action: 'insufficient' })}>
                        {t('Chưa đủ thông tin', 'Insufficient')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'clusters' && (
          <div>
            <Toolbar>
              <p className="font-body-sm text-[11px] text-on-surface-variant">
                {t(
                  'IP chỉ dùng để gom cụm và dự đoán công ty — không tự động hợp nhất cá nhân.',
                  'IP is used only for clustering and company prediction — never to auto-merge people.'
                )}
              </p>
            </Toolbar>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-container-low">
                  <tr>
                    <Th>{t('Cụm IP', 'IP Cluster')}</Th>
                    <Th className="text-center">{t('Session', 'Sessions')}</Th>
                    <Th className="text-center">{t('Hồ sơ', 'Profiles')}</Th>
                    <Th>{t('Công ty liên quan', 'Related companies')}</Th>
                    <Th>{t('Công ty dự đoán', 'Predicted company')}</Th>
                    <Th>{t('Độ tin cậy', 'Confidence')}</Th>
                    <Th className="text-right">{t('Thao tác', 'Actions')}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {clusters.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-container-low">
                      <Td>
                        <div className="font-mono text-[11px] font-semibold text-on-surface">{c.ip}</div>
                        <div className="font-label-sm text-[9px] text-outline">{c.id} · {c.lastSeen}</div>
                      </Td>
                      <Td className="text-center num">{c.sessions}</Td>
                      <Td className="text-center num">{c.profiles} <span className="text-[10px] text-on-surface-variant">({c.identified} {t('định danh', 'identified')})</span></Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {c.companies?.map((x) => <Badge key={x} tone="neutral">{x}</Badge>)}
                        </div>
                      </Td>
                      <Td className="font-medium">{c.suggestion}</Td>
                      <Td>
                        <Badge tone={c.confidence === 'high' ? 'active' : c.confidence === 'medium' ? 'warm' : 'danger'}>
                          {c.confidence === 'high' ? t('Cao', 'High') : c.confidence === 'medium' ? t('Trung bình', 'Medium') : t('Thấp', 'Low')}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        {c.status === 'confirmed' ? (
                          <Badge tone="active">{t('Đã xác nhận', 'Confirmed')}</Badge>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" onClick={() => setClusterStatus(c, 'confirmed')}>{t('Xác nhận', 'Confirm')}</Button>
                            <Button size="sm" variant="secondary" onClick={() => setClusterStatus(c, 'rejected')}>{t('Từ chối', 'Reject')}</Button>
                          </div>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'sites' && (
          <div>
            <Toolbar>
              <p className="font-body-sm text-[11px] text-on-surface-variant">
                {t('Mỗi domain có Site ID và Tracking Key riêng; event luôn truy ngược về website phát sinh.', 'Each domain has its own Site ID and Tracking Key; every event traces back to its source site.')}
              </p>
              <Button className="ml-auto" size="sm" onClick={() => setShowSiteModal(true)}>
                <span className="material-symbols-outlined text-[16px]">add</span>
                {t('Thêm Site', 'Add site')}
              </Button>
            </Toolbar>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-container-low">
                  <tr>
                    <Th>{t('Site', 'Site')}</Th>
                    <Th>Site ID</Th>
                    <Th>Tracking Key</Th>
                    <Th>{t('Trạng thái', 'Status')}</Th>
                    <Th className="text-center">{t('Event', 'Events')}</Th>
                    <Th>{t('Event cuối', 'Last event')}</Th>
                    <Th className="text-right">{t('Thao tác', 'Actions')}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {sites.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-container-low">
                      <Td>
                        <div className="font-medium text-on-surface">{s.name}</div>
                        <div className="font-mono text-[10px] text-on-surface-variant">{s.domain}</div>
                      </Td>
                      <Td><span className="font-mono text-[11px]">{s.siteId}</span></Td>
                      <Td><span className="font-mono text-[10px] text-on-surface-variant">{mask(s.trackingKey)}</span></Td>
                      <Td>
                        <Badge tone={s.status === 'active' ? 'active' : 'neutral'}>
                          {s.status === 'active' ? t('Hoạt động', 'Active') : t('Vô hiệu hóa', 'Inactive')}
                        </Badge>
                      </Td>
                      <Td className="text-center num">{fmt(s.events)}</Td>
                      <Td className="text-[11px] text-on-surface-variant">{s.lastEvent}</Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(`<script async src="https://cdn.mkthub.vn/t.js?site=${s.siteId}&key=${s.trackingKey}"></script>`); notify(t('Đã copy Tracking Script.', 'Tracking script copied.')); } catch (err) { notify({ error: true, message: err.message }); } }}>
                            {t('Copy script', 'Copy script')}
                          </Button>
                          <Button size="sm" variant={s.status === 'active' ? 'secondary' : 'primary'} onClick={() => toggleSite(s)}>
                            {s.status === 'active' ? t('Tạm dừng', 'Disable') : t('Kích hoạt', 'Enable')}
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4">
              <div className="rounded-lg bg-slate-900 text-slate-100 p-3 font-mono text-[10px] overflow-x-auto">
                {`<script async src="https://cdn.mkthub.vn/t.js?site=st_9f2a71&key=tk_live_***"></script>`}
              </div>
              <p className="font-body-sm text-[10px] text-on-surface-variant mt-1.5">
                {t('Script tải bất đồng bộ; lỗi tracking không được chặn nội dung hoặc form chính của website.', 'Script loads asynchronously; tracking failures must never block website content or primary forms.')}
              </p>
            </div>
          </div>
        )}

        {tab === 'audit' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container-low">
                <tr>
                  <Th>ID</Th>
                  <Th>{t('Người thực hiện', 'Actor')}</Th>
                  <Th>{t('Hành động', 'Action')}</Th>
                  <Th>{t('Đối tượng', 'Target')}</Th>
                  <Th>{t('Trước', 'Before')}</Th>
                  <Th>{t('Sau', 'After')}</Th>
                  <Th>{t('Thời gian', 'Time')}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {auditTrail.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-container-low">
                    <Td><span className="font-mono text-[10px] text-on-surface-variant">{a.id}</span></Td>
                    <Td>{a.actor}</Td>
                    <Td><Badge tone="info">{a.action}</Badge></Td>
                    <Td className="text-[11px]">{a.target}</Td>
                    <Td className="text-[10px] text-on-surface-variant">{a.before}</Td>
                    <Td className="text-[10px] text-on-surface-variant">{a.after}</Td>
                    <Td className="text-[10px] text-outline whitespace-nowrap">{a.time || a.createdAt}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!auditTrail.length && <EmptyState message={t('Chưa có bản ghi audit.', 'No audit records yet.')} />}
          </div>
        )}
      </Card>

      {convertTarget && (
        <Modal
          title={t('Chuyển hồ sơ ẩn danh thành Lead', 'Convert anonymous profile to Lead')}
          subtitle={`${convertTarget?.displayId || convertTarget?.id || ''} · ${(convertTarget?.cookie || '').slice(0, 8)}***`}
          onClose={() => setConvertTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConvertTarget(null)}>{t('Hủy', 'Cancel')}</Button>
              <Button onClick={confirmConvert}>{t('Xác nhận & chuyển', 'Confirm & convert')}</Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="rounded-lg bg-surface-container-low p-2.5 font-body-sm text-[11px] text-on-surface-variant">
              {t(
                'Chỉ số điện thoại hợp lệ về định dạng mới đủ điều kiện tự động định danh. Toàn bộ hành vi, session, nguồn và khóa kỹ thuật sẽ chuyển sang Lead; Anonymous ID được giữ để audit.',
                'Only a valid phone number triggers identification. All behavior, sessions, sources and technical keys move to the Lead; the Anonymous ID is retained for audit.'
              )}
            </div>
            <Field label={t('Số điện thoại *', 'Phone number *')} hint={t('Ví dụ: 0901234567 hoặc +84901234567', 'Example: 0901234567 or +84901234567')}>
              <Input value={convertPhone} onChange={(e) => setConvertPhone(e.target.value)} placeholder="0901234567" />
            </Field>
            <Field label={t('Tên khách hàng', 'Customer name')}>
              <Input value={convertName} onChange={(e) => setConvertName(e.target.value)} placeholder={t('Nguyễn Văn An', 'Nguyen Van An')} />
            </Field>
            <Field label={t('Công ty', 'Company')}>
              <Input value={convertCompany} onChange={(e) => setConvertCompany(e.target.value)} placeholder={convertTarget.company || '—'} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-surface-container-low">
                <div className="font-label-sm text-[9px] uppercase text-on-surface-variant">{t('Điểm tạm tính', 'Provisional score')}</div>
                <div className="text-lg font-bold num">{convertTarget.score}</div>
              </div>
              <div className="p-2 rounded-lg bg-surface-container-low">
                <div className="font-label-sm text-[9px] uppercase text-on-surface-variant">{t('Phiên', 'Sessions')}</div>
                <div className="text-lg font-bold num">{convertTarget.sessions}</div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {conflictAction && (
        <Modal
          title={t('Xử lý xung đột định danh', 'Resolve identity conflict')}
          subtitle={`${conflictAction.conflict.id} · ${conflictAction.conflict.reason}`}
          onClose={() => setConflictAction(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConflictAction(null)}>{t('Hủy', 'Cancel')}</Button>
              <Button onClick={() => handleConflict(conflictAction.conflict, conflictAction.action)}>
                {t('Xác nhận', 'Confirm')}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="rounded-lg bg-surface-container-low p-2.5 font-body-sm text-[11px] text-on-surface-variant">
              {conflictAction.action === 'merge' && t('Chọn Contact chính để chuyển khóa cùng hành vi được duyệt. Hồ sơ phụ được đánh dấu đã hợp nhất và có thể hoàn tác.', 'Select the primary Contact to receive approved keys and behavior. The secondary record is marked merged and can be undone.')}
              {conflictAction.action === 'keep' && t('Các hồ sơ tiếp tục tồn tại riêng; khóa tranh chấp sẽ không được dùng để tự động merge sau này.', 'Records stay separate; the disputed key can never be auto-merged later.')}
              {conflictAction.action === 'move' && t('Chỉ chuyển Cookie / Device được chọn cùng hành vi thuộc phạm vi đó; các liên kết còn lại giữ nguyên.', 'Only the selected Cookie / Device and its scoped behavior move; other links remain unchanged.')}
              {conflictAction.action === 'insufficient' && t('Xung đột tiếp tục ở hàng chờ và lưu ghi chú cùng thời điểm xem xét gần nhất.', 'The conflict stays in queue with a note and the latest review time.')}
            </div>
            {conflictAction.action === 'merge' && (
              <Field label={t('Hồ sơ chính', 'Primary record')}>
                <Select
                  value={conflictAction.conflict.profiles[0]}
                  onChange={(v) => setConflictAction((prev) => ({ ...prev, primary: v }))}
                  options={conflictAction.conflict.profiles.map((p) => ({ value: p, label: p }))}
                  className="w-full"
                />
              </Field>
            )}
            <Field label={t('Lý do / Ghi chú', 'Reason / Note')} hint={t('Bắt buộc khi hoàn tác hoặc chưa đủ thông tin.', 'Required for undo or insufficient-information decisions.')}>
              <Textarea rows={3} value={conflictNote} onChange={(e) => setConflictNote(e.target.value)} placeholder={t('Nhập lý do xử lý…', 'Enter decision reason…')} />
            </Field>
            <div className="rounded-lg border border-outline-variant/60 p-2.5">
              <div className="font-label-sm text-[9px] uppercase tracking-wider text-on-surface-variant mb-1">{t('Audit sẽ ghi nhận', 'Audit will capture')}</div>
              <div className="font-body-sm text-[11px] text-on-surface">
                {t('Người thực hiện · Thời gian · Lý do · Dữ liệu trước/sau. Audit không thể bị chỉnh sửa bởi người dùng nghiệp vụ.', 'Actor · timestamp · reason · before/after data. Audit cannot be edited by business users.')}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showSiteModal && (
        <Modal
          title={t('Tạo Site & Tracking Key', 'Create Site & Tracking Key')}
          subtitle={t('Hệ thống cấp Site ID và Tracking Key riêng cho từng domain.', 'A unique Site ID and Tracking Key is issued per domain.')}
          onClose={() => setShowSiteModal(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowSiteModal(false)}>{t('Hủy', 'Cancel')}</Button>
              <Button onClick={addSite} disabled={!newSite.name.trim() || !newSite.domain.trim()}>{t('Tạo Site', 'Create site')}</Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label={t('Tên Site *', 'Site name *')}>
              <Input value={newSite.name} onChange={(e) => setNewSite((s) => ({ ...s, name: e.target.value }))} placeholder="Smartlog Website" />
            </Field>
            <Field label={t('Domain *', 'Domain *')} hint={t('Ví dụ: mkt.smartlog.vn', 'Example: mkt.smartlog.vn')}>
              <Input value={newSite.domain} onChange={(e) => setNewSite((s) => ({ ...s, domain: e.target.value }))} placeholder="mkt.smartlog.vn" />
            </Field>
          </div>
        </Modal>
      )}

      <Toast toast={toast} />
    </div>
  );
}
