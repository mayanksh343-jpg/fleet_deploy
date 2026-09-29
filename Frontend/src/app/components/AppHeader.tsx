import { useState, useEffect, useRef } from 'react';
import { Search, Bell, User, LogOut, CheckCircle, AlertTriangle, Info, XCircle, Loader2, Menu, Truck, Navigation, Wrench, FileText, Settings, BarChart3, UserCheck, Clock } from 'lucide-react';
import { Input } from './ui/input';
import api from '../services/api';

interface AppHeaderProps {
  title: string;
  user?: { id: number; name: string; email: string; role: string; avatar_url?: string | null } | null;
  onLogout?: () => void;
  onNavigate?: (page: string) => void;
  onToggleSidebar?: () => void;
}

interface Notification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  time: string;
}

const typeIcons = {
  success: CheckCircle,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

const typeColors = {
  success: 'text-[#22C55E]',
  info: 'text-[#3B82F6]',
  warning: 'text-[#F59E0B]',
  error: 'text-[#EF4444]',
};

const typeBg = {
  success: 'bg-[#22C55E]/10',
  info: 'bg-[#3B82F6]/10',
  warning: 'bg-[#F59E0B]/10',
  error: 'bg-[#EF4444]/10',
};

// ── Static pages for search ────────────────────────
const PAGE_RESULTS = [
  { type: 'page', id: 'dashboard', title: 'Dashboard', subtitle: 'Overview & KPIs', icon: BarChart3 },
  { type: 'page', id: 'vehicles', title: 'Vehicle Registry', subtitle: 'Manage fleet vehicles', icon: Truck },
  { type: 'page', id: 'trips', title: 'Trip Dispatcher', subtitle: 'Create & manage trips', icon: Navigation },
  { type: 'page', id: 'maintenance', title: 'Maintenance & Service', subtitle: 'Service logs & scheduling', icon: Wrench },
  { type: 'page', id: 'expenses', title: 'Trip & Expense Logging', subtitle: 'Fuel costs & expenses', icon: FileText },
  { type: 'page', id: 'drivers', title: 'Driver Performance', subtitle: 'Driver stats & safety', icon: UserCheck },
  { type: 'page', id: 'analytics', title: 'Analytics & Reports', subtitle: 'Financial reports & CSV export', icon: BarChart3 },
  { type: 'page', id: 'profile', title: 'Profile & Settings', subtitle: 'Edit profile, theme, password', icon: Settings },
];

export function AppHeader({ title, user, onLogout, onNavigate, onToggleSidebar }: AppHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [notifLoading, setNotifLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ type: string; id: string | number; title: string; subtitle: string; icon?: any }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Load read notification IDs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('fleetflow_read_notifs');
    if (saved) {
      try { setReadIds(new Set(JSON.parse(saved))); } catch {}
    }
  }, []);

  // Close panels when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Global Search ──────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const query = searchQuery.toLowerCase();
        const results: { type: string; id: string | number; title: string; subtitle: string; icon?: any }[] = [];

        // 1. Page results (always instant)
        PAGE_RESULTS.forEach(p => {
          if (p.title.toLowerCase().includes(query) || p.subtitle.toLowerCase().includes(query)) {
            results.push(p);
          }
        });

        // 2. API data results (parallel fetch)
        const [vehiclesData, driversData, tripsData, maintenanceData] = await Promise.all([
          api.vehicles.list().catch(() => []),
          api.drivers.list().catch(() => []),
          api.trips.list().catch(() => []),
          api.maintenance.list().catch(() => []),
        ]);

        // Vehicles
        (Array.isArray(vehiclesData) ? vehiclesData : [])
          .filter((v: any) => v.model?.toLowerCase().includes(query) || v.license_plate?.toLowerCase().includes(query) || v.type?.toLowerCase().includes(query))
          .slice(0, 3)
          .forEach((v: any) => {
            results.push({ type: 'vehicle', id: v.id, title: `${v.license_plate} — ${v.model}`, subtitle: `Vehicle • ${v.type} • ${v.status}`, icon: Truck });
          });

        // Drivers
        (Array.isArray(driversData) ? driversData : [])
          .filter((d: any) => d.name?.toLowerCase().includes(query) || d.license_type?.toLowerCase().includes(query))
          .slice(0, 3)
          .forEach((d: any) => {
            results.push({ type: 'driver', id: d.id, title: d.name, subtitle: `Driver • ${d.status} • ${d.license_type || 'N/A'}`, icon: UserCheck });
          });

        // Trips
        (Array.isArray(tripsData) ? tripsData : [])
          .filter((t: any) =>
            t.start_location?.toLowerCase().includes(query) ||
            t.end_location?.toLowerCase().includes(query) ||
            t.status?.toLowerCase().includes(query) ||
            String(t.id).includes(query)
          )
          .slice(0, 3)
          .forEach((t: any) => {
            results.push({ type: 'trip', id: t.id, title: `Trip #${t.id} — ${t.status}`, subtitle: `${t.start_location || '?'} → ${t.end_location || '?'}`, icon: Navigation });
          });

        // Maintenance
        (Array.isArray(maintenanceData) ? maintenanceData : [])
          .filter((m: any) => m.description?.toLowerCase().includes(query) || m.vehicle_model?.toLowerCase().includes(query))
          .slice(0, 3)
          .forEach((m: any) => {
            results.push({ type: 'maintenance', id: m.id, title: m.description, subtitle: `Maintenance • ${m.vehicle_model || 'Vehicle #' + m.vehicle_id}`, icon: Wrench });
          });

        setSearchResults(results);
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSelectResult = (result: { type: string; id: string | number }) => {
    setShowSearch(false);
    setSearchQuery('');
    if (onNavigate) {
      if (result.type === 'page') onNavigate(result.id as string);
      else if (result.type === 'vehicle') onNavigate('vehicles');
      else if (result.type === 'driver') onNavigate('drivers');
      else if (result.type === 'trip') onNavigate('trips');
      else if (result.type === 'maintenance') onNavigate('maintenance');
    }
  };

  // ── Notifications ──────────────────────────────────
  const loadNotifications = async () => {
    setNotifLoading(true);
    try {
      const data = await api.notifications.list();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleToggleNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next) loadNotifications();
  };

  const markAsRead = (id: string) => {
    const newSet = new Set(readIds);
    newSet.add(id);
    setReadIds(newSet);
    localStorage.setItem('fleetflow_read_notifs', JSON.stringify([...newSet]));
  };

  const markAllRead = () => {
    const newSet = new Set(readIds);
    notifications.forEach(n => newSet.add(n.id));
    setReadIds(newSet);
    localStorage.setItem('fleetflow_read_notifs', JSON.stringify([...newSet]));
  };

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  return (
    <header className="h-16 bg-card border-b border-border px-4 lg:px-8 flex items-center justify-between transition-colors duration-300">
      {/* Hamburger + Page Title */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden w-10 h-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        <h1 className="text-lg lg:text-2xl font-bold text-foreground truncate">{title}</h1>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Global Search */}
        <div className="relative w-80 hidden md:block" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search anything..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearch(true);
            }}
            onFocus={() => {
              if (searchQuery.trim()) setShowSearch(true);
            }}
            className="pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
          {showSearch && searchQuery.trim() && (
            <div className="absolute left-0 top-12 w-full bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="max-h-96 overflow-y-auto py-2">
                {isSearching ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    No results for "{searchQuery}"
                  </div>
                ) : (
                  <>
                    {searchResults.map((result, idx) => {
                      const Icon = result.icon || Search;
                      return (
                        <div
                          key={`${result.type}-${result.id}-${idx}`}
                          onClick={() => handleSelectResult(result)}
                          className="px-4 py-2.5 hover:bg-secondary/50 transition-colors cursor-pointer flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={handleToggleNotifications}
            className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors relative cursor-pointer"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
              </div>
            )}
          </button>

          {/* Notification Panel */}
          {showNotifications && (
            <div className="absolute right-0 top-12 w-[calc(100vw-2rem)] sm:w-96 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">Notifications</h3>
                  <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No notifications
                  </div>
                ) : (
                  notifications.map((n) => {
                    const Icon = typeIcons[n.type] || Info;
                    const isRead = readIds.has(n.id);
                    return (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`px-4 py-3 border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer ${isRead ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg ${typeBg[n.type]} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                            <Icon className={`w-4 h-4 ${typeColors[n.type]}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium text-foreground ${isRead ? '' : 'font-semibold'}`}>{n.title}</p>
                              {!isRead && <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {n.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Info + Logout */}
        {user && (
          <div className="flex items-center gap-2 lg:gap-3 pl-2 border-l border-border">
            <button
              onClick={() => onNavigate?.('profile')}
              className="flex items-center gap-2 lg:gap-3 hover:opacity-80 transition-opacity cursor-pointer"
              title="View Profile"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-foreground leading-tight">{user.name}</p>
                <p className="text-xs text-muted-foreground leading-tight">{user.role}</p>
              </div>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                  <User className="w-5 h-5 text-primary-foreground" />
                </div>
              )}
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-[#EF4444]/20 hover:text-[#EF4444] transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
