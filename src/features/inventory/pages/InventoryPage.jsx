import Layout from '@/app/layouts/MainLayout';
import InventoryManagement from '@/features/inventory/components';
import { useDashboard } from '@/shared/stores/DashboardContext';

export default function InventoryPage() {
  const { locale } = useDashboard();
  return (
    <Layout title={locale === 'vi' ? 'Kho vật phẩm' : 'Inventory'}>
      <InventoryManagement />
    </Layout>
  );
}
