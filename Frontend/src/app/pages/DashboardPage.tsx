import { useState, useEffect } from 'react';
import { Truck, AlertTriangle, TrendingUp, Navigation, Loader2, DollarSign, Users, MapPin, Filter } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import api from '../services/api';

const tripColumns = [
  { key: 'id', label: 'Trip ID', width: '10%' },
  { key: 'vehicle', label: 'Vehicle', width: '18%' },
  { key: 'driver', label: 'Driver', width: '18%' },
  { key: 'route', label: 'Route', width: '24%' },
  { key: 'status', label: 'Status', width: '12%' },
  { key: 'revenue', label: 'Revenue', width: '10%' },
  { key: 'cargo_weight', label: 'Cargo (kg)', width: '8%' },
];

export function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');

  useEffect(() => {
    let mounted = true;
    async function load(isBackground = false) {
      if (!isBackground) setLoading(true);
      try {
        const [summaryData, tripsData, vehiclesData, regionsData] = await Promise.all([
          api.analytics.summary().catch(() => null),
          api.trips.list().catch(() => []),
          api.vehicles.list().catch(() => []),
          api.regions.list().catch(() => []),
        ]);
        if (!mounted) return;
        setSummary(summaryData);
        setTrips(Array.isArray(tripsData) ? tripsData.slice(0, 10) : []);
        setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
        setRegions(Array.isArray(regionsData) ? regionsData : []);
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();

    // Auto-refresh every 15 seconds
    const interval = setInterval(() => {
      load(true);
    }, 15000);

    // Refresh immediately when tab regains focus
    const onFocus = () => load(true);
    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = summary?.kpis || {};
  const revenue = summary?.revenue || 0;
  const profit = summary?.profit || 0;

  // Apply client-side filters to vehicles for filtered KPIs
  const filteredVehicles = vehicles.filter(v => {
    if (filterType !== 'all' && v.type !== filterType) return false;
    if (filterStatus !== 'all' && v.status !== filterStatus) return false;
    if (filterRegion !== 'all' && v.region_name !== filterRegion) return false;
    return true;
  });

  const isFiltering = filterType !== 'all' || filterStatus !== 'all' || filterRegion !== 'all';

  // If filtering, compute filtered KPIs; otherwise use server KPIs
  const totalVehicles = isFiltering ? filteredVehicles.length : (kpis.total_vehicles || 0);
  const onTrip = isFiltering ? filteredVehicles.filter(v => v.status === 'OnTrip').length : (kpis.on_trip || 0);
  const available = isFiltering ? filteredVehicles.filter(v => v.status === 'Available').length : (kpis.available || 0);
  const inShop = isFiltering ? filteredVehicles.filter(v => v.status === 'InShop').length : (kpis.in_shop || 0);
  const activeFleet = isFiltering ? filteredVehicles.filter(v => v.status !== 'Retired').length : (kpis.active_fleet || 0);
  const utilization = activeFleet > 0 ? Math.round((onTrip / activeFleet) * 10000) / 100 : 0;

  // Non-filterable KPIs
  const totalDrivers = kpis.total_drivers || 0;
  const pendingCount = kpis.pending_cargo || 0;
  const pendingWeight = kpis.pending_cargo_weight || 0;
  const completedTrips = kpis.completed_trips || 0;
  const dispatchedTrips = kpis.dispatched_trips || 0;

  // Get unique vehicle types
  const vehicleTypes = [...new Set(vehicles.map(v => v.type).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-[14px] p-4 transition-colors duration-300">
        <div className="flex flex-wrap items-center gap-3 lg:gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filters:</span>
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40 bg-background border-border text-foreground text-sm h-9">
              <SelectValue placeholder="Vehicle Type" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Types</SelectItem>
              {vehicleTypes.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 bg-background border-border text-foreground text-sm h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Available">Available</SelectItem>
              <SelectItem value="OnTrip">On Trip</SelectItem>
              <SelectItem value="InShop">In Shop</SelectItem>
              <SelectItem value="Retired">Retired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterRegion} onValueChange={setFilterRegion}>
            <SelectTrigger className="w-40 bg-background border-border text-foreground text-sm h-9">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map((r: any) => (
                <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isFiltering && (
            <button
              onClick={() => { setFilterType('all'); setFilterStatus('all'); setFilterRegion('all'); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded bg-secondary"
            >
              Clear All
            </button>
          )}
          {isFiltering && (
            <span className="text-xs text-muted-foreground ml-auto">
              Showing {filteredVehicles.length} of {vehicles.length} vehicles
            </span>
          )}
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          title="Active Fleet"
          value={String(activeFleet)}
          icon={Truck}
          trend={{ value: `${onTrip} on trip, ${available} available`, positive: true }}
          color="green"
        />
        <StatCard
          title="In Maintenance"
          value={String(inShop)}
          icon={AlertTriangle}
          trend={{ value: `${inShop} vehicles in shop`, positive: false }}
          color="yellow"
        />
        <StatCard
          title="Utilization Rate"
          value={`${utilization.toFixed(1)}%`}
          icon={TrendingUp}
          trend={{ value: `${onTrip} of ${activeFleet} deployed`, positive: utilization > 0 }}
          color="blue"
        />
        <StatCard
          title="Total Revenue"
          value={`$${revenue.toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: `$${profit.toLocaleString()} profit`, positive: profit > 0 }}
          color="green"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-card border border-border rounded-[14px] p-5 transition-colors duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-[#22C55E]/10 rounded-lg flex items-center justify-center">
              <Navigation className="w-4 h-4 text-[#22C55E]" />
            </div>
            <p className="text-sm text-muted-foreground">Completed Trips</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{completedTrips}</p>
        </div>
        <div className="bg-card border border-border rounded-[14px] p-5 transition-colors duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-[#3B82F6]/10 rounded-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <p className="text-sm text-muted-foreground">Active Dispatches</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{dispatchedTrips}</p>
        </div>
        <div className="bg-card border border-border rounded-[14px] p-5 transition-colors duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-[#A855F7]/10 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-[#A855F7]" />
            </div>
            <p className="text-sm text-muted-foreground">Total Drivers</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalDrivers}</p>
        </div>
        <div className="bg-card border border-border rounded-[14px] p-5 transition-colors duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-[#F59E0B]/10 rounded-lg flex items-center justify-center">
              <Truck className="w-4 h-4 text-[#F59E0B]" />
            </div>
            <p className="text-sm text-muted-foreground">Pending Cargo</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{pendingWeight.toLocaleString()} kg</p>
          <p className="text-xs text-muted-foreground mt-1">{pendingCount} shipments awaiting dispatch</p>
        </div>
      </div>

      {/* Recent Trips Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Recent Trips</h2>
            <p className="text-sm text-muted-foreground">Latest trip activity across your fleet</p>
          </div>
        </div>

        <DataTable
          columns={tripColumns}
          data={trips.map(t => ({
            id: t.id,
            vehicle: t.vehicle_model || `Vehicle #${t.vehicle_id}`,
            driver: t.driver_name || `Driver #${t.driver_id}`,
            route: `${(t.start_location || '').split(',')[0]} → ${(t.end_location || '').split(',')[0]}`,
            status: t.status,
            revenue: t.revenue ? `$${t.revenue.toLocaleString()}` : '—',
            cargo_weight: t.cargo_weight || '—',
          }))}
          renderCell={(column, row) => {
            if (column.key === 'status') {
              return <StatusBadge status={row.status} />;
            }
            return row[column.key];
          }}
        />
      </div>
    </div>
  );
}
