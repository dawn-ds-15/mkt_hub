import { useEffect, useState } from 'react';
import { getProjects } from '../../services/api';
import ProjectCard from './ProjectCard';
import CreateProjectForm from './CreateProjectForm';
import PortfolioSummary from './PortfolioSummary';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjects().then((res) => {
      setProjects(res.data);
      setLoading(false);
    });
  }, []);

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
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Dự án Đang hoạt động</h3>
            <p className="text-body-md text-on-surface-variant">Quản lý và theo dõi các sáng kiến marketing đang triển khai.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 border border-outline-variant rounded-lg text-label-md font-semibold hover:bg-surface-container transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
              Bộ lọc
            </button>
            <button className="px-4 py-2 bg-primary text-on-primary rounded-lg text-label-md font-semibold hover:opacity-90 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Dự án Mới
            </button>
          </div>
        </header>
        <div className="space-y-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>
      <aside className="w-[360px] flex flex-col gap-gutter flex-shrink-0">
        <CreateProjectForm />
        <PortfolioSummary />
      </aside>
    </div>
  );
}
