import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ProjectsTasks from './pages/ProjectsTasks';
import LeadsKPIs from './pages/LeadsKPIs';
import ExpenseManagement from './pages/ExpenseManagement';
import DataManagementPage from './pages/DataManagement';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout title="Dashboard Overview"><Dashboard /></Layout>} />
        <Route path="/projects" element={<ProjectsTasks />} />
        <Route path="/leads" element={<LeadsKPIs />} />
        <Route path="/expense" element={<ExpenseManagement />} />
        <Route path="/data" element={<DataManagementPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
