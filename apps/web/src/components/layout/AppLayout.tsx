import { Outlet, Navigate } from 'react-router-dom';
import GNB from './GNB';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../stores/authStore';

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-[#0d6b7f] overflow-hidden">
      {/* Global Navigation Bar */}
      <GNB />

      {/* Body: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
