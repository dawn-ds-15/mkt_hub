import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight, PlayCircle, CalendarDays, CheckCircle2, CircleX, PauseCircle,
  Clock4, ShieldCheck, TriangleAlert, ArrowRight, CloudUpload, Loader2, Trash2,
  FileText, FileSpreadsheet, ImageIcon, FileType2, CircleDot, Circle,
  FolderOpen, ExternalLink,
} from 'lucide-react';
import Layout from '../components/Layout';
import {
  getProject,
  getProjectDocuments,
  uploadProjectDocuments,
  updateProjectDocument,
  deleteProjectDocument,
  getKpiCardsData,
  getProjectExpenseSummary,
  DOC_CATEGORY,
} from '../services/api';
import { useDashboard } from '../contexts/DashboardContext';
import { useToast } from '../contexts/ToastContext';
import CreateProjectForm from '../components/Projects/CreateProjectForm';

const statusConfig = {
  near_deadline: { label: 'Sắp hết hạn', bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock4 },
  active: { label: 'Đang thực hiện', bg: 'bg-secondary-fixed', text: 'text-on-secondary-fixed', icon: PlayCircle },
  planning: { label: 'Lên kế hoạch', bg: 'bg-blue-100', text: 'text-blue-700', icon: CalendarDays },
  completed: { label: 'Hoàn thành', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  cancelled: { label: 'Đã huỷ', bg: 'bg-red-100', text: 'text-red-700', icon: CircleX },
  on_hold: { label: 'Tạm dừng', bg: 'bg-amber-100', text: 'text-amber-700', icon: PauseCircle },
};

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
}

function fmtNum(num) {
  if (num == null || isNaN(num)) return '\u2014';
  return Number(num).toLocaleString('en-US');
}

function fmtVND(num) {
  if (num == null || isNaN(num)) return '\u2014';
  return Number(num).toLocaleString('en-US') + ' \u20AB';
}

function dueLabel(iso, locale) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target - startToday) / 86400000);
  if (diffDays === 0) return locale === 'vi' ? 'Hôm nay' : 'Today';
  if (diffDays === 1) return locale === 'vi' ? 'Ngày mai' : 'Tomorrow';
  if (diffDays === -1) return locale === 'vi' ? 'Hôm qua' : 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function taskMeta(task) {
  const s = task.status || task.statusLabel || '';
  if (s === 'Done' || task.statusLabel === 'Done') return { icon: CheckCircle2, iconClass: 'text-success', done: true };
  if (s === 'overdue') return { icon: Clock4, iconClass: 'text-danger' };
  if (s === 'Processing') return { icon: CircleDot, iconClass: 'text-secondary-container' };
  return { icon: Circle, iconClass: 'text-outline' };
}

