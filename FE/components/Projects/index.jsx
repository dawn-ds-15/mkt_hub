import { useEffect, useState } from 'react';
import { getProjects } from '../../services/api';
import ProjectCard from './ProjectCard';
import PortfolioSummary from './PortfolioSummary';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ status: 'Tất cả', type: 'Tất cả' });

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
        <p className="text-on-surface-variant">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="flex gap-gutter max-w-container_max_width mx-auto">
      <section className="flex-1 space-y-gutter">
        <header className="flex items-center justify-between mb-stack_lg">
          <div>
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Dự án</h3>
            <p className="text-body-md text-on-surface-variant">Quản lý và theo dõi các sáng kiến marketing đang triển khai.</p>
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="px-4 py-2 border border-outline-variant rounded-lg text-label-md font-semibold hover:bg-surface-container transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            Bộ lọc
          </button>
        </header>

        {showFilter && (
          <div className="flex flex-wrap items-center gap-3 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded text-sm">
              <span className="text-outline">Trạng thái:</span>
              <select
                className="font-semibold bg-transparent border-none focus:ring-0 outline-none pr-6"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option>Tất cả</option>
                <option>Planning</option>
                <option>Active</option>
                <option>On Hold</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </select>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded text-sm">
              <span className="text-outline">Loại:</span>
              <select
                className="font-semibold bg-transparent border-none focus:ring-0 outline-none pr-6"
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              >
                <option>Tất cả</option>
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
              Xóa lọc
            </button>
          </div>
        )}

        <div className="space-y-4">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {filtered.length === 0 && (
            <div className="flex items-center justify-center h-32 text-on-surface-variant italic">
              Không tìm thấy dự án nào
            </div>
          )}
        </div>
      </section>
      <aside className="w-[360px] flex flex-col gap-gutter flex-shrink-0">
        <PortfolioSummary />
      </aside>
    </div>
  );
}
