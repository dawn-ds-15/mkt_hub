import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';

export default function NotFound() {
  const { locale } = useDashboard();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080D1A] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-headline-lg font-headline-lg text-slate-900 mb-2">404</h1>
        <p className="text-body-md text-slate-500 mb-8">
          {{ vi: 'Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển.', en: 'The page you are looking for does not exist or has been moved.' }[locale]}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-brand-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-brand-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {{ vi: 'Về trang chủ', en: 'Back to Home' }[locale]}
        </Link>
      </div>
    </div>
  );
}
