import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import MainLayout from '@/app/layouts/MainLayout';
import ErrorBoundary from '@/app/layouts/ErrorBoundary';
import Login from '@/features/auth/pages/LoginPage';
import NotFound from '@/shared/components/feedback/NotFound';
import ProtectedRoute from '@/app/routes/ProtectedRoute';
import { useDashboard } from '@/shared/stores/DashboardContext';

const Dashboard = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const Tasks = lazy(() => import('@/features/tasks/pages/TasksPage'));
const ProjectsModule = lazy(() => import('@/features/projects/pages/ProjectsPage'));
const ProjectDetail = lazy(() => import('@/features/projects/pages/ProjectDetailPage'));
const LeadsKPIs = lazy(() => import('@/features/leads-kpis/pages/LeadsKpisPage'));
const ExpenseManagement = lazy(() => import('@/features/expense/pages/ExpensePage'));
const DataManagementPage = lazy(() => import('@/features/data-management/pages/DataManagementPage'));
const InventoryPage = lazy(() => import('@/features/inventory/pages/InventoryPage'));
const ApiDocs = lazy(() => import('@/features/api-docs/pages/ApiDocsPage'));
const AnonymousProfiles = lazy(() => import('@/features/profiles/pages/AnonymousProfiles'));
const IdentifiedProfiles = lazy(() => import('@/features/profiles/pages/IdentifiedProfiles'));
const CompanyMaster = lazy(() => import('@/features/profiles/pages/CompanyMaster'));
const SLAQueue = lazy(() => import('@/features/profiles/pages/SLAQueue'));

function LoadingFallback() {
  const { locale } = useDashboard();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080D1A] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">{{ vi: 'Đang tải...', en: 'Loading...' }[locale]}</p>
      </div>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout title="Dashboard Overview"><Dashboard /></MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/projects" element={
            <ProtectedRoute>
              <ProjectsModule />
            </ProtectedRoute>
          } />
          <Route path="/projects/:id" element={
            <ProtectedRoute>
              <ProjectDetail />
            </ProtectedRoute>
          } />
          <Route path="/tasks" element={
            <ProtectedRoute>
              <Tasks />
            </ProtectedRoute>
          } />
          <Route path="/leads" element={
            <ProtectedRoute>
              <LeadsKPIs />
            </ProtectedRoute>
          } />
          <Route path="/anonymous-profiles" element={
            <ProtectedRoute>
              <ErrorBoundary title="Hồ sơ ẩn danh"><MainLayout title="Hồ sơ ẩn danh"><AnonymousProfiles /></MainLayout></ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/identified-profiles" element={
            <ProtectedRoute>
              <ErrorBoundary title="Hồ sơ định danh"><MainLayout title="Hồ sơ định danh"><IdentifiedProfiles /></MainLayout></ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/company-master" element={
            <ProtectedRoute>
              <ErrorBoundary title="Company Master"><MainLayout title="Company Master"><CompanyMaster /></MainLayout></ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/sla-queue" element={
            <ProtectedRoute>
              <ErrorBoundary title="Hàng chờ SLA"><MainLayout title="Hàng chờ SLA"><SLAQueue /></MainLayout></ErrorBoundary>
            </ProtectedRoute>
          } />
          <Route path="/expense" element={
            <ProtectedRoute>
              <ExpenseManagement />
            </ProtectedRoute>
          } />
          <Route path="/data" element={
            <ProtectedRoute>
              <DataManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/inventory" element={
            <ProtectedRoute>
              <InventoryPage />
            </ProtectedRoute>
          } />
          <Route path="/api-docs" element={
            <ProtectedRoute>
              <ApiDocs />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
