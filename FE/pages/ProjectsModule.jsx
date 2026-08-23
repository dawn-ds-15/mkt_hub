import Layout from '../components/Layout';
import ProjectListTable from '../components/Projects/ProjectListTable';
import { useDashboard } from '../contexts/DashboardContext';

export default function ProjectsModule() {
  const { locale } = useDashboard();

  return (
    <Layout
      title={locale === 'vi' ? 'Dự án' : 'Projects'}
    >
      <div className="space-y-6">
        <ProjectListTable />
      </div>
    </Layout>
  );
}
