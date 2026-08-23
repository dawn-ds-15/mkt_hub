import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects, deleteProject } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import CreateProjectForm from './CreateProjectForm';

function getInitials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

function compact(n) {
  n = Number(n) || 0;
  if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function fullNum(n) {
  return (Number(n) || 0).toLocaleString('vi-VN');
}

function codeOf(p) {
  const tail = String(p.id).replace(/[^a-z0-9]/gi, '').slice(0, 5).toUpperCase();
  return `PRJ-${tail || 'MKT'}`;
}

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái', value: 'All' },
  { label: 'Đang thực hiện', value: 'Active' },
  { label: 'Đã hoàn thành', value: 'Completed' },
  { label: 'Tạm dừng', value: 'On Hold' },
];

const TYPE_OPTIONS = ['Internal', 'Client', 'Research', 'Workshop', 'Event', 'Exhibition', 'Webinar'];

export default function ProjectListTable() {
  const { locale } = useDashboard();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showFilter, setShowFilter] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const loadProjects = () => {
    getProjects()
      .then((res) => {
        setProjects(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
      })
      .catch((e) => {
        console.error('[ProjectListTable] getProjects:', e);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    const pageIds = pageRows.map((p) => p.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
    setSelected((prev) => (allSelected ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]));
  };

  const selectedNames = projects.filter((p) => selected.includes(p.id)).map((p) => p.name);

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    const confirmMsg = locale === 'vi'
      ? `Xác nhận xóa ${selected.length} dự án đã chọn?`
      : `Delete ${selected.length} selected projects?`;
    if (!window.confirm(confirmMsg)) return;
    setDeleting(true);
    try {
      await Promise.all(selected.map((id) => deleteProject(id)));
      setSelected([]);
      loadProjects();
    } catch (e) {
      console.error('[ProjectListTable] bulk delete:', e);
      window.alert(locale === 'vi' ? 'Xóa dự án thất bại. Vui lòng thử lại.' : 'Failed to delete projects.');
    } finally {
      setDeleting(false);
    }
  };

  const summary = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.statusLabel === 'Active').length;
    const nearDeadline = projects.filter((p) => p.status === 'near_deadline' || p.status === 'overdue').length;
    const totalBudget = projects.reduce((s, p) => s + (p.budgetPlanDirect || 0) + (p.budgetPlanOverhead || 0), 0);
    const totalActual = projects.reduce((s, p) => s + (p.actualCostDirect || 0) + (p.actualCostOverhead || 0), 0);
    const allocated = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
    const avgProgress = total ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / total) : 0;
    return { total, active, nearDeadline, totalBudget, allocated, avgProgress };
  }, [projects]);

  const filtered = useMemo(() => {
    let result = [...projects];
    if (statusFilter !== 'All') result = result.filter((p) => p.statusLabel === statusFilter);
    if (typeFilter !== 'All') result = result.filter((p) => p.type === typeFilter);
    return result;
  }, [projects, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set([1, 2, totalPages - 1, totalPages, safePage - 1, safePage, safePage + 1]);
    return [...set].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  }, [totalPages, safePage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-on-surface-variant">
        <span className="material-symbols-outlined text-[40px] text-outline-variant animate-spin">sync</span>
      </div>
    );
  }

  const startRow = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-[24px] leading-[32px] font-bold text-on-surface">{locale === 'vi' ? 'Danh sách Dự án' : 'Project List'}</h2>
          <p className="text-[14px] leading-[20px] text-on-surface-variant mt-1">
            {locale === 'vi' ? 'Quản lý và theo dõi tiến độ các chiến dịch marketing' : 'Manage and track marketing campaign progress'}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg text-[14px] leading-[20px] font-semibold hover:bg-primary/90 transition-colors flex-1 sm:flex-none justify-center shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {locale === 'vi' ? 'Thêm dự án' : 'Add Project'}
          </button>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="flex items-center gap-1.5 px-4 py-2 bg-surface-container-lowest border border-border-light rounded-lg text-[14px] leading-[20px] hover:bg-surface-container-high transition-colors flex-1 sm:flex-none justify-center shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            {locale === 'vi' ? 'Bộ lọc' : 'Filter'}
          </button>
          <div className="relative flex-1 sm:flex-none">
            <select
              className="w-full appearance-none pl-4 pr-8 py-2 bg-surface-container-lowest border border-border-light rounded-lg text-[14px] leading-[20px] hover:bg-surface-container-high transition-colors focus:outline-none focus:border-secondary shadow-sm cursor-pointer"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{locale === 'vi' || o.label === 'Tất cả trạng thái' ? (o.value === 'All' ? o.label : o.label) : o.value}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-[20px]">expand_more</span>
          </div>
        </div>
      </div>

      {showFilter && (
        <div className="flex flex-wrap items-center gap-2 bg-surface-container-lowest border border-border-light rounded-lg p-3 shadow-sm">
          <span className="text-[12px] font-semibold text-on-surface-variant">{locale === 'vi' ? 'Loại dự án:' : 'Project type:'}</span>
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-8 py-1.5 bg-surface-container-lowest border border-border-light rounded-lg text-[14px] hover:bg-surface-container-high focus:outline-none focus:border-secondary cursor-pointer"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            >
              <option value="All">{locale === 'vi' ? 'Tất cả' : 'All'}</option>
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-[20px]">expand_more</span>
          </div>
          <button
            onClick={() => { setStatusFilter('All'); setTypeFilter('All'); setPage(1); }}
            className="text-error text-[12px] font-semibold flex items-center gap-1 hover:underline"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
            {locale === 'vi' ? 'Xóa lọc' : 'Clear'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-border-light shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <span className="text-on-surface-variant text-[12px] leading-[16px] uppercase tracking-wider">{locale === 'vi' ? 'Tổng ngân sách năm' : 'Yearly total budget'}</span>
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            </div>
          </div>
          <div>
            <h3 className="text-[20px] leading-[28px] font-bold text-on-surface">{compact(summary.totalBudget)} <span className="text-[14px] leading-[20px] text-outline font-normal">VND</span></h3>
            <div className="flex items-center gap-1 mt-1 text-[12px] leading-[16px] text-success">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span>{locale === 'vi' ? `Đã phân bổ ${summary.allocated}%` : `Allocated ${summary.allocated}%`}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-4 border border-border-light shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <span className="text-on-surface-variant text-[12px] leading-[16px] uppercase tracking-wider">{locale === 'vi' ? 'Dự án đang chạy' : 'Active projects'}</span>
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-tertiary-container">
              <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
            </div>
          </div>
          <div>
            <h3 className="text-[20px] leading-[28px] font-bold text-on-surface">{summary.active} <span className="text-[14px] leading-[20px] text-outline font-normal">{locale === 'vi' ? 'Chiến dịch' : 'Campaigns'}</span></h3>
            <div className="flex items-center gap-1 mt-1 text-[12px] leading-[16px] text-warning">
              <span className="material-symbols-outlined text-[14px]">error</span>
              <span>{summary.nearDeadline} {locale === 'vi' ? 'dự án chậm tiến độ' : 'projects delayed'}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-4 border border-border-light shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <span className="text-on-surface-variant text-[12px] leading-[16px] uppercase tracking-wider">{locale === 'vi' ? 'KPI Đạt được (TB)' : 'KPI Achieved (avg)'}</span>
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-success">
              <span className="material-symbols-outlined text-[18px]">pie_chart</span>
            </div>
          </div>
          <div>
            <h3 className="text-[20px] leading-[28px] font-bold text-on-surface">{summary.avgProgress}%</h3>
            <div className="w-full bg-surface-container-high rounded-full h-1.5 mt-2">
              <div className="bg-success h-1.5 rounded-full" style={{ width: `${summary.avgProgress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-primary text-[20px]">checklist</span>
            <span className="text-[14px] leading-[20px] font-semibold text-on-surface">
              {locale === 'vi' ? `Đã chọn ${selected.length} dự án` : `${selected.length} projects selected`}
            </span>
            <span className="text-[12px] leading-[16px] text-on-surface-variant truncate hidden md:inline">
              {selectedNames.slice(0, 2).join(', ')}{selectedNames.length > 2 ? ` +${selectedNames.length - 2}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected([])}
              className="px-3 py-1.5 rounded-lg border border-border-light bg-surface-container-lowest text-[13px] leading-[18px] font-medium text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              {locale === 'vi' ? 'Bỏ chọn' : 'Clear'}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="px-4 py-1.5 rounded-lg bg-danger text-on-error text-[13px] leading-[18px] font-semibold hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">{deleting ? 'sync' : 'delete'}</span>
              {deleting
                ? (locale === 'vi' ? 'Đang xóa...' : 'Deleting...')
                : (locale === 'vi' ? 'Xóa hàng loạt' : 'Delete selected')}
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-xl border border-border-light overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-background-subtle border-b border-border-light">
                <th className="py-2 px-4 w-[48px]">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-outline-variant/50 text-primary focus:ring-primary/40 cursor-pointer"
                    checked={pageRows.length > 0 && pageRows.every((p) => selected.includes(p.id))}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="py-2 px-4 text-[12px] leading-[16px] text-on-surface-variant font-medium whitespace-nowrap uppercase">{locale === 'vi' ? 'Dự án' : 'Project'}</th>
                <th className="py-2 px-4 text-[12px] leading-[16px] text-on-surface-variant font-medium whitespace-nowrap uppercase">Owner</th>
                <th className="py-2 px-4 text-[12px] leading-[16px] text-on-surface-variant font-medium whitespace-nowrap uppercase">{locale === 'vi' ? 'Tiến độ' : 'Progress'}</th>
                <th className="py-2 px-4 text-[12px] leading-[16px] text-on-surface-variant font-medium whitespace-nowrap uppercase">KPI (Est. / Actual)</th>
                <th className="py-2 px-4 text-[12px] leading-[16px] text-on-surface-variant font-medium whitespace-nowrap uppercase text-right">{locale === 'vi' ? 'Ngân sách (VND)' : 'Budget (VND)'}</th>
                <th className="py-2 px-4 text-[12px] leading-[16px] text-on-surface-variant font-medium whitespace-nowrap uppercase text-center">{locale === 'vi' ? 'Hồ sơ' : 'Docs'}</th>
              </tr>
            </thead>
            <tbody className="text-[14px] leading-[20px] text-on-surface">
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-on-surface-variant">
                    {locale === 'vi' ? 'Không tìm thấy dự án nào' : 'No projects found'}
                  </td>
                </tr>
              )}
              {pageRows.map((p) => {
                const budgetTotal = (p.budgetPlanDirect || 0) + (p.budgetPlanOverhead || 0);
                const actualTotal = (p.actualCostDirect || 0) + (p.actualCostOverhead || 0);
                const spentPct = budgetTotal > 0 ? Math.round((actualTotal / budgetTotal) * 100) : 0;
                const overBudget = budgetTotal > 0 && actualTotal > budgetTotal;
                const delayed = p.status === 'near_deadline' || p.status === 'overdue' || p.statusLabel === 'On Hold';
                const kpiPlan = Number(p.kpiRawLeadsPlan) || 0;
                const kpiActual = Number(p.kpiRawLeadsActual) || 0;
                const hasKpi = kpiPlan > 0 || kpiActual > 0;
                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className={`border-b border-border-light hover:bg-surface-bright transition-colors group cursor-pointer ${overBudget ? 'bg-error-container bg-opacity-10' : ''}`}
                  >
                    <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-outline-variant/50 text-primary focus:ring-primary/40 cursor-pointer"
                        checked={selected.includes(p.id)}
                        onChange={() => toggleSelect(p.id)}
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-start gap-2">
                        <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className={`material-symbols-outlined ${delayed ? 'text-warning' : 'text-secondary'}`}>{delayed ? 'timer_arrow_up' : 'campaign'}</span>
                        </div>
                        <div>
                          <p className="text-[18px] leading-[26px] font-semibold text-on-surface group-hover:text-secondary transition-colors">{p.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-data-mono text-outline text-[12px] bg-surface-container-high px-1.5 py-0.5 rounded">{codeOf(p)}</span>
                            <span className="text-on-surface-variant text-[12px] flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">event</span>{p.deadline}
                            </span>
                          </div>
                          {overBudget && (
                            <div className="flex items-center gap-1 text-danger text-[12px] mt-1">
                              <span className="material-symbols-outlined text-[14px]">warning</span>
                              {locale === 'vi' ? 'Vượt ngân sách dự kiến' : 'Over projected budget'}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center border border-border-light">
                          {getInitials(p.owner)}
                        </div>
                        <span>{p.owner}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 w-[160px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-[13px]">{p.progress}%</span>
                        <span className={`text-[12px] ${delayed ? 'text-warning' : 'text-on-surface-variant'}`}>{delayed ? 'Delayed' : 'On track'}</span>
                      </div>
                      <div className="w-full bg-surface-container-high rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${delayed ? 'bg-warning' : 'bg-secondary'}`} style={{ width: `${p.progress}%` }} />
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-[13px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-outline" />
                        <span className="text-on-surface-variant w-[52px]">{locale === 'vi' ? 'Leads:' : 'Leads:'}</span>
                        {hasKpi ? (
                          <span className="font-data-mono font-medium">
                            {fullNum(kpiPlan)} / <span className={kpiPlan > 0 && kpiActual >= kpiPlan ? 'text-success' : 'text-on-surface'}>{fullNum(kpiActual)}</span>
                          </span>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-data-mono">
                      <div className={`font-medium ${overBudget ? 'text-danger' : 'text-on-surface'}`}>{fullNum(budgetTotal)}</div>
                      <div className="text-on-surface-variant text-[12px] mt-1">{locale === 'vi' ? 'Đã chi:' : 'Spent:'} {compact(actualTotal)} ({spentPct}%)</div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {(p.documentsCount || 0) > 0 ? (
                        <span
                          className="material-symbols-outlined text-success inline-flex"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                          title={locale === 'vi' ? `Đã có ${p.documentsCount} hồ sơ` : `${p.documentsCount} document(s)`}
                        >
                          check_circle
                        </span>
                      ) : (
                        <span
                          className="material-symbols-outlined text-outline inline-flex"
                          title={locale === 'vi' ? 'Chưa có hồ sơ' : 'No documents'}
                        >
                          cancel
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border-light p-4 flex items-center justify-between bg-background-subtle">
          <span className="text-[14px] leading-[20px] text-on-surface-variant">
            {locale === 'vi' ? `Hiển thị ${startRow}-${endRow} trong số ${filtered.length} dự án` : `Showing ${startRow}-${endRow} of ${filtered.length} projects`}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={safePage === 1}
              onClick={() => setPage(safePage - 1)}
              className="w-8 h-8 flex items-center justify-center rounded border border-border-light bg-surface-container-lowest text-outline hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            {pages.map((pg, i) => (
              <span key={pg} className="flex items-center">
                {i > 0 && pages[i - 1] !== pg - 1 && <span className="text-on-surface-variant px-1">...</span>}
                <button
                  onClick={() => setPage(pg)}
                  className={`w-8 h-8 flex items-center justify-center rounded border text-[14px] leading-[20px] transition-colors ${
                    safePage === pg
                      ? 'border-secondary bg-secondary-container text-on-secondary-container font-medium'
                      : 'border-border-light bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  {pg}
                </button>
              </span>
            ))}
            <button
              disabled={safePage === totalPages}
              onClick={() => setPage(safePage + 1)}
              className="w-8 h-8 flex items-center justify-center rounded border border-border-light bg-surface-container-lowest text-outline hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowCreate(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-xl max-h-[90vh] overflow-y-auto z-50">
            <CreateProjectForm
              onClose={() => setShowCreate(false)}
              onSuccess={() => { setShowCreate(false); loadProjects(); }}
            />
          </div>
        </>
      )}
    </div>
  );
}
