import { Link } from 'react-router-dom';
import { useDashboard } from '../../contexts/DashboardContext';

export default function NotFound() {
  const { locale } = useDashboard();
  return (
    <div className="min-h-screen bg-sidebar-bg flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-5xl text-danger">error_outline</span>
        </div>
        <h1 className="text-headline-lg font-headline-lg text-on-surface mb-2">404</h1>
        <p className="text-body-md text-on-surface-variant mb-8">
          {{ vi: 'Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển.', en: 'The page you are looking for does not exist or has been moved.' }[locale]}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-lg hover:bg-primary-container transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          {{ vi: 'Về trang chủ', en: 'Back to Home' }[locale]}
        </Link>
      </div>
    </div>
  );
}
