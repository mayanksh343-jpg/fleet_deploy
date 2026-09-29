import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Fuel, Loader2, Truck, Users, FileText, Building2, MapPin, Phone, Mail, Globe } from 'lucide-react';
import { Button } from '../components/ui/button';
import { StatCard } from '../components/StatCard';
import { DataTable } from '../components/DataTable';
import { useTheme } from '../context/ThemeContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

export function AnalyticsPage() {
  const { theme } = useTheme();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [driversList, setDriversList] = useState<any[]>([]);
  const [tripsList, setTripsList] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [vehicleHistory, setVehicleHistory] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load(isBackground = false) {
      if (!isBackground) setLoading(true);
      try {
        const [summaryData, vehiclesData, driversData, tripsData] = await Promise.all([
          api.analytics.summary().catch(() => null),
          api.vehicles.list().catch(() => []),
          api.drivers.list().catch(() => []),
          api.trips.list().catch(() => []),
        ]);
        if (!mounted) return;
        setSummary(summaryData);
        const vList = Array.isArray(vehiclesData) ? vehiclesData : [];
        setVehicles(vList);
        setDriversList(Array.isArray(driversData) ? driversData : []);
        setTripsList(Array.isArray(tripsData) ? tripsData : []);
        // Only set default selected vehicle on initial load to avoid jumping state
        if (!isBackground && vList.length > 0 && !selectedVehicleId) {
          setSelectedVehicleId(vList[0].id);
        }
      } catch (e) {
        console.error('Analytics load error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();

    const interval = setInterval(() => load(true), 15000);
    const onFocus = () => load(true);
    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Fetch vehicle history when selected vehicle changes
  useEffect(() => {
    if (!selectedVehicleId) return;
    api.analytics.vehicleHistory(selectedVehicleId)
      .then(data => setVehicleHistory(data))
      .catch(() => setVehicleHistory(null));
  }, [selectedVehicleId]);

  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#18181B' : '#FFFFFF',
    border: `1px solid ${theme === 'dark' ? '#27272A' : '#E2E8F0'}`,
    borderRadius: '8px',
    color: theme === 'dark' ? '#FFFFFF' : '#0F172A',
  };

  const gridStroke = theme === 'dark' ? '#27272A' : '#E2E8F0';
  const axisStroke = theme === 'dark' ? '#A1A1AA' : '#64748B';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Map data from the updated backend response
  const kpis = summary?.kpis || {};
  const totalRevenue = summary?.revenue || 0;
  const fuelCost = summary?.costs?.fuel_cost || 0;
  const maintenanceCost = summary?.costs?.maintenance_cost || 0;
  const totalCost = summary?.costs?.total_operational_cost || 0;
  const profit = summary?.profit || 0;
  const utilization = kpis.utilization_rate_percent ?? 0;
  const completedTrips = kpis.completed_trips || 0;
  const totalVehicles = kpis.total_vehicles || 0;
  const onTrip = kpis.on_trip || 0;
  const totalDrivers = kpis.total_drivers || 0;

  // Fleet-wide monthly revenue trend
  const monthlyRevenueData = summary?.monthly_revenue?.map((m: any) => ({
    month: m.month,
    revenue: m.revenue,
    trips: m.trips,
  })) || [];

  // Vehicle-specific revenue trend
  const vehicleRevenueData = vehicleHistory?.monthly_revenue?.map((m: any) => ({
    month: m.month,
    revenue: m.revenue,
  })) || [];

  // Regional utilization for bar chart
  const regionalData = summary?.regional_metrics?.utilization?.map((r: any) => ({
    region: r.region,
    utilization: r.utilization_rate_percent || 0,
    vehicles: r.total_vehicles || 0,
  })) || [];

  // Financial report table
  const financialColumns = [
    { key: 'metric', label: 'Metric', width: '40%' },
    { key: 'value', label: 'Value', width: '60%' },
  ];

  const financialData = [
    { metric: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}` },
    { metric: 'Total Fuel Cost', value: `$${fuelCost.toLocaleString()}` },
    { metric: 'Total Maintenance Cost', value: `$${maintenanceCost.toLocaleString()}` },
    { metric: 'Total Operational Cost', value: `$${totalCost.toLocaleString()}` },
    { metric: 'Net Profit', value: `$${profit.toLocaleString()}` },
    { metric: 'Completed Trips', value: `${completedTrips}` },
    { metric: 'Active Vehicles', value: `${totalVehicles} (${onTrip} on trip)` },
    { metric: 'Fleet Utilization', value: `${utilization.toFixed(1)}%` },
    { metric: 'Total Drivers', value: `${totalDrivers}` },
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      const csvText = await api.analytics.export();
      const blob = new Blob([csvText as unknown as string], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleetflow-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // --- Reusable Print Subcomponents ---
  const PrintHeader = ({ title, fullHeader = false }: { title: string, fullHeader?: boolean }) => (
    <>
      <div className={`flex justify-between items-start border-b-[3px] border-black ${fullHeader ? 'pb-4 mb-6' : 'pb-2 mb-4'} pt-2`}>
        <div className="flex items-center gap-4">
          <div className={`${fullHeader ? 'w-16 h-16' : 'w-10 h-10'} bg-white border-2 border-green-600 rounded-lg flex items-center justify-center mb-1`}>
            <Truck className={`${fullHeader ? 'w-10 h-10' : 'w-6 h-6'} text-green-700`} strokeWidth={2} />
          </div>
          <div>
            <h1 className={`${fullHeader ? 'text-3xl' : 'text-xl'} font-bold text-green-700 uppercase tracking-tight m-0 leading-none`}>FleetFlow</h1>
            {fullHeader && (
              <>
                <h2 className="text-lg font-bold text-black uppercase tracking-widest mt-1">Management Systems</h2>
                <p className="text-sm font-medium text-gray-700 mt-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> 123 Logistics Blvd, Port City
                </p>
                <p className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> +1 (555) 123-4567 | <Globe className="w-3 h-3 ml-1" /> www.fleetflow.com
                </p>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <h1 className={`${fullHeader ? 'text-2xl' : 'text-xl'} font-bold text-black uppercase mb-1`}>{title}</h1>
          <p className="font-bold text-xs">ORIGINAL FOR RECIPIENT</p>
          {!fullHeader && <p className="text-[10px] text-gray-500 mt-1">Report: REP-{new Date().getTime().toString().slice(-6)}</p>}
        </div>
      </div>

      {fullHeader && (
        <div className="border-[2px] border-black flex mb-6 text-sm">
          <div className="w-1/2 border-r-[2px] border-black p-3">
            <h3 className="font-bold border-b border-gray-300 pb-1 mb-2">Internal Fleet Details</h3>
            <table className="w-full text-xs">
              <tbody>
                <tr><td className="w-24 font-bold py-1">Department</td><td>Operations & Logistics</td></tr>
                <tr><td className="w-24 font-bold py-1">Manager</td><td>Authorized Dispatcher</td></tr>
                <tr><td className="w-24 font-bold py-1">Active Fleet</td><td>{totalVehicles} units ({onTrip} on route)</td></tr>
                <tr><td className="w-24 font-bold py-1">Drivers</td><td>{totalDrivers} registered</td></tr>
              </tbody>
            </table>
          </div>
          <div className="w-1/2 p-3">
            <h3 className="font-bold border-b border-gray-300 pb-1 mb-2">Report Details</h3>
            <table className="w-full text-xs">
              <tbody>
                <tr><td className="w-24 font-bold py-1">Report No:</td><td>REP-{new Date().getTime().toString().slice(-6)}</td></tr>
                <tr><td className="w-24 font-bold py-1">Date:</td><td>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')}</td></tr>
                <tr><td className="w-24 font-bold py-1">Time:</td><td>{new Date().toLocaleTimeString()}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );

  const PrintFooter = () => (
    <>
      <div className="border-[2px] border-black flex flex-col text-xs mt-auto page-break-inside-avoid shadow-sm">
        <div className="p-2 border-b border-black">
          <p className="font-bold mb-1">Terms and Conditions</p>
          <ul className="list-disc pl-4 text-[10px] text-gray-700">
            <li>Information restricted to authorized internal FleetFlow management only.</li>
            <li>Generated metrics are based on completed trips and logged invoices up to {new Date().toLocaleDateString('en-GB')}.</li>
          </ul>
        </div>
        <div className="flex h-16 relative">
          <div className="w-1/2 p-2 relative">
             <p className="font-bold text-gray-500 text-[10px]">Auditor Signature</p>
          </div>
          <div className="w-1/2 p-2 text-right relative border-l border-black">
             <p className="font-bold text-gray-500 text-[10px] absolute bottom-2 right-2">Authorised Signatory</p>
          </div>
        </div>
      </div>
      <div className="text-center text-[10px] text-gray-500 mt-2 pb-2">
        Generated by FleetFlow Automotive Analysis Software. E & O.E
      </div>
    </>
  );

  return (
    <>
      {/* ─── PRINT ONLY: FORMAL INVOICE/AUDIT SHEET LAYOUT ─── */}
      <div className="hidden print:block w-full text-black font-sans bg-white">
        
        {/* ================= PAGE 1 ================= */}
        <div className="flex flex-col break-after-page mb-8">
          <PrintHeader title="Financial Report" fullHeader={true} />

          {/* Financial Data Table Header */}
          <div className="border-[2px] border-black border-b-0 flex font-bold text-xs bg-gray-100 text-center">
            <div className="w-12 border-r border-black py-2">Sr. No.</div>
            <div className="w-1/3 border-r border-black py-2 text-left px-2 flex items-center">Metric / Description</div>
            <div className="w-1/6 border-r border-black py-2 flex items-center justify-center">Target</div>
            <div className="w-1/6 border-r border-black py-2 flex items-center justify-center">Variance</div>
            <div className="flex-1 py-2 flex items-center justify-center">Total Value</div>
          </div>
          
          {/* Financial Data Table Body */}
          <div className="border-[2px] border-black mb-6 text-sm">
            <div className="flex border-b border-black">
              <div className="w-12 border-r border-black text-center py-2">1</div>
              <div className="w-1/3 border-r border-black px-2 py-2 font-semibold">Total Gross Revenue</div>
              <div className="w-1/6 border-r border-black text-center py-2 text-gray-500">N/A</div>
              <div className="w-1/6 border-r border-black text-center py-2 text-gray-500">-</div>
              <div className="flex-1 text-right px-2 py-2 font-bold text-green-700">${totalRevenue.toLocaleString()}</div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-12 border-r border-black text-center py-2">2</div>
              <div className="w-1/3 border-r border-black px-2 py-2 font-semibold">Fuel Expenditures</div>
              <div className="w-1/6 border-r border-black text-center py-2 text-gray-500">N/A</div>
              <div className="w-1/6 border-r border-black text-center py-2 text-gray-500">-</div>
              <div className="flex-1 text-right px-2 py-2 text-red-700">${fuelCost.toLocaleString()}</div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-12 border-r border-black text-center py-2">3</div>
              <div className="w-1/3 border-r border-black px-2 py-2 font-semibold">Maintenance Expenditures</div>
              <div className="w-1/6 border-r border-black text-center py-2 text-gray-500">N/A</div>
              <div className="w-1/6 border-r border-black text-center py-2 text-gray-500">-</div>
              <div className="flex-1 text-right px-2 py-2 text-red-700">${maintenanceCost.toLocaleString()}</div>
            </div>
            
            {/* Totals Row with Aligned Columns */}
            <div className="flex bg-gray-50 border-t-[2px] border-black font-bold">
              <div className="w-12 border-r border-black py-2 text-center bg-gray-100"></div>
              <div className="flex-1 text-right px-4 py-2 border-r border-black bg-gray-100">Net Fleet Profit (Revenue - Operations)</div>
              <div className="w-[185px] text-right px-2 py-2 text-lg text-green-800">${profit.toLocaleString()}</div>
            </div>
          </div>

          {/* Charts Container - Strictly Sized for Print */}
          {/* Note: animation deactivated via isAnimationActive={false} to ensure instant svg render for print buffer */}
          {/* Force fixed width/height. ResponsiveContainer outputs 0 when parent is display:none */}
          <div className="mb-6 grid grid-cols-2 gap-4 h-[220px] overflow-hidden page-break-inside-avoid">
              <div className="border border-black p-2 h-full flex flex-col items-center justify-center">
                <h4 className="font-bold text-xs text-center border-b border-black w-full pb-1 mb-2">Monthly Revenue Tracking ($)</h4>
                  <BarChart width={320} height={160} data={monthlyRevenueData.slice(-6)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#000" fontSize={10} tick={{fill: '#000'}} />
                    <YAxis stroke="#000" fontSize={10} tick={{fill: '#000'}} width={40} />
                    <Bar dataKey="revenue" fill="#16a34a" isAnimationActive={false} />
                  </BarChart>
              </div>
              <div className="border border-black p-2 h-full flex flex-col items-center justify-center">
                <h4 className="font-bold text-xs text-center border-b border-black w-full pb-1 mb-2">Regional Distribution Count</h4>
                  <BarChart width={320} height={160} data={regionalData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="region" stroke="#000" fontSize={10} tick={{fill: '#000'}} />
                    <YAxis stroke="#000" fontSize={10} tick={{fill: '#000'}} width={20} />
                    <Bar dataKey="vehicles" fill="#2563eb" isAnimationActive={false} />
                  </BarChart>
              </div>
          </div>
          
          <PrintFooter />
        </div>

        {/* ================= PAGE 2 (Dynamic Length) ================= */}
        <div className="flex flex-col break-after-page mb-8">
          <PrintHeader title="Vehicle Registry" fullHeader={false} />
          
          <div className="border-[2px] border-black text-xs mb-6">
            <div className="flex font-bold bg-gray-100 border-b border-black text-center">
              <div className="w-12 border-r border-black py-2">ID</div>
              <div className="w-1/4 border-r border-black py-2 text-left px-2 flex items-center">License Plate</div>
              <div className="w-1/4 border-r border-black py-2 text-left px-2 flex items-center">Model</div>
              <div className="w-1/6 border-r border-black py-2 flex items-center justify-center">Status</div>
              <div className="flex-1 py-2 flex items-center justify-center">Odometer (km)</div>
            </div>
            {vehicles.map((v, i) => (
              <div key={v.id} className="flex border-b border-black last:border-0 page-break-inside-avoid">
                <div className="w-12 border-r border-black text-center py-2">{v.id}</div>
                <div className="w-1/4 border-r border-black px-2 py-2 font-mono uppercase font-bold text-slate-700">{v.license_plate}</div>
                <div className="w-1/4 border-r border-black px-2 py-2 truncate">{v.model}</div>
                <div className="w-1/6 border-r border-black text-center py-2 font-semibold capitalize">{v.status.replace('_', ' ')}</div>
                <div className="flex-1 text-center py-2">{v.odometer?.toLocaleString() || 'N/A'}</div>
              </div>
            ))}
            {vehicles.length === 0 && (
              <div className="text-center py-4 text-gray-500 italic bg-gray-50">No vehicle data logged.</div>
            )}
          </div>
          
          <PrintFooter />
        </div>

        {/* ================= PAGE 3 (Dynamic Length) ================= */}
        <div className="flex flex-col break-after-page mb-8">
          <PrintHeader title="Driver Roster" fullHeader={false} />
          
          <div className="border-[2px] border-black text-xs mb-6">
            <div className="flex font-bold bg-gray-100 border-b border-black text-center">
              <div className="w-12 border-r border-black py-2">ID</div>
              <div className="flex-1 border-r border-black py-2 text-left px-2 flex items-center">Driver Name</div>
              <div className="w-1/4 border-r border-black py-2 flex items-center justify-center">License Number</div>
              <div className="w-1/4 border-r border-black py-2 flex items-center justify-center">License Type</div>
              <div className="w-1/6 py-2 flex items-center justify-center">Status</div>
            </div>
            {driversList.map((d, i) => (
              <div key={d.id} className="flex border-b border-black last:border-0 page-break-inside-avoid">
                <div className="w-12 border-r border-black text-center py-2">{d.id}</div>
                <div className="flex-1 border-r border-black px-2 py-2 font-semibold">{d.name}</div>
                <div className="w-1/4 border-r border-black text-center py-2 font-mono uppercase">{d.license_number || 'N/A'}</div>
                <div className="w-1/4 border-r border-black text-center py-2">{d.license_type || 'N/A'}</div>
                <div className="w-1/6 text-center py-2 font-semibold capitalize">{d.status?.replace('_', ' ') || 'Active'}</div>
              </div>
            ))}
            {driversList.length === 0 && (
              <div className="text-center py-4 text-gray-500 italic bg-gray-50">No driver data logged.</div>
            )}
          </div>
          
          <PrintFooter />
        </div>

        {/* ================= PAGE 4 (Dynamic Length) ================= */}
        <div className="flex flex-col mb-8">
          <PrintHeader title="Dispatch Logs" fullHeader={false} />
          
          <div className="border-[2px] border-black text-[11px] mb-6">
            <div className="flex font-bold bg-gray-100 border-b border-black text-center">
              <div className="w-10 border-r border-black py-2 flex items-center justify-center">ID</div>
              <div className="w-1/6 border-r border-black py-2 flex items-center justify-center">Veh. ID</div>
              <div className="w-1/5 border-r border-black py-2 flex items-center justify-center text-left px-2">Origin</div>
              <div className="w-1/5 border-r border-black py-2 flex items-center justify-center text-left px-2">Destination</div>
              <div className="w-1/6 border-r border-black py-2 flex items-center justify-center">Cargo (kg)</div>
              <div className="flex-1 py-2 flex items-center justify-center">Status</div>
            </div>
            {tripsList.map((t, i) => (
              <div key={t.id} className="flex border-b border-black last:border-0 page-break-inside-avoid">
                <div className="w-10 border-r border-black text-center py-2">{t.id}</div>
                <div className="w-1/6 border-r border-black text-center py-2 font-mono font-bold">V-{t.vehicle_id}</div>
                <div className="w-1/5 border-r border-black px-2 py-2 truncate">{t.start_location || 'Depot'}</div>
                <div className="w-1/5 border-r border-black px-2 py-2 truncate">{t.end_location || 'TBD'}</div>
                <div className="w-1/6 border-r border-black text-center py-2 font-semibold">{t.cargo_weight?.toLocaleString() || 0}</div>
                <div className="flex-1 text-center py-2 font-bold uppercase tracking-wider text-[10px]">{t.status.replace('_', ' ')}</div>
              </div>
            ))}
            {tripsList.length === 0 && (
              <div className="text-center py-4 text-gray-500 italic bg-gray-50">No trip data logged.</div>
            )}
          </div>
          
          <PrintFooter />
        </div>

      </div>


      {/* ─── SCREEN ONLY: INTERACTIVE UI DASHBOARD ─── */}
      <div className="space-y-6 print:hidden">

      {/* Header with Export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Analytics & Financial Reports</h2>
          <p className="text-sm text-muted-foreground">Track performance and ROI across the fleet</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button
            onClick={() => window.print()}
            className="bg-secondary hover:bg-muted text-foreground font-semibold"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={exporting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
          Download CSV Report
        </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          title="Total Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: `${completedTrips} completed trips`, positive: true }}
          color="green"
        />
        <StatCard
          title="Net Profit"
          value={`$${profit.toLocaleString()}`}
          icon={TrendingUp}
          trend={{ value: `${((profit / (totalRevenue || 1)) * 100).toFixed(0)}% margin`, positive: profit > 0 }}
          color={profit > 0 ? 'green' : 'yellow'}
        />
        <StatCard
          title="Operational Costs"
          value={`$${totalCost.toLocaleString()}`}
          icon={Fuel}
          trend={{ value: `Fuel: $${fuelCost.toLocaleString()} | Maint: $${maintenanceCost.toLocaleString()}`, positive: false }}
          color="yellow"
        />
        <StatCard
          title="Fleet Utilization"
          value={`${utilization.toFixed(1)}%`}
          icon={Truck}
          trend={{ value: `${onTrip} of ${kpis.active_fleet || totalVehicles} active, on trip`, positive: utilization > 10 }}
          color="blue"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Monthly Revenue Trend */}
        <div className="bg-card border border-border rounded-[14px] p-4 lg:p-6 transition-colors duration-300">
          <h3 className="text-lg font-semibold text-foreground mb-4">Monthly Revenue Trend</h3>
          {monthlyRevenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="month" stroke={axisStroke} />
                <YAxis stroke={axisStroke} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="revenue" fill="#22C55E" radius={[8, 8, 0, 0]} name="Revenue ($)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No revenue data yet
            </div>
          )}
        </div>

        {/* Regional Utilization */}
        <div className="bg-card border border-border rounded-[14px] p-4 lg:p-6 transition-colors duration-300">
          <h3 className="text-lg font-semibold text-foreground mb-4">Regional Fleet Distribution</h3>
          {regionalData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={regionalData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="region" stroke={axisStroke} />
                <YAxis stroke={axisStroke} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="vehicles" fill="#3B82F6" radius={[8, 8, 0, 0]} name="Vehicles" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No regional data available
            </div>
          )}
        </div>
      </div>

      {/* Vehicle-Specific Revenue Trend */}
      <div className="bg-card border border-border rounded-[14px] p-6 transition-colors duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
          <h3 className="text-lg font-semibold text-foreground">Vehicle Revenue Trend</h3>
          <select
            value={selectedVehicleId || ''}
            onChange={(e) => setSelectedVehicleId(Number(e.target.value))}
            className="text-sm bg-background border border-border rounded-md px-3 py-1.5 text-foreground"
          >
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.license_plate} — {v.model}</option>
            ))}
          </select>
        </div>
        {vehicleRevenueData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={vehicleRevenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="month" stroke={axisStroke} />
              <YAxis stroke={axisStroke} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="revenue" stroke="#A855F7" strokeWidth={2} dot={{ fill: '#A855F7', r: 4 }} name="Revenue ($)" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No historical data for this vehicle
          </div>
        )}
      </div>

      {/* Financial Table */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">Financial Overview</h2>
          <p className="text-sm text-muted-foreground">Key financial metrics from your fleet</p>
        </div>

        <DataTable
          columns={financialColumns}
          data={financialData}
          renderCell={(column, row) => {
            if (column.key === 'value') {
              if (row.metric.includes('Profit') || row.metric.includes('Revenue')) {
                return <span className="text-[#22C55E] font-semibold">{row.value}</span>;
              }
              if (row.metric.includes('Cost')) {
                return <span className="text-[#EF4444]">{row.value}</span>;
              }
              return <span className="font-semibold text-foreground">{row.value}</span>;
            }
            return row[column.key];
          }}
        />
      </div>
      {/* End Screen Container */}
      </div>
    </>
  );
}
