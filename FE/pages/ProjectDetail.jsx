import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  getProject,
  getProjectDocuments,
  uploadProjectDocuments,
  updateProjectDocument,
  deleteProjectDocument,
  DOC_CATEGORY,
} from '../services/api';
import { useDashboard } from '../contexts/DashboardContext';
import { useToast } from '../contexts/ToastContext';
import CreateProjectForm from '../components/Projects/CreateProjectForm';

const statusConfig = {
  near_deadline: { label: 'Sắp hết hạn', bg: 'bg-amber-100', text: 'text-amber-700', icon: 'schedule' },
  active: { label: 'Đang thực hiện', bg: 'bg-secondary-fixed', text: 'text-on-secondary-fixed', icon: 'play_circle' },
  planning: { label: 'Lên kế hoạch', bg: 'bg-blue-100', text: 'text-blue-700', icon: 'event' },
  completed: { label: 'Hoàn thành', bg: 'bg-green-100', text: 'text-green-700', icon: 'check_circle' },
  cancelled: { label: 'Đã huỷ', bg: 'bg-red-100', text: 'text-red-700', icon: 'cancel' },
  on_hold: { label: 'Tạm dừng', bg: 'bg-amber-100', text: 'text-amber-700', icon: 'pause_circle' },
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
  if (s === 'Done' || task.statusLabel === 'Done') return { icon: 'check_circle', iconClass: 'text-success', done: true };
  if (s === 'overdue') return { icon: 'schedule', iconClass: 'text-danger' };
  if (s === 'Processing') return { icon: 'radio_button_checked', iconClass: 'text-secondary-container' };
  return { icon: 'radio_button_unchecked', iconClass: 'text-outline' };
}

function fmtSize(bytes) {
  if (!bytes) return '\u2014';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function docIcon(type, name) {
  const t = `${type || ''} ${name || ''}`.toLowerCase();
  if (t.includes('pdf')) return 'picture_as_pdf';
  if (/png|jpe?g|gif|webp|svg|image/.test(t)) return 'image';
  if (/xls|csv/.test(t)) return 'table_chart';
  if (/\.docx?|word/.test(t)) return 'article';
  return 'description';
}

function CircularProgress({ value }) {
  const clamped = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
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
        <span className="text-[24px] leading-[32px] font-semibold text-on-surface">{Math.round(clamped)}%</span>
      </div>
    </div>
  );
}

