import { DashboardProvider } from '@/shared/stores/DashboardContext';
import { ToastProvider } from '@/shared/stores/ToastContext';

export default function AppProviders({ children }) {
  return (
    <DashboardProvider>
      <ToastProvider>{children}</ToastProvider>
    </DashboardProvider>
  );
}
