import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, CalendarRange, ChevronDown, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight,
  FolderKanban, Layers, Rocket, TriangleAlert, Wallet, CheckCircle2, Timer, Megaphone,
  CalendarDays, X,
} from 'lucide-react';
import { getProjects } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { useDropdownOptions } from '../../hooks/useDropdownOptions';

const UNCATEGORIZED = '__uncategorized__';
const GROUP_PAGE_SIZE = 8;

const ACCENTS = [
  'text-secondary',
  'text-tertiary-container',
  'text-success',
  'text-warning',
  'text-chart-purple',
  'text-chart-orange',
  'text-primary',
  'text-danger',
];

function compact(n) {
  n = Number(n) || 0;
  if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function getInitials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

// Ngày dùng để lọc theo thời gian: ưu tiên hạn chót, không có thì lấy ngày tạo.
function timelineDate(p) {
  const raw = p.deadlineRaw || p.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function rangeOf(key, custom) {
  const now = new Date();
  const y = now.getFullYear();
  if (key === 'month') {
    const m = now.getMonth();
    return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0, 23, 59, 59, 999) };
  }
  if (key === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return { from: new Date(y, q * 3, 1), to: new Date(y, q * 3 + 3, 0, 23, 59, 59, 999) };
  }
  if (key === 'year') {
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59, 999) };
  }
  if (key === 'custom') {
    const from = custom.from ? new Date(`${custom.from}T00:00:00`) : null;
    const to = custom.to ? new Date(`${custom.to}T23:59:59.999`) : null;
    return {
      from: from && !isNaN(from.getTime()) ? from : null,
      to: to && !isNaN(to.getTime()) ? to : null,
    };
  }
  return { from: null, to: null };
}

