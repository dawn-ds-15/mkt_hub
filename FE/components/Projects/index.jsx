import { useEffect, useState, useMemo, useCallback } from 'react';
import { getProjects, deleteProject } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import ProjectCard from './ProjectCard';
import CreateProjectForm from './CreateProjectForm';

export default function ProjectsPage({ onProjectCreated }) {
  const { locale } = useDashboard();
  const [projects, setProjects] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [filters, setFilters] = useState({ status: 'Tất cả', type: 'Tất cả' });

  const refreshProjects = useCallback(() => {
    getProjects().then((res) => {
      setProjects(res.data);
      setFiltered(res.data);
    });
  }, []);

  const handleDelete = async (project) => {
    if (!window.confirm(locale === 'vi' ? `Xác nhận xóa dự án "${project.name}"?` : `Confirm delete project "${project.name}"?`)) return;
    try {
      await deleteProject(project.id);
      refreshProjects();
    } catch (err) {
      alert(locale === 'vi' ? 'Xóa dự án thất bại' : 'Failed to delete project');
    }
  };

  const summary = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => p.statusLabel === 'Active').length;
    const planning = projects.filter(p => p.statusLabel === 'Planning').length;
    const completed = projects.filter(p => p.statusLabel === 'Completed').length;
    const onHold = projects.filter(p => p.statusLabel === 'On Hold').length;
    const nearDeadline = projects.filter(p => p.status === 'near_deadline').length;
    const tasksTotal = projects.reduce((s, p) => s + (p.tasksTotal || 0), 0);
    const tasksDone = projects.reduce((s, p) => s + (p.tasksCompleted || 0), 0);
    const avgProgress = total ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / total) : 0;
    return { total, active, planning, completed, onHold, nearDeadline, tasksTotal, tasksDone, avgProgress };
  }, [projects]);

  useEffect(() => {
    getProjects().then((res) => {
      setProjects(res.data);
      setFiltered(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let result = [...projects];
    if (filters.status !== 'Tất cả') {
      result = result.filter(p => p.statusLabel === filters.status);
    }
    if (filters.type !== 'Tất cả') {
      result = result.filter(p => p.type === filters.type);
    }
    setFiltered(result);
  }, [filters, projects]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-on-surface-variant">{locale === 'vi' ? 'Đang tải dữ liệu...' : 'Loading data...'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-container_max_width mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="font-headline-md text-headline-md font-bold text-on-surface">{locale === 'vi' ? 'Dự án' : 'Projects'}</h3>
          <p className="text-body-md text-on-surface-variant">{locale === 'vi' ? 'Quản lý và theo dõi các sáng kiến marketing đang triển khai.' : 'Manage and track ongoing marketing initiatives.'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {locale === 'vi' ? 'Tạo dự án' : 'Create Project'}
          </button>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="px-4 py-2 border border-outline-variant rounded-lg text-label-md font-semibold hover:bg-surface-container transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            {locale === 'vi' ? 'Bộ lọc' : 'Filters'}
          </button>
        </div>
      </header>

      {/* Summary Panel */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">dashboard</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">{locale === 'vi' ? 'Tổng quan' : 'Overview'}</h3>
            <p className="text-body-xs text-on-surface-variant">{locale === 'vi' ? 'Bảng tổng kết dự án' : 'Project Summary'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <p className="text-headline-lg font-bold text-primary">{summary.total}</p>
            <p className="text-label-xs text-on-surface-variant mt-0.5">{locale === 'vi' ? 'Tổng dự án' : 'Total Projects'}</p>
          </div>
          <div className="bg-success/5 rounded-lg p-3 text-center">
            <p className="text-headline-lg font-bold text-success">{summary.active}</p>
            <p className="text-label-xs text-on-surface-variant mt-0.5">{locale === 'vi' ? 'Đang thực hiện' : 'In Progress'}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-headline-lg font-bold text-amber-600">{summary.planning}</p>
            <p className="text-label-xs text-on-surface-variant mt-0.5">{locale === 'vi' ? 'Lên kế hoạch' : 'Planning'}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-headline-lg font-bold text-green-700">{summary.completed}</p>
            <p className="text-label-xs text-on-surface-variant mt-0.5">{locale === 'vi' ? 'Hoàn thành' : 'Completed'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-body-sm">
              <span className="text-on-surface-variant">{locale === 'vi' ? 'Tiến độ trung bình' : 'Average Progress'}</span>
              <span className="font-bold text-on-surface">{summary.avgProgress}%</span>
            </div>
            <div className="w-full h-2 bg-outline-variant/30 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${summary.avgProgress}%` }} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-body-sm">
              <span className="text-on-surface-variant">{locale === 'vi' ? 'Task đã hoàn thành' : 'Tasks Completed'}</span>
              <span className="font-bold text-on-surface">{summary.tasksDone}/{summary.tasksTotal}</span>
            </div>
            <div className="w-full h-2 bg-outline-variant/30 rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all" style={{ width: `${summary.tasksTotal ? (summary.tasksDone / summary.tasksTotal * 100) : 0}%` }} />
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-4 pt-4 border-t border-outline-variant">
          <div className="flex items-center gap-1.5 text-body-sm">
            <span className="material-symbols-outlined text-amber-600 text-sm">pause_circle</span>
            <span className="text-on-surface-variant">{locale === 'vi' ? 'Tạm dừng:' : 'On Hold:'}</span>
            <span className="font-semibold text-amber-600">{summary.onHold}</span>
          </div>
          <div className="flex items-center gap-1.5 text-body-sm">
            <span className="material-symbols-outlined text-red-600 text-sm">schedule</span>
            <span className="text-on-surface-variant">{locale === 'vi' ? 'Sắp đến hạn:' : 'Near Deadline:'}</span>
            <span className="font-semibold text-red-600">{summary.nearDeadline}</span>
          </div>
        </div>
      </div>

      {showFilter && (
        <div className="flex flex-wrap items-center gap-3 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded text-sm">
            <span className="text-outline">{locale === 'vi' ? 'Trạng thái:' : 'Status:'}</span>
            <select
              className="font-semibold bg-transparent border-none focus:ring-0 outline-none pr-6"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="Tất cả">{locale === 'vi' ? 'Tất cả' : 'All'}</option>
              <option>Planning</option>
              <option>Active</option>
              <option>On Hold</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded text-sm">
            <span className="text-outline">{locale === 'vi' ? 'Loại:' : 'Type:'}</span>
            <select
              className="font-semibold bg-transparent border-none focus:ring-0 outline-none pr-6"
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            >
              <option value="Tất cả">{locale === 'vi' ? 'Tất cả' : 'All'}</option>
              <option>Internal</option>
              <option>Client</option>
              <option>Research</option>
            </select>
          </div>
          <button
            onClick={() => setFilters({ status: 'Tất cả', type: 'Tất cả' })}
            className="text-error font-semibold text-sm flex items-center gap-1 hover:underline"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            {locale === 'vi' ? 'Xóa lọc' : 'Clear Filters'}
          </button>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onEdit={setEditProject}
            onDelete={handleDelete}
          />
        ))}
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-32 text-on-surface-variant italic">
            {locale === 'vi' ? 'Không tìm thấy dự án nào' : 'No projects found'}
          </div>
        )}
      </div>

      {/* Create Project Popup */}
      {showCreateForm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowCreateForm(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-xl max-h-[90vh] overflow-y-auto z-50">
            <CreateProjectForm onClose={() => setShowCreateForm(false)} onSuccess={() => { setShowCreateForm(false); refreshProjects(); if (onProjectCreated) onProjectCreated(); }} />
          </div>
        </>
      )}

      {/* Edit Project Popup */}
      {editProject && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setEditProject(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-xl max-h-[90vh] overflow-y-auto z-50">
            <CreateProjectForm project={editProject} onClose={() => setEditProject(null)} onSuccess={() => { setEditProject(null); refreshProjects(); }} />
          </div>
        </>
      )}
    </div>
  );
}
