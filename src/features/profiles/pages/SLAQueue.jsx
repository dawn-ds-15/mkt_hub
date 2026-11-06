import LoadState from '@/features/profiles/components/LoadState';
import { downloadCsv } from '@/features/profiles/utils/profileExport';
import { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '@/shared/stores/DashboardContext';
import { marketingOwners } from '@/shared/mocks/profiles';
import { getSlaQueue, claimSlaQueueItem, resolveSlaQueueItem, skipSlaQueueItem, exportSlaQueue } from '@/shared/api/httpClient';
import { normalizeSlaItem } from '@/features/profiles/utils/normalizeProfiles';
import {
  Card, SectionTitle, Badge, KpiCard, Toolbar, SearchInput, Select, Button, TabBar,
  Toast, EmptyState,
} from '@/features/profiles/components/ui';

const GROUPS = {
  'identity-conflict': { label: 'Xung đột định danh', tone: 'danger' },
  'missing-data': { label: 'Thiếu dữ liệu', tone: 'warm' },
  duplicate: { label: 'Nghi ngờ trùng', tone: 'danger' },
  unassigned: { label: 'Chưa phân công', tone: 'purple' },
  'form-mapping': { label: 'Mapping công ty', tone: 'info' },
  'invalid-phone': { label: 'SĐT không hợp lệ', tone: 'warm' },
  'journey-merge': { label: 'Chưa ghép hành trình', tone: 'info' },
  'import-error': { label: 'Lỗi import', tone: 'neutral' },
};

const statusOptions = [
  { value: 'all', label: 'Trạng thái: Tất cả' },
  { value: 'new', label: 'Mới' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'done', label: 'Đã xử lý' },
  { value: 'skipped', label: 'Đã bỏ qua' },
];

const groupOptions = [
  { value: 'all', label: 'Nhóm: Tất cả' },
  ...Object.entries(GROUPS).map(([value, g]) => ({ value, label: g.label })),
];

export default function SLAQueue() {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);

  const [items, setItems] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [group, setGroup] = useState('all');
  const [toast, setToast] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const res = await getSlaQueue();
        if (cancelled) return;
        const data = res?.data || {};
        if (Array.isArray(data.items)) setItems(data.items.map(normalizeSlaItem));
        else if (Array.isArray(data)) setItems(data.map(normalizeSlaItem));
        if (data.stats) setStats(data.stats);
      } catch (err) {
        if (!cancelled) setLoadError(err.response?.data?.message || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  const setItemStatus = async (item, nextStatus, message) => {
    try {
      if (nextStatus === 'processing') await claimSlaQueueItem(item.id);
      else if (nextStatus === 'done') await resolveSlaQueueItem(item.id, { note: message, resolution: 'done' });
      else if (nextStatus === 'skipped') await skipSlaQueueItem(item.id, { reason: message });
    } catch (err) {
      notify({ error: true, message: err.response?.data?.message || err.message });
      return;
    }
    setItems((prev) =>
      prev.map((q) =>
        q.id === item.id
          ? {
              ...q,
              status: nextStatus,
              owner: nextStatus === 'processing' ? q.owner || t('Bạn', 'You') : q.owner,
            }
          : q
      )
    );
    setStats(null);
    notify(message);
  };

  const filtered = useMemo(() => {
    return items.filter((q) => {
      if (tab === 'unresolved' && !['new', 'processing'].includes(q.status)) return false;
      if (tab !== 'all' && tab !== 'unresolved' && q.status !== tab) return false;
      if (status !== 'all' && q.status !== status) return false;
      if (group !== 'all' && q.group !== group) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = [q.id, q.title, q.description, q.lead, q.owner || ''].join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, tab, status, group, search]);

  const overdue = items.filter((q) => q?.overdue && ['new', 'processing'].includes(q?.status)).length;
  const dueSoon = items.filter((q) => !q?.overdue && String(q?.sla || '').includes('Còn') && ['new', 'processing'].includes(q?.status)).length;
  const total = items.length;
  const processing = items.filter((q) => q.status === 'processing').length;
  const done = items.filter((q) => q.status === 'done').length;

  const tabItems = [
    { key: 'all', label: t('Tất cả', 'All'), count: total },
    { key: 'new', label: t('Mới', 'New'), count: items.filter((q) => q.status === 'new').length },
    { key: 'processing', label: t('Đang xử lý', 'Processing'), count: processing },
    { key: 'skipped', label: t('Đã bỏ qua', 'Skipped'), count: items.filter((q) => q.status === 'skipped').length },
    { key: 'unresolved', label: t('Chưa xử lý', 'Unresolved'), count: items.filter((q) => ['new', 'processing'].includes(q.status)).length },
    { key: 'done', label: t('Đã xử lý', 'Done'), count: done },
  ];

  if (loading || loadError) return <LoadState loading={loading} error={loadError} onRetry={() => setReload((n) => n + 1)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-[22px]">pending_actions</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-headline-md text-[20px] font-bold text-on-surface tracking-tight">
                {t('Hàng chờ SLA', 'SLA Queue')}
              </h1>
              <Badge tone="brand">BDD-02 · BDD-03</Badge>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-label-sm text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {t('Theo dõi SLA', 'SLA monitored')}
              </span>
            </div>
            <p className="font-body-sm text-[12px] text-on-surface-variant mt-0.5">
              {t(
                'Dữ liệu cần xử lý · Xung đột định danh · Nghi ngờ trùng · Thiếu dữ liệu.',
                'Data to process · Identity conflicts · Suspected duplicates · Missing data.'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const res = await exportSlaQueue({ status: status !== 'all' ? status : ['new', 'processing', 'done', 'skipped'].includes(tab) ? tab : undefined, group: group !== 'all' ? group : undefined, search: search || undefined });
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = 'sla-queue.csv';
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                notify({ error: true, message: err.response?.data?.message || err.message });
                return;
              }
              notify(t('Đã xuất danh sách hàng chờ.', 'Queue exported.'));
            }}
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            {t('Xuất', 'Export')}
          </Button>
          <Button variant="danger" onClick={() => { setStatus('all'); setTab('unresolved'); }}>
            <span className="material-symbols-outlined text-[16px]">warning</span>
            {t('Chưa xử lý', 'Unresolved')} ({items.filter((q) => ['new', 'processing'].includes(q.status)).length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <KpiCard label={t('Quá hạn', 'Overdue')} value={String(stats?.overdue ?? overdue)} tone="danger" sub={t('Cần xử lý ngay', 'Needs immediate action')} icon={() => <span className="material-symbols-outlined text-[18px]">alarm</span>} />
        <KpiCard label={t('Sắp hết hạn', 'Due soon')} value={String(stats?.dueSoon ?? dueSoon)} sub={t('Trong 48 giờ tới', 'Within 48 hours')} icon={() => <span className="material-symbols-outlined text-[18px]">schedule</span>} />
        <KpiCard label={t('Đang xử lý', 'Processing')} value={String(stats?.processing ?? processing)} sub={t('Đã có người nhận', 'Claimed items')} icon={() => <span className="material-symbols-outlined text-[18px]">autorenew</span>} />
        <KpiCard label={t('Tổng hàng chờ', 'Total queue')} value={String(stats?.total ?? total)} sub={`${stats?.done ?? done} ${t('đã xử lý', 'resolved')}`} progress={((stats?.done ?? done) / ((stats?.total ?? total) || 1)) * 100} icon={() => <span className="material-symbols-outlined text-[18px]">inventory</span>} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className="xl:col-span-8 overflow-hidden">
          <TabBar tabs={tabItems} active={tab} onChange={setTab} />
          <Toolbar>
            <div className="flex-1 min-w-[220px]">
              <SearchInput value={search} onChange={setSearch} placeholder={t('Tìm ID, nội dung, đối tượng…', 'Search ID, item, record…')} />
            </div>
            <Select value={group} onChange={setGroup} options={groupOptions} />
            <Select value={status} onChange={setStatus} options={statusOptions} />
            <span className="ml-auto font-body-sm text-[11px] text-on-surface-variant">
              {t('Hiển thị', 'Showing')} <strong>{filtered.length}</strong> / {items.length}
            </span>
          </Toolbar>

          {filtered.length === 0 ? (
            <EmptyState message={t('Hàng chờ trống — mọi dữ liệu đã được xử lý.', 'Queue is empty — all items resolved.')} />
          ) : (
            <div className="divide-y divide-outline-variant/40">
              {filtered.map((item) => {
                const meta = GROUPS[item.group] || GROUPS['missing-data'] || { label: item.group || '', tone: 'neutral' };
                return (
                  <div key={item.id} className={`p-3 transition-colors ${item.status === 'done' ? 'opacity-60' : 'hover:bg-surface-container-low'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${item.overdue ? 'bg-red-100 text-red-600' : 'bg-surface-container-high text-on-surface-variant'}`}>
                          <span className="material-symbols-outlined text-[16px]">{item.overdue ? 'alarm' : 'pending_actions'}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className="font-mono text-[10px] text-on-surface-variant">{item.id}</span>
                            <Badge tone={meta.tone}>{t(meta.label, item.group)}</Badge>
                            {item.overdue && <Badge tone="danger" dot>{t('Quá hạn', 'Overdue')}</Badge>}
                            <Badge tone={item.status === 'done' ? 'active' : item.status === 'processing' ? 'purple' : 'info'}>
                              {item.status === 'done' ? t('Đã xử lý', 'Done') : item.status === 'processing' ? t('Đang xử lý', 'Processing') : item.status === 'skipped' ? t('Đã bỏ qua', 'Skipped') : t('Mới', 'New')}
                            </Badge>
                          </div>
                          <div className="font-headline-sm text-[12px] font-semibold text-on-surface">{item.title}</div>
                          <div className="font-body-sm text-[11px] text-on-surface-variant max-w-[420px]">{item.description}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap font-label-sm text-[9px] text-outline">
                            <span className="font-mono">{item.lead}</span>
                            <span>·</span>
                            <span>{item.createdAt}</span>
                            <span>·</span>
                            <span>{item.owner || t('Chưa nhận', 'Unassigned')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`flex items-center justify-end gap-1 font-label-md text-[10px] font-semibold mb-1.5 ${item.overdue ? 'text-red-600' : 'text-on-surface-variant'}`}>
                          <span className="material-symbols-outlined text-[13px]">timer</span>
                          {item.sla}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          {item.status === 'new' && (
                            <Button size="sm" variant="secondary" onClick={() => setItemStatus(item, 'processing', t('Đã nhận xử lý và gán người phụ trách.', 'Item claimed and assigned.'))}>
                              {t('Nhận', 'Claim')}
                            </Button>
                          )}
                          <Button size="sm" variant="success" disabled={['done', 'skipped'].includes(item.status)} onClick={() => setItemStatus(item, 'done', t('Đã đánh dấu xử lý xong.', 'Marked as resolved.'))}>
                            {t('Xong', 'Resolve')}
                          </Button>
                          <Button size="sm" variant="ghost" disabled={['done', 'skipped'].includes(item.status)} onClick={() => setItemStatus(item, 'skipped', t('Đã bỏ qua với lý do.', 'Skipped with reason.'))}>
                            {t('Bỏ qua', 'Skip')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="xl:col-span-4 overflow-hidden">
          <SectionTitle
            title={t('Quy tắc SLA', 'SLA policy')}
            subtitle={t('Áp dụng cho toàn bộ hàng chờ', 'Applies to the whole queue')}
            right={<Badge tone="info">{t('Tự động', 'Automatic')}</Badge>}
          />
          <div className="p-4 space-y-3">
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-red-600 mt-0.5">priority_high</span>
                <div>
                  <div className="font-body-sm text-[12px] font-semibold text-on-surface">{t('Xung đột / nghi ngờ trùng', 'Conflict / duplicate')}</div>
                  <div className="font-body-sm text-[11px] text-on-surface-variant">{t('SLA 24 giờ kể từ khi phát sinh.', 'SLA 24 hours from creation.')}</div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-amber-600 mt-0.5">hourglass_top</span>
                <div>
                  <div className="font-body-sm text-[12px] font-semibold text-on-surface">{t('Thiếu dữ liệu', 'Missing data')}</div>
                  <div className="font-body-sm text-[11px] text-on-surface-variant">{t('SLA 48 giờ để bổ sung và xác nhận.', 'SLA 48 hours to enrich and confirm.')}</div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-secondary mt-0.5">assignment_ind</span>
                <div>
                  <div className="font-body-sm text-[12px] font-semibold text-on-surface">{t('Phân công', 'Assignment')}</div>
                  <div className="font-body-sm text-[11px] text-on-surface-variant">{t('Tự động gán Marketing Owner theo quy tắc; người nhận có thể đổi.', 'Auto-assign marketing owner by rules; assignee can be changed.')}</div>
                </div>
              </li>
            </ul>
            <div className="rounded-lg border border-outline-variant/60 bg-surface-container-low/60 p-3">
              <div className="font-label-md text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-1">
                {t('Marketing Owner sẵn sàng', 'Available marketing owners')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {marketingOwners.map((o) => (
                  <Badge key={o} tone="neutral" dot>{o}</Badge>
                ))}
              </div>
            </div>
            <p className="font-body-sm text-[10px] text-on-surface-variant">
              {t(
                'Cảnh báo quá hạn được gửi cho Marketing Owner và quản lý trực tiếp mỗi 4 giờ.',
                'Overdue alerts are sent to the marketing owner and line manager every 4 hours.'
              )}
            </p>
          </div>
        </Card>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