export default function ProjectGroupOverview({ onOpenFullList }) {
  const { locale } = useDashboard();
  const navigate = useNavigate();
  const vi = locale === 'vi';
  const typeDropdown = useDropdownOptions('project_type');

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodKey, setPeriodKey] = useState('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [openGroup, setOpenGroup] = useState(null);
  const [groupPage, setGroupPage] = useState(1);

  useEffect(() => {
    getProjects()
      .then((res) => {
        setProjects(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
      })
      .catch((e) => {
        console.error('[ProjectGroupOverview] getProjects:', e);
        setLoading(false);
      });
  }, []);

  const inPeriod = useMemo(() => {
    const { from, to } = rangeOf(periodKey, custom);
    if (!from && !to) return projects;
    return projects.filter((p) => {
      const d = timelineDate(p);
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [projects, periodKey, custom]);

  // Nhóm theo loại dự án; thứ tự ưu tiên theo cấu hình dropdown project_type.
  const groups = useMemo(() => {
    const order = new Map();
    typeDropdown.forEach((o, i) => {
      const label = String(o.label || '').trim();
      if (label) order.set(label.toLowerCase(), i);
    });
    const byKey = new Map();
    inPeriod.forEach((p) => {
      const label = String(p.type || '').trim();
      const key = label ? label.toLowerCase() : UNCATEGORIZED;
      if (!byKey.has(key)) {
        byKey.set(key, { key, label: label || (vi ? 'Chưa phân loại' : 'Uncategorized'), items: [] });
      }
      byKey.get(key).items.push(p);
    });
    return [...byKey.values()]
      .map((g) => {
        const total = g.items.length;
        const active = g.items.filter((p) => p.statusLabel === 'Active').length;
        const completed = g.items.filter((p) => p.statusLabel === 'Completed').length;
        const delayed = g.items.filter((p) => p.status === 'near_deadline' || p.status === 'overdue').length;
        const budget = g.items.reduce((s, p) => s + (p.budgetPlanDirect || 0) + (p.budgetPlanOverhead || 0), 0);
        const actual = g.items.reduce((s, p) => s + (p.actualCostDirect || 0) + (p.actualCostOverhead || 0), 0);
        const avgProgress = total ? Math.round(g.items.reduce((s, p) => s + (p.progress || 0), 0) / total) : 0;
        return { ...g, total, active, completed, delayed, budget, actual, avgProgress };
      })
      .sort((a, b) => {
        if (a.key === UNCATEGORIZED) return 1;
        if (b.key === UNCATEGORIZED) return -1;
        const oa = order.has(a.key) ? order.get(a.key) : 999;
        const ob = order.has(b.key) ? order.get(b.key) : 999;
        if (oa !== ob) return oa - ob;
        return b.total - a.total;
      });
  }, [inPeriod, typeDropdown, vi]);

  const totals = useMemo(() => {
    const total = inPeriod.length;
    const active = inPeriod.filter((p) => p.statusLabel === 'Active').length;
    const delayed = inPeriod.filter((p) => p.status === 'near_deadline' || p.status === 'overdue').length;
    return { total, active, delayed, groups: groups.length };
  }, [inPeriod, groups]);

  const activeGroup = openGroup ? groups.find((g) => g.key === openGroup) : null;

  useEffect(() => {
    setGroupPage(1);
  }, [openGroup, periodKey, custom.from, custom.to]);

  // Nhóm đang mở biến mất khỏi khoảng thời gian mới thì quay lại lưới nhóm.
  useEffect(() => {
    if (openGroup && !groups.some((g) => g.key === openGroup)) setOpenGroup(null);
  }, [groups, openGroup]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-on-surface-variant">
        <Loader2 className="w-9 h-9 text-outline-variant animate-spin" />
      </div>
    );
  }

  const periodLabel = {
    all: vi ? 'Tất cả thời gian' : 'All time',
    month: vi ? 'Tháng này' : 'This month',
    quarter: vi ? 'Quý này' : 'This quarter',
    year: vi ? 'Năm nay' : 'This year',
    custom: vi ? 'Tùy chọn' : 'Custom',
  };

  const groupItems = activeGroup ? activeGroup.items : [];
  const groupTotalPages = Math.max(1, Math.ceil(groupItems.length / GROUP_PAGE_SIZE));
  const safeGroupPage = Math.min(groupPage, groupTotalPages);
  const groupRows = groupItems.slice((safeGroupPage - 1) * GROUP_PAGE_SIZE, safeGroupPage * GROUP_PAGE_SIZE);

  const statCards = [
    { icon: Layers, tone: 'text-secondary', label: vi ? 'Nhóm dự án' : 'Groups', value: totals.groups },
    { icon: FolderKanban, tone: 'text-primary', label: vi ? 'Tổng dự án' : 'Total projects', value: totals.total },
    { icon: Rocket, tone: 'text-success', label: vi ? 'Đang chạy' : 'Active', value: totals.active },
    { icon: TriangleAlert, tone: 'text-warning', label: vi ? 'Chậm tiến độ' : 'Delayed', value: totals.delayed },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <h2 className="text-lg leading-[26px] font-bold text-on-surface">
            {vi ? 'Tổng quan theo nhóm dự án' : 'Overview by project group'}
          </h2>
          <p className="text-xs leading-[18px] text-on-surface-variant mt-1">
            {vi
              ? 'Dự án được gom theo loại dự án. Nhấn "Xem thêm" để mở danh sách của nhóm.'
              : 'Projects grouped by type. Click "View more" to open a group list.'}
          </p>
          <p className="text-[10px] leading-[14px] text-outline mt-1">
            {vi
              ? 'Lọc theo hạn chót dự án (dự án chưa có hạn chót dùng ngày tạo).'
              : 'Filtered by project deadline (projects without a deadline use their creation date).'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-on-surface-variant flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4" />
            {vi ? 'Thời gian:' : 'Period:'}
          </span>
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-8 py-1.5 bg-surface-container-lowest border border-border-light rounded-lg text-xs hover:bg-surface-container-high focus:outline-none focus:border-secondary cursor-pointer shadow-sm"
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
            >
              {['all', 'month', 'quarter', 'year', 'custom'].map((k) => (
                <option key={k} value={k}>{periodLabel[k]}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline w-4 h-4" />
          </div>
          {periodKey === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                className="px-2 py-1.5 bg-surface-container-lowest border border-border-light rounded-lg text-xs focus:outline-none focus:border-secondary"
              />
              <span className="text-outline text-xs">–</span>
              <input
                type="date"
                value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                className="px-2 py-1.5 bg-surface-container-lowest border border-border-light rounded-lg text-xs focus:outline-none focus:border-secondary"
              />
            </div>
          )}
          {periodKey !== 'all' && (
            <button
              onClick={() => { setPeriodKey('all'); setCustom({ from: '', to: '' }); }}
              className="text-error text-[12px] font-semibold flex items-center gap-1 hover:underline"
            >
              <X className="w-3.5 h-3.5" />
              {vi ? 'Xóa lọc' : 'Clear'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="bg-surface-container-lowest rounded-xl p-2.5 border border-border-light shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant text-[10px] leading-[14px] uppercase tracking-wider">{s.label}</span>
              <div className={`w-6 h-6 rounded-lg bg-surface-container flex items-center justify-center ${s.tone}`}>
                <s.icon className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-lg leading-[26px] font-bold text-on-surface mt-1">{s.value}</h3>
          </div>
        ))}
      </div>

      {!activeGroup && groups.length === 0 && (
        <div className="bg-surface-container-lowest rounded-xl border border-border-light py-12 text-center text-on-surface-variant text-xs">
          {vi ? 'Không có dự án nào trong khoảng thời gian đã chọn' : 'No projects in the selected period'}
        </div>
      )}

      {!activeGroup && groups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((g, i) => {
            const accent = ACCENTS[i % ACCENTS.length];
            const spent = g.budget > 0 ? Math.round((g.actual / g.budget) * 100) : 0;
            return (
              <div
                key={g.key}
                className="bg-surface-container-lowest rounded-xl border border-border-light p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow flex flex-col"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0 ${accent}`}>
                      <FolderKanban className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] leading-[18px] font-semibold text-on-surface truncate" title={g.label}>{g.label}</p>
                      <p className="text-[10px] leading-[14px] text-on-surface-variant">
                        {g.total} {vi ? 'dự án' : 'projects'}
                      </p>
                    </div>
                  </div>
                  <span className="text-lg leading-[26px] font-bold text-on-surface">{g.total}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="rounded-lg bg-background-subtle px-2 py-1.5">
                    <p className="text-[10px] leading-[14px] text-on-surface-variant">{vi ? 'Đang chạy' : 'Active'}</p>
                    <p className="text-xs font-semibold text-on-surface">{g.active}</p>
                  </div>
                  <div className="rounded-lg bg-background-subtle px-2 py-1.5">
                    <p className="text-[10px] leading-[14px] text-on-surface-variant">{vi ? 'Hoàn thành' : 'Done'}</p>
                    <p className="text-xs font-semibold text-on-surface">{g.completed}</p>
                  </div>
                  <div className="rounded-lg bg-background-subtle px-2 py-1.5">
                    <p className="text-[10px] leading-[14px] text-on-surface-variant">{vi ? 'Chậm' : 'Delayed'}</p>
                    <p className={`text-xs font-semibold ${g.delayed > 0 ? 'text-warning' : 'text-on-surface'}`}>{g.delayed}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-[10px] leading-[14px]">
                    <span className="text-on-surface-variant flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5" />{vi ? 'Ngân sách' : 'Budget'}
                    </span>
                    <span className="font-data-mono text-on-surface">
                      {compact(g.budget)} <span className="text-outline">VND</span>
                      {g.budget > 0 && (
                        <span className={`ml-1 ${spent > 100 ? 'text-danger' : 'text-on-surface-variant'}`}>({spent}%)</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] leading-[14px] mb-0.5">
                      <span className="text-on-surface-variant">{vi ? 'Tiến độ TB' : 'Avg progress'}</span>
                      <span className="font-medium text-on-surface">{g.avgProgress}%</span>
                    </div>
                    <div className="w-full bg-surface-container-high rounded-full h-1.5">
                      <div className="bg-secondary h-1.5 rounded-full" style={{ width: `${g.avgProgress}%` }} />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setOpenGroup(g.key)}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light bg-surface-container-lowest text-xs leading-[18px] font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  {vi ? 'Xem thêm' : 'View more'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {activeGroup && (
        <div className="bg-surface-container-lowest rounded-xl border border-border-light overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border-light bg-background-subtle">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setOpenGroup(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-border-light bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                title={vi ? 'Quay lại các nhóm' : 'Back to groups'}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <p className="text-[13px] leading-[18px] font-semibold text-on-surface truncate">{activeGroup.label}</p>
                <p className="text-[10px] leading-[14px] text-on-surface-variant">
                  {activeGroup.total} {vi ? 'dự án' : 'projects'} · {vi ? 'Tiến độ TB' : 'Avg'} {activeGroup.avgProgress}%
                </p>
              </div>
            </div>
            {onOpenFullList && (
              <button
                onClick={() => onOpenFullList(activeGroup.key === UNCATEGORIZED ? 'All' : activeGroup.label)}
                className="px-3 py-1.5 rounded-lg border border-border-light bg-surface-container-lowest text-xs leading-[18px] font-medium text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                {vi ? 'Mở danh sách đầy đủ' : 'Open full list'}
              </button>
            )}
          </div>

          <ul className="divide-y divide-border-light">
            {groupRows.map((p) => {
              const delayed = p.status === 'near_deadline' || p.status === 'overdue' || p.statusLabel === 'On Hold';
              return (
                <li
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-surface-bright transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0">
                    {delayed ? <Timer className="w-4 h-4 text-warning" /> : <Megaphone className="w-4 h-4 text-secondary" />}
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-[13px] leading-[18px] font-semibold text-on-surface group-hover:text-secondary transition-colors">{p.name}</p>
                    <span className="text-on-surface-variant text-[10px] flex items-center gap-1 mt-0.5">
                      <CalendarDays className="w-3.5 h-3.5" />{p.deadline}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 w-[150px]">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center border border-border-light">
                      {getInitials(p.owner)}
                    </div>
                    <span className="text-xs text-on-surface truncate">{p.owner}</span>
                  </div>
                  <div className="w-[140px]">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium text-xs text-on-surface">{p.progress}%</span>
                      <span className={`text-[10px] ${delayed ? 'text-warning' : 'text-on-surface-variant'}`}>
                        {delayed ? (vi ? 'Chậm' : 'Delayed') : (vi ? 'Đúng tiến độ' : 'On track')}
                      </span>
                    </div>
                    <div className="w-full bg-surface-container-high rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${delayed ? 'bg-warning' : 'bg-secondary'}`} style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>
                  <div className="w-5 text-center">
                    {(p.documentsCount || 0) > 0 && <CheckCircle2 className="w-4 h-4 text-success" />}
                  </div>
                </li>
              );
            })}
          </ul>

          {groupTotalPages > 1 && (
            <div className="border-t border-border-light p-3 flex items-center justify-between bg-background-subtle">
              <span className="text-xs leading-[18px] text-on-surface-variant">
                {vi
                  ? `Hiển thị ${(safeGroupPage - 1) * GROUP_PAGE_SIZE + 1}-${Math.min(safeGroupPage * GROUP_PAGE_SIZE, groupItems.length)} trong số ${groupItems.length} dự án`
                  : `Showing ${(safeGroupPage - 1) * GROUP_PAGE_SIZE + 1}-${Math.min(safeGroupPage * GROUP_PAGE_SIZE, groupItems.length)} of ${groupItems.length} projects`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={safeGroupPage === 1}
                  onClick={() => setGroupPage(safeGroupPage - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded border border-border-light bg-surface-container-lowest text-outline hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-on-surface px-1">{safeGroupPage}/{groupTotalPages}</span>
                <button
                  disabled={safeGroupPage === groupTotalPages}
                  onClick={() => setGroupPage(safeGroupPage + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded border border-border-light bg-surface-container-lowest text-outline hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