function KpiMiniCard({ label, actual, plan, locale }) {
  const hasActual = actual != null && !isNaN(actual);
  const hasPlan = plan != null && !isNaN(plan);
  let delta = null;
  let deltaColor = 'text-success';
  if (hasActual && hasPlan && plan > 0) {
    const pct = Math.round((actual / plan) * 100);
    delta = `${pct >= 100 ? '+' : ''}${pct - 100}%`;
    deltaColor = pct >= 100 ? 'text-success' : 'text-warning';
  }
  const display = hasActual ? fmtNum(actual) : '\u2014';
  return (
    <div className="flex flex-col p-2 rounded-lg bg-background border border-surface-container-high">
      <span className="font-label-md text-label-md text-on-surface-variant mb-1">{label}</span>
      <div className="flex items-end gap-2">
        <span className="text-[24px] leading-[32px] font-semibold text-on-surface">{display}</span>
        {delta && <span className={`font-data-mono text-data-mono ${deltaColor} text-xs mb-[2px]`}>{delta}</span>}
      </div>
      {hasPlan && <span className="font-label-md text-label-md text-on-surface-variant mt-1">{locale === 'vi' ? 'Kế hoạch: ' : 'Plan: '}{fmtNum(plan)}</span>}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { locale } = useDashboard();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const addToast = useToast();

  const reloadDocs = useCallback(() => {
    getProjectDocuments(id)
      .then((res) => setDocs(Array.isArray(res.data) ? res.data : []))
      .catch((e) => console.error('[ProjectDetail] getProjectDocuments:', e))
      .finally(() => setDocsLoading(false));
  }, [id]);

  useEffect(() => { reloadDocs(); }, [reloadDocs]);

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
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const st = statusConfig[project?.status] || statusConfig.active;
  const health = (project?.status === 'near_deadline' || project?.status === 'on_hold' || project?.status === 'cancelled')
    ? { label: locale === 'vi' ? 'Chậm tiến độ' : 'Behind schedule', color: 'text-danger', icon: 'error' }
    : { label: locale === 'vi' ? 'Tốt (Đúng hạn)' : 'Healthy (On track)', color: 'text-success', icon: 'health_and_safety' };

  const plannedTotal = (project?.budgetPlanDirect || 0) + (project?.budgetPlanOverhead || 0);
  const actualTotal = (project?.actualCostDirect || 0) + (project?.actualCostOverhead || 0);
  const spendPct = plannedTotal ? Math.min(100, Math.round((actualTotal / plannedTotal) * 100)) : 0;

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
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md mb-1">
              <Link to="/projects" className="hover:text-primary transition-colors">{locale === 'vi' ? 'Dự án' : 'Projects'}</Link>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
              <span className="text-on-surface">{locale === 'vi' ? 'Chi tiết' : 'Detail'}</span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-[24px] leading-[32px] font-semibold text-on-surface">{project.name}</h2>
              <span className={`inline-flex items-center px-2 py-[2px] rounded-full font-label-md text-label-md ${st.bg} ${st.text}`}>
                <span className="material-symbols-outlined mr-1" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>{st.icon}</span>
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
              className="px-4 py-2 rounded-lg border border-border-light text-on-surface text-[14px] leading-[20px] font-medium hover:bg-surface-container-highest transition-colors"
            >
              {locale === 'vi' ? 'Chỉnh sửa' : 'Edit'}
            </button>
          </div>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-12 gap-5">
          {/* Progress / Health Card (Span 4) */}
          <div className="col-span-12 md:col-span-4 bg-surface-container-lowest border border-border-light rounded-lg p-4 flex flex-col relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-[18px] leading-[26px] font-semibold text-on-surface">{locale === 'vi' ? 'Tiến độ' : 'Progress'}</h3>
            </div>
            <div className="flex-1 flex flex-col justify-center items-center">
              <div className="mb-2">
                <CircularProgress value={project.progress} />
              </div>
              <div className="flex items-center gap-1 font-label-md text-label-md">
                <span className={`material-symbols-outlined ${health.color}`} style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>{health.icon}</span>
                <span className={health.color}>{health.label}</span>
              </div>
              <div className="flex items-center gap-4 mt-4 text-on-surface-variant font-label-md text-label-md">
                <span>{project.tasksCompleted}/{project.tasksTotal} {locale === 'vi' ? 'task' : 'tasks'}</span>
                <span>·</span>
                <span>{locale === 'vi' ? 'Hạn: ' : 'Deadline: '}{project.deadline}</span>
              </div>
            </div>
          </div>

          {/* KPIs Card (Span 8) */}
          <div className="col-span-12 md:col-span-8 bg-surface-container-lowest border border-border-light rounded-lg p-4 flex flex-col group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-[18px] leading-[26px] font-semibold text-on-surface">{locale === 'vi' ? 'Chỉ số cốt lõi (KPIs)' : 'Core KPIs'}</h3>
              <button onClick={() => navigate('/leads')} className="text-on-surface-variant group-hover:text-secondary-container transition-colors" title={locale === 'vi' ? 'Mở module KPI' : 'Open KPI module'}>
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <KpiMiniCard
                label={locale === 'vi' ? 'Tổng Leads' : 'Raw Leads'}
                actual={project.kpiRawLeadsActual}
                plan={project.kpiRawLeadsPlan}
                locale={locale}
              />
              <KpiMiniCard label="MQL" actual={project.kpiMqlActual} plan={project.kpiMqlPlan} locale={locale} />
              <KpiMiniCard label="SQL" actual={project.kpiSqlActual} plan={project.kpiSqlPlan} locale={locale} />
            </div>
          </div>

          {/* Budget Card (Span 6) */}
          <div className="col-span-12 md:col-span-6 bg-surface-container-lowest border border-border-light rounded-lg p-4 flex flex-col group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-[18px] leading-[26px] font-semibold text-on-surface">{locale === 'vi' ? 'Ngân sách dự án' : 'Project Budget'}</h3>
              <button onClick={() => navigate('/expense')} className="text-on-surface-variant group-hover:text-secondary-container transition-colors" title={locale === 'vi' ? 'Mở module Chi phí' : 'Open Expense module'}>
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
            <div className="flex flex-col gap-2 flex-1 justify-center">
              <div className="flex justify-between items-end">
                <span className="text-[14px] leading-[20px] text-on-surface-variant">{locale === 'vi' ? 'Thực tế (Actual)' : 'Actual'}</span>
                <span className="font-data-mono text-data-mono text-on-surface font-semibold">{fmtVND(actualTotal)}</span>
              </div>
              <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                <div className="h-full bg-secondary-container rounded-full" style={{ width: `${spendPct}%` }} />
              </div>
              <div className="flex justify-between items-start mt-1">
                <span className="font-label-md text-label-md text-on-primary-container">{locale === 'vi' ? `Đã tiêu: ${spendPct}%` : `Spent: ${spendPct}%`}</span>
                <div className="text-right">
                  <span className="font-label-md text-label-md text-on-surface-variant block">{locale === 'vi' ? 'Kế hoạch (Planned)' : 'Planned'}</span>
                  <span className="font-data-mono text-data-mono text-on-surface block">{fmtVND(plannedTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Tasks (Span 6) */}
          <div className="col-span-12 md:col-span-6 bg-surface-container-lowest border border-border-light rounded-lg p-4 flex flex-col group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-[18px] leading-[26px] font-semibold text-on-surface">{locale === 'vi' ? 'Công việc gần nhất' : 'Recent Tasks'}</h3>
              <button onClick={() => navigate(`/tasks?projectId=${id}`)} className="text-on-surface-variant group-hover:text-secondary-container transition-colors" title={locale === 'vi' ? 'Mở module Công việc' : 'Open Tasks module'}>
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
            {recentTasks.length > 0 ? (
              <ul className="flex flex-col gap-2 flex-1">
                {recentTasks.slice(0, 5).map((task, idx) => {
                  const meta = taskMeta(task);
                  return (
                    <li key={idx} className="flex items-center justify-between p-2 rounded hover:bg-background transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined ${meta.iconClass}`} style={{ fontVariationSettings: meta.done ? "'FILL' 1" : "'FILL' 0" }}>{meta.icon}</span>
                        <span className={`text-[14px] leading-[20px] truncate max-w-[220px] ${meta.done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>{task.name}</span>
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
          <div className="col-span-12 bg-surface-container-lowest border border-border-light rounded-lg p-4 flex flex-col group">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-[18px] leading-[26px] font-semibold text-on-surface">{locale === 'vi' ? 'Hợp đồng & Hồ sơ' : 'Contracts & Documents'}</h3>
                {docs.length > 0 && (
                  <span className="px-2 py-[1px] rounded-full bg-secondary-container text-on-secondary-container text-[12px] leading-[16px] font-semibold">{docs.length}</span>
                )}
              </div>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              className={`mb-4 p-6 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-surface-container-high bg-background-subtle hover:bg-surface-container-low'
              }`}
            >
              <span className={`material-symbols-outlined transition-colors ${dragOver ? 'text-primary' : 'text-on-surface-variant'}`} style={{ fontSize: 32 }}>{uploading ? 'sync' : 'cloud_upload'}</span>
              <p className="text-[14px] leading-[20px] text-on-surface-variant">
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
              <ul className="flex flex-col gap-2">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 p-2 rounded-lg border border-surface-container-high hover:bg-background transition-colors">
                    <span className={`material-symbols-outlined ${docIcon(doc.type, doc.name) === 'description' ? 'text-secondary-container' : 'text-primary'}`}>{docIcon(doc.type, doc.name)}</span>
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
                        className="block text-[14px] leading-[20px] text-on-surface truncate hover:text-secondary hover:underline cursor-pointer"
                      >
                        {doc.name}
                      </a>
                      <p className="text-[12px] leading-[16px] text-on-surface-variant">
                        {fmtSize(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-GB')}
                      </p>
                    </div>
                    <select
                      value={doc.category}
                      onChange={(e) => handleChangeCategory(doc, e.target.value)}
                      className="pl-3 pr-2 py-1.5 rounded-lg border border-border-light bg-background-subtle text-[13px] leading-[18px] text-on-surface hover:bg-surface-container-high focus:outline-none focus:border-secondary cursor-pointer"
                      title={locale === 'vi' ? 'Loại tài liệu' : 'Document type'}
                    >
                      <option value={DOC_CATEGORY.HOSO}>{locale === 'vi' ? 'Hồ sơ' : 'Document'}</option>
                      <option value={DOC_CATEGORY.HOPDONG}>{locale === 'vi' ? 'Hợp đồng' : 'Contract'}</option>
                    </select>
                    <button
                      onClick={() => handleDeleteDoc(doc)}
                      title={locale === 'vi' ? 'Xoá hồ sơ' : 'Delete document'}
                      className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:text-danger hover:bg-error-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center justify-center py-6 text-on-surface-variant text-[14px] leading-[20px]">
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
