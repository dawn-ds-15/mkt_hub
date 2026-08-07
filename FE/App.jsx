import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import NotFound from './components/NotFound';
import { DashboardProvider, useDashboard } from './contexts/DashboardContext';
import { ToastProvider } from './contexts/ToastContext';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const ProjectsModule = lazy(() => import('./pages/ProjectsModule'));
const LeadsKPIs = lazy(() => import('./pages/LeadsKPIs'));
const ExpenseManagement = lazy(() => import('./pages/ExpenseManagement'));
const DataManagementPage = lazy(() => import('./pages/DataManagement'));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('mkt_hub_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function LoadingFallback() {
  const { locale } = useDashboard();
  return (
    <div className="min-h-screen bg-sidebar-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-on-surface-variant text-sm">{{ vi: 'Đang tải...', en: 'Loading...' }[locale]}</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
      <ToastProvider>
      <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout title="Dashboard Overview"><Dashboard /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/projects" element={
          <ProtectedRoute>
            <ProjectsModule />
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
        <Route path="/api-docs" element={
          <ProtectedRoute>
            <ApiDocs />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </ToastProvider>
      </DashboardProvider>
    </BrowserRouter>
  );
}

export default App;
