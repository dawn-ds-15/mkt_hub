import Layout from '../components/Layout';
import InventoryManagement from '../components/InventoryManagement';
import { useDashboard } from '../contexts/DashboardContext';

export default function InventoryPage() {
  const { locale } = useDashboard();
  return (
    <Layout title={locale === 'vi' ? 'Kho vật phẩm' : 'Inventory'}>
      <InventoryManagement />
    </Layout>
  );
}
