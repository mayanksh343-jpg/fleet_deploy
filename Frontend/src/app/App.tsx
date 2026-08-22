import { useState, useEffect } from 'react';
import { AppSidebar } from './components/AppSidebar';
import { AppHeader } from './components/AppHeader';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { VehicleRegistryPage } from './pages/VehicleRegistryPage';
import { TripDispatcherPage } from './pages/TripDispatcherPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { ExpensesPage } from './pages/ExpensesPage';
import { DriversPage } from './pages/DriversPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DriverDashboardPage } from './pages/DriverDashboardPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { ProfilePage } from './pages/ProfilePage';
import { GeofencePage } from './pages/GeofencePage';
import { DocumentsPage } from './pages/DocumentsPage';
import { useTheme } from './context/ThemeContext';
import api from './services/api';

type Page = 'login' | 'dashboard' | 'vehicles' | 'trips' | 'maintenance' | 'expenses' | 'drivers' | 'analytics' | 'driver-dashboard' | 'super-admin' | 'profile' | 'geofences' | 'documents';

const pageConfig = {
  dashboard: { title: 'Dashboard', component: DashboardPage },
  vehicles: { title: 'Vehicle Registry', component: VehicleRegistryPage },
  trips: { title: 'Trip Dispatcher', component: TripDispatcherPage },
  maintenance: { title: 'Maintenance & Service Logs', component: MaintenancePage },
  expenses: { title: 'Trip & Expense Logging', component: ExpensesPage },
  drivers: { title: 'Driver Performance & Safety', component: DriversPage },
  analytics: { title: 'Analytics & Financial Reports', component: AnalyticsPage },
  'driver-dashboard': { title: 'My Deliveries', component: DriverDashboardPage },
  'super-admin': { title: 'Admin Panel', component: SuperAdminPage },
  'profile': { title: 'Profile & Settings', component: ProfilePage },
  'geofences': { title: 'Geofencing & Zone Alerts', component: GeofencePage },
  'documents': { title: 'Document & License Center', component: DocumentsPage },
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ id: number; name: string; email: string; role: string; avatar_url?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme } = useTheme();

  // Auto-resume session from stored JWT token
  useEffect(() => {
    const resumeSession = async () => {
      if (api.auth.isLoggedIn()) {
        try {
          const result = await api.auth.me();
          setUser(result.user);
          setIsAuthenticated(true);
          setCurrentPage(result.user.role === 'Driver' ? 'driver-dashboard' : 'dashboard');
        } catch {
          // Access token expired — try silent refresh
          const refreshed = await api.auth.refresh();
          if (refreshed) {
            try {
              const result = await api.auth.me();
              setUser(result.user);
              setIsAuthenticated(true);
              setCurrentPage(result.user.role === 'Driver' ? 'driver-dashboard' : 'dashboard');
            } catch {
              await api.auth.logout();
            }
          } else {
            await api.auth.logout();
          }
        }
      }
      setLoading(false);
    };
    resumeSession();
  }, []);

  const handleLogin = (userData: { id: number; name: string; email: string; role: string; avatar_url?: string | null }) => {
    setUser(userData);
    setIsAuthenticated(true);
    setCurrentPage(userData.role === 'Driver' ? 'driver-dashboard' : 'dashboard');
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
    setCurrentPage('login');
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
  };

  // Loading spinner while checking token
  if (loading) {
    return (
      <div className={`${theme} min-h-screen bg-background flex items-center justify-center`}>
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated || currentPage === 'login') {
    return (
      <div className={`${theme} min-h-screen bg-background transition-colors duration-300`}>
        <LoginPage onLogin={handleLogin} />
      </div>
    );
  }

  // Get current page config
  const config = pageConfig[currentPage as keyof typeof pageConfig];
  const PageComponent = config?.component;

  return (
    <div className={`${theme} min-h-screen bg-background transition-colors duration-300`}>
      {/* Sidebar */}
      <AppSidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        userRole={user?.role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content — push right on desktop, full-width on mobile */}
      <div className="lg:ml-[260px] min-h-screen transition-[margin] duration-300">
        {/* Header */}
        <AppHeader
          title={config?.title || 'Dashboard'}
          user={user}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        />

        {/* Page Content */}
        <main className="p-4 lg:p-8">
          {PageComponent && <PageComponent />}
        </main>
      </div>
    </div>
  );
}