function fmtSize(bytes) {
  if (!bytes) return '\u2014';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function docIcon(type, name) {
  const t = `${type || ''} ${name || ''}`.toLowerCase();
  if (t.includes('pdf')) return FileType2;
  if (/png|jpe?g|gif|webp|svg|image/.test(t)) return ImageIcon;
  if (/xls|csv/.test(t)) return FileSpreadsheet;
  if (/\.docx?|word/.test(t)) return FileText;
  return FileText;
}

function CircularProgress({ value }) {
  const clamped = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke="currentColor" strokeWidth="3" className="text-surface-container-high"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${clamped}, 100`} className="text-secondary-container"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg leading-[26px] font-semibold text-on-surface">{Math.round(clamped)}%</span>
      </div>
    </div>
  );
}

function KpiMiniCard({ label, actual, plan, locale, isMoney, planLabel }) {
  const fmt = isMoney ? fmtVND : fmtNum;
  const hasActual = actual != null && !isNaN(actual);
  const hasPlan = plan != null && !isNaN(plan);
  let delta = null;
  let deltaColor = 'text-success';
  if (hasActual && hasPlan && plan > 0) {
    const pct = Math.round((actual / plan) * 100);
    delta = `${pct >= 100 ? '+' : ''}${pct - 100}%`;
    deltaColor = pct >= 100 ? 'text-success' : 'text-warning';
  }
  const display = hasActual ? fmt(actual) : '\u2014';
  return (
    <div className="flex flex-col p-2 rounded-lg bg-background border border-surface-container-high">
      <span className="font-label-md text-label-md text-on-surface-variant mb-1">{label}</span>
      <div className="flex items-end gap-2">
        <span className="text-lg leading-[26px] font-semibold text-on-surface truncate">{display}</span>
        {delta && <span className={`font-data-mono text-data-mono ${deltaColor} text-xs mb-[2px]`}>{delta}</span>}
      </div>
      {hasPlan && <span className="font-label-md text-label-md text-on-surface-variant mt-1">{planLabel || (locale === 'vi' ? 'Kế hoạch: ' : 'Plan: ')}{fmt(plan)}</span>}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { locale, year } = useDashboard();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Ngân sách dự án = số KH / TT nhập ở Quản lý chi phí > Nhập chi phí dự án (trước VAT)
  const [budgetSummary, setBudgetSummary] = useState(null);
  const fileInputRef = useRef(null);
  const addToast = useToast();

  const reloadDocs = useCallback(() => {
    getProjectDocuments(id)
      .then((res) => setDocs(Array.isArray(res.data) ? res.data : []))
      .catch((e) => console.error('[ProjectDetail] getProjectDocuments:', e))
      .finally(() => setDocsLoading(false));
  }, [id]);

  useEffect(() => { reloadDocs(); }, [reloadDocs]);

  useEffect(() => {
    let cancelled = false;
    setBudgetSummary(null);
    getProjectExpenseSummary(id)
      .then(({ data }) => {
        if (cancelled) return;
        const planned = Number(data?.plannedBeforeVat) || 0;
        const actual = Number(data?.actualBeforeVat) || 0;
        setBudgetSummary({ planned, actual, actualAfterVat: Number(data?.actualAfterVat) || 0, lineCount: planned || actual ? 1 : 0 });
      })
      .catch((e) => {
        console.error('[ProjectDetail] getProjectExpenseSummary:', e);
        if (!cancelled) setBudgetSummary({ planned: 0, actual: 0, actualAfterVat: 0, lineCount: 0, error: true });
      });
    return () => { cancelled = true; };
  }, [id]);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length || uploading) return;
    setUploading(true);
    try {
      await uploadProjectDocuments(id, files, DOC_CATEGORY.HOSO);
      addToast(locale === 'vi' ? `Đã tải lên ${files.length} hồ sơ` : `Uploaded ${files.length} document(s)`);
      reloadDocs();
    } catch (e) {
      console.error('[ProjectDetail] uploadProjectDocuments:', e);
      addToast(locale === 'vi' ? 'Tải lên thất bại. Vui lòng thử lại.' : 'Upload failed. Please try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (doc) => {
    const msg = locale === 'vi'
      ? `Xoá hồ sơ "${doc.name}"? (Xoá mềm — có thể khôi phục từ dữ liệu)`
      : `Delete document "${doc.name}"? (Soft delete)`;
    if (!window.confirm(msg)) return;
    try {
      await deleteProjectDocument(doc.id);
      addToast(locale === 'vi' ? 'Đã xoá hồ sơ' : 'Document deleted');
      reloadDocs();
    } catch (e) {
      console.error('[ProjectDetail] deleteProjectDocument:', e);
      addToast(locale === 'vi' ? 'Xoá hồ sơ thất bại.' : 'Failed to delete document.', 'error');
    }
  };

  const handleChangeCategory = async (doc, category) => {
    try {
      await updateProjectDocument(doc.id, category);
      reloadDocs();
    } catch (e) {
      console.error('[ProjectDetail] updateProjectDocument:', e);
      addToast(locale === 'vi' ? 'Cập nhật loại tài liệu thất bại.' : 'Failed to update document type.', 'error');
    }
  };

const load = useCallback(() => {
    setLoading(true);
    getProject(id)
      .then((res) => {
        if (res.data) {
          setProject(res.data);
          setNotFound(false);
          enrichKpis();
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, year]);

  const enrichKpis = useCallback(async () => {
    const cards = await getKpiCardsData('year', year, year, id).catch(() => ({ data: [] }));
    const byLabel = Object.fromEntries((cards.data || []).map(c => [c.label, c]));
    setProject((prev) => {
      if (!prev) return prev;
      const opp = byLabel['OPP'];
      const closed = byLabel['Closed Deal'];
      const pipe = byLabel['Pipeline Value'];
      return {
        ...prev,
        kpiOppActual: opp ? (Number(opp.actual ?? 0) || 0) : prev.kpiOppActual,
        kpiClosedDealActual: closed ? (Number(closed.actual ?? 0) || 0) : prev.kpiClosedDealActual,
        kpiPipelineValueActual: pipe ? (Number(pipe.actual ?? 0) || 0) : prev.kpiPipelineValueActual,
      };
    });
  }, [id, year]);

  useEffect(() => { load(); }, [load]);

  const st = statusConfig[project?.status] || statusConfig.active;
  const health = (project?.status === 'near_deadline' || project?.status === 'on_hold' || project?.status === 'cancelled')
    ? { label: locale === 'vi' ? 'Chậm tiến độ' : 'Behind schedule', color: 'text-danger', icon: TriangleAlert }
    : { label: locale === 'vi' ? 'Tốt (Đúng hạn)' : 'Healthy (On track)', color: 'text-success', icon: ShieldCheck };

  const plannedTotal = budgetSummary?.planned || 0;
  const actualTotal = budgetSummary?.actual || 0;
  const remainingTotal = plannedTotal - actualTotal;
  const usedPct = plannedTotal > 0 ? Math.round((actualTotal / plannedTotal) * 100) : null;
  const spendPct = usedPct != null ? Math.min(100, Math.max(0, usedPct)) : 0;
  const overBudget = plannedTotal > 0 && actualTotal > plannedTotal;

  const recentTasks = project?.tasks || [];

  if (loading) {
    return (
      <Layout title={locale === 'vi' ? 'Chi tiết Dự án' : 'Project Detail'}>
        <div className="flex items-center justify-center h-64">
          <p className="text-on-surface-variant">{locale === 'vi' ? 'Đang tải dữ liệu...' : 'Loading data...'}</p>
        </div>
      </Layout>
    );
  }

  if (notFound || !project) {
    return (
      <Layout title={locale === 'vi' ? 'Chi tiết Dự án' : 'Project Detail'}>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-on-surface-variant">{locale === 'vi' ? 'Không tìm thấy dự án' : 'Project not found'}</p>
          <button onClick={() => navigate('/projects')} className="px-4 py-2 bg-primary text-on-primary rounded-lg text-label-md font-bold">
            {locale === 'vi' ? 'Quay lại danh sách dự án' : 'Back to projects'}
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={locale === 'vi' ? 'Chi tiết Dự án' : 'Project Detail'}>
      <div className="max-w-[1440px] mx-auto">
        {/* Page Header */}
        <div className="mb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md mb-1">
              <Link to="/projects" className="hover:text-primary transition-colors">{locale === 'vi' ? 'Dự án' : 'Projects'}</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-on-surface">{locale === 'vi' ? 'Chi tiết' : 'Detail'}</span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-lg leading-[26px] font-semibold text-on-surface">{project.name}</h2>
              <span className={`inline-flex items-center px-2 py-[2px] rounded-full font-label-md text-label-md ${st.bg} ${st.text}`}>
                <st.icon className="w-3.5 h-3.5 mr-1" />
                {locale === 'vi' ? st.label : ({
                  near_deadline: 'Near deadline', active: 'Active', planning: 'Planning',
                  completed: 'Completed', cancelled: 'Cancelled', on_hold: 'On Hold',
                })[project.status] || st.label}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="px-3 py-1.5 rounded-lg border border-border-light text-on-surface text-xs leading-[18px] font-medium hover:bg-surface-container-highest transition-colors"
            >
              {locale === 'vi' ? 'Chỉnh sửa' : 'Edit'}
            </button>
          </div>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-12 gap-3">
          {/* Progress / Health Card (Span 4) */}
          <div className="col-span-12 md:col-span-4 bg-surface-container-lowest border border-border-light rounded-lg p-3 flex flex-col relative overflow-hidden group">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-sm leading-[20px] font-semibold text-on-surface">{locale === 'vi' ? 'Tiến độ' : 'Progress'}</h3>
            </div>
            <div className="flex-1 flex flex-col justify-center items-center">
              <div className="mb-2">
                <CircularProgress value={project.progress} />
              </div>
              <div className="flex items-center gap-1 font-label-md text-label-md">
                <health.icon className={`w-3.5 h-3.5 ${health.color}`} />
                <span className={health.color}>{health.label}</span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-on-surface-variant font-label-md text-label-md">
                <span>{project.tasksCompleted}/{project.tasksTotal} {locale === 'vi' ? 'task' : 'tasks'}</span>
                <span>·</span>
                <span>{locale === 'vi' ? 'Hạn: ' : 'Deadline: '}{project.deadline}</span>
              </div>
            </div>
          </div>

          {/* KPIs Card (Span 8) */}
          <div className="col-span-12 md:col-span-8 bg-surface-container-lowest border border-border-light rounded-lg p-3 flex flex-col group">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-sm leading-[20px] font-semibold text-on-surface">{locale === 'vi' ? 'Chỉ số cốt lõi (KPIs)' : 'Core KPIs'}</h3>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <KpiMiniCard
                label={locale === 'vi' ? 'Tổng Leads' : 'Raw Leads'}
                actual={project.kpiRawLeadsActual}
                plan={project.kpiRawLeadsPlan}
                locale={locale}
              />
              <KpiMiniCard label="MQL" actual={project.kpiMqlActual} plan={project.kpiMqlPlan} locale={locale} />
              <KpiMiniCard label="SQL" actual={project.kpiSqlActual} plan={project.kpiSqlPlan} locale={locale} />
              <KpiMiniCard label="OPP" actual={project.kpiOppActual} plan={project.kpiOppPlan} locale={locale} />
              <KpiMiniCard
                label="Closed Deal"
                actual={project.kpiClosedDealActual}
                plan={project.kpiClosedDealPlan}
                locale={locale}
              />
              <KpiMiniCard
                label={locale === 'vi' ? 'Giá trị Pipeline' : 'Pipeline Value'}
                actual={project.kpiPipelineValueActual}
                plan={project.kpiPipelineValuePlan}
                locale={locale}
                isMoney
                planLabel={locale === 'vi' ? 'Kế hoạch: ' : 'Plan: '}
              />
            </div>
          </div>

          {/* Budget Card (Span 6) — KH vs TT lấy từ Nhập chi phí dự án (trước VAT) */}
          <div className="col-span-12 md:col-span-6 bg-surface-container-lowest border border-border-light rounded-lg p-3 flex flex-col group">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-sm leading-[20px] font-semibold text-on-surface">{locale === 'vi' ? 'Ngân sách dự án' : 'Project Budget'}</h3>
              <button onClick={() => navigate(`/expense?tab=input&projectId=${id}`)} className="text-on-surface-variant group-hover:text-secondary-container transition-colors" title={locale === 'vi' ? 'Mở bảng nhập chi phí của dự án' : 'Open project expense entry'}>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {budgetSummary == null ? (
              <div className="flex-1 flex items-center justify-center text-on-surface-variant">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-2 flex-1 justify-center">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-xs leading-[18px] text-on-surface-variant block">{locale === 'vi' ? 'Kế hoạch' : 'Planned'}</span>
                    <span className="font-data-mono text-xs text-on-surface font-semibold">{fmtVND(plannedTotal)}</span>
                  </div>
                  <div>
                    <span className="text-xs leading-[18px] text-on-surface-variant block">{locale === 'vi' ? 'Thực tế' : 'Actual'}</span>
                    <span className={`font-data-mono text-xs font-semibold ${overBudget ? 'text-danger' : 'text-on-surface'}`}>{fmtVND(actualTotal)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs leading-[18px] text-on-surface-variant block">{overBudget ? (locale === 'vi' ? 'Vượt' : 'Over') : (locale === 'vi' ? 'Còn lại' : 'Remaining')}</span>
                    <span className={`font-data-mono text-xs font-semibold ${overBudget ? 'text-danger' : 'text-success'}`}>{fmtVND(Math.abs(remainingTotal))}</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${overBudget ? 'bg-danger' : 'bg-secondary-container'}`} style={{ width: `${spendPct}%` }} />
                </div>
                <div className="flex justify-between items-start">
                  <span className={`font-label-md text-label-md ${overBudget ? 'text-danger' : 'text-on-primary-container'}`}>
                    {locale === 'vi' ? 'Đã dùng: ' : 'Used: '}{usedPct != null ? `${usedPct}%` : '—'}
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant text-right">
                    {locale === 'vi' ? 'Giá trước VAT' : 'Before VAT'}
                    {budgetSummary.actualAfterVat ? ` · ${locale === 'vi' ? 'TT sau VAT' : 'Actual after VAT'}: ${fmtVND(budgetSummary.actualAfterVat)}` : ''}
                  </span>
                </div>
                {budgetSummary.lineCount === 0 && (
                  <span className="text-xs text-on-surface-variant italic">
                    {budgetSummary.error
                      ? (locale === 'vi' ? 'Không tải được chi phí dự án.' : 'Failed to load project expenses.')
                      : (locale === 'vi' ? 'Chưa nhập chi phí cho dự án này.' : 'No expenses entered for this project yet.')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Recent Tasks (Span 6) */}
          <div className="col-span-12 md:col-span-6 bg-surface-container-lowest border border-border-light rounded-lg p-3 flex flex-col group">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-sm leading-[20px] font-semibold text-on-surface">{locale === 'vi' ? 'Công việc gần nhất' : 'Recent Tasks'}</h3>
              <button onClick={() => navigate(`/tasks?projectId=${id}`)} className="text-on-surface-variant group-hover:text-secondary-container transition-colors" title={locale === 'vi' ? 'Mở module Công việc' : 'Open Tasks module'}>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {recentTasks.length > 0 ? (
              <ul className="flex flex-col gap-2 flex-1">
                {recentTasks.slice(0, 5).map((task, idx) => {
                  const meta = taskMeta(task);
                  return (
                    <li key={idx} className="flex items-center justify-between p-1.5 rounded hover:bg-background transition-colors">
                      <div className="flex items-center gap-2">
                        <meta.icon className={`w-4 h-4 ${meta.iconClass}`} />
                        <span className={`text-xs leading-[18px] truncate max-w-[220px] ${meta.done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>{task.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`font-label-md text-label-md ${task.status === 'overdue' ? 'text-danger' : 'text-on-surface-variant'}`}>{dueLabel(task.dueDate || task.due, locale)}</span>
                        <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center text-[9px] font-bold text-white" title={task.assignee}>
                          {getInitials(task.assignee)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex-1 flex items-center justify-center text-on-surface-variant italic">
                {locale === 'vi' ? 'Chưa có công việc nào.' : 'No tasks yet.'}
              </div>
            )}
          </div>

          {/* Contracts & Documents (Span 12) */}
          <div className="col-span-12 bg-surface-container-lowest border border-border-light rounded-lg p-3 flex flex-col group">
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm leading-[20px] font-semibold text-on-surface">{locale === 'vi' ? 'Hợp đồng & Hồ sơ' : 'Contracts & Documents'}</h3>
                {docs.length > 0 && (
                  <span className="px-2 py-[1px] rounded-full bg-secondary-container text-on-secondary-container text-[10px] leading-[14px] font-semibold">{docs.length}</span>
                )}
              </div>
            </div>
            {project.driveLink ? (
              <a
                href={project.driveLink}
                target="_blank"
                rel="noreferrer"
                title={project.driveLink}
                className="mb-3 flex items-center gap-2.5 p-2.5 rounded-lg border border-border-light bg-background-subtle hover:bg-surface-container-low transition-colors group/drive"
              >
                <FolderOpen className="w-4 h-4 flex-shrink-0 text-secondary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-[18px] font-semibold text-on-surface group-hover/drive:text-secondary transition-colors">
                    {locale === 'vi' ? 'Thư mục Drive của dự án' : 'Project Drive folder'}
                  </p>
                  <p className="text-[10px] leading-[14px] text-on-surface-variant truncate">{project.driveLink}</p>
                </div>
                <ExternalLink className="w-4 h-4 flex-shrink-0 text-on-surface-variant group-hover/drive:text-secondary transition-colors" />
              </a>
            ) : (
              <div className="mb-3 flex items-center gap-2.5 p-2.5 rounded-lg border border-dashed border-border-light text-on-surface-variant">
                <FolderOpen className="w-4 h-4 flex-shrink-0" />
                <p className="text-[11px] leading-[15px]">
                  {locale === 'vi'
                    ? 'Chưa có link Drive. Bấm "Chỉnh sửa" để thêm link cho dự án này.'
                    : 'No Drive link yet. Use "Edit" to add one for this project.'}
                </p>
              </div>
            )}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              className={`mb-3 p-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-surface-container-high bg-background-subtle hover:bg-surface-container-low'
              }`}
            >
              {uploading ? <Loader2 className={`w-6 h-6 animate-spin transition-colors ${dragOver ? 'text-primary' : 'text-on-surface-variant'}`} /> : <CloudUpload className={`w-6 h-6 transition-colors ${dragOver ? 'text-primary' : 'text-on-surface-variant'}`} />}
              <p className="text-xs leading-[18px] text-on-surface-variant">
                {uploading
                  ? (locale === 'vi' ? 'Đang tải lên...' : 'Uploading...')
                  : locale === 'vi'
                    ? 'Kéo thả hoặc click để đính kèm hồ sơ & hợp đồng cho dự án này'
                    : 'Drag & drop or click to attach documents & contracts for this project'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
              />
            </div>
            {docs.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {[...docs].map((doc) => {
                    const DocIcon = docIcon(doc.type, doc.name);
                    return (
                  <li key={doc.id} className="flex items-center gap-3 p-1.5 rounded-lg border border-surface-container-high hover:bg-background transition-colors">
                    <DocIcon className={`w-4 h-4 flex-shrink-0 ${DocIcon === FileText ? 'text-secondary-container' : 'text-primary'}`} />
                    <div className="flex-1 min-w-0">
                      <a
                        href={doc.url || undefined}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => {
                          if (!doc.url) {
                            e.preventDefault();
                            addToast(locale === 'vi' ? 'File này chưa có đường dẫn để xem.' : 'This file has no viewable URL.', 'error');
                          }
                        }}
                        title={locale === 'vi' ? 'Nhấn để xem hồ sơ' : 'Click to view document'}
                        className="block text-xs leading-[18px] text-on-surface truncate hover:text-secondary hover:underline cursor-pointer"
                      >
                        {doc.name}
                      </a>
                      <p className="text-[10px] leading-[14px] text-on-surface-variant">
                        {fmtSize(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-GB')}
                      </p>
                    </div>
                    <select
                      value={doc.category}
                      onChange={(e) => handleChangeCategory(doc, e.target.value)}
                      className="pl-3 pr-2 py-1.5 rounded-lg border border-border-light bg-background-subtle text-xs leading-[18px] text-on-surface hover:bg-surface-container-high focus:outline-none focus:border-secondary cursor-pointer"
                      title={locale === 'vi' ? 'Loại tài liệu' : 'Document type'}
                    >
                      <option value={DOC_CATEGORY.HOSO}>{locale === 'vi' ? 'Hồ sơ' : 'Document'}</option>
                      <option value={DOC_CATEGORY.HOPDONG}>{locale === 'vi' ? 'Hợp đồng' : 'Contract'}</option>
                    </select>
                    <button
                      onClick={() => handleDeleteDoc(doc)}
                      title={locale === 'vi' ? 'Xoá hồ sơ' : 'Delete document'}
                      className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:text-danger hover:bg-error-container transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                    );
                  })}
              </ul>
            ) : (
              <div className="flex items-center justify-center py-4 text-on-surface-variant text-xs leading-[18px]">
                {docsLoading
                  ? (locale === 'vi' ? 'Đang tải hồ sơ...' : 'Loading documents...')
                  : (locale === 'vi' ? 'Chưa có hồ sơ nào cho dự án này.' : 'No documents for this project yet.')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Project Popup */}
      {showEdit && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowEdit(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-xl max-h-[90vh] overflow-y-auto z-50">
            <CreateProjectForm
              project={project}
              onClose={() => setShowEdit(false)}
              onSuccess={() => { setShowEdit(false); load(); }}
            />
          </div>
        </>
      )}
    </Layout>
  );
}
