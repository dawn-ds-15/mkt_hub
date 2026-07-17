import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import ProjectsTasks from './pages/ProjectsTasks';
import LeadsKPIs from './pages/LeadsKPIs';
import ExpenseManagement from './pages/ExpenseManagement';
import DataManagementPage from './pages/DataManagement';
import ApiDocs from './pages/ApiDocs';
import { DashboardProvider } from './contexts/DashboardContext';
import { ToastProvider } from './contexts/ToastContext';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('mkt_hub_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
      <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout title="Dashboard Overview"><Dashboard /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/projects" element={
          <ProtectedRoute>
            <ProjectsTasks />
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
      </Routes>
      </ToastProvider>
      </DashboardProvider>
    </BrowserRouter>
  );
}

export default App;
