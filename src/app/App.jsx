import AppProviders from '@/app/providers/AppProviders';
import AppRoutes from '@/app/routes';

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
