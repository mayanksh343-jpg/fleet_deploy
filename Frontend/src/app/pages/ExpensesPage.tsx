import { useState, useEffect } from 'react';
import { Plus, DollarSign, Loader2, Fuel, Wrench } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { DataTable } from '../components/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import api from '../services/api';

const columns = [
  { key: 'id', label: 'Log ID', width: '10%' },
  { key: 'vehicle', label: 'Vehicle', width: '20%' },
  { key: 'liters', label: 'Liters', width: '12%' },
  { key: 'cost', label: 'Cost ($)', width: '12%' },
  { key: 'efficiency', label: 'Efficiency (km/L)', width: '15%' },
  { key: 'odometer_reading', label: 'Odometer', width: '15%' },
  { key: 'date', label: 'Date', width: '16%' },
];

const costColumns = [
  { key: 'vehicle', label: 'Vehicle', width: '25%' },
  { key: 'fuel_cost', label: 'Fuel Cost', width: '20%' },
  { key: 'maintenance_cost', label: 'Maintenance Cost', width: '20%' },
  { key: 'total_operational', label: 'Total Operational Cost', width: '20%' },
  { key: 'trips', label: 'Trips', width: '15%' },
];

export function ExpensesPage() {
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: '',
    liters: '',
    cost: '',
    odometer_reading: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const [fuelData, vehiclesData, maintData] = await Promise.all([
        api.fuel.list().catch(() => []),
        api.vehicles.list().catch(() => []),
        api.maintenance.list().catch(() => []),
      ]);
      setFuelLogs(Array.isArray(fuelData) ? fuelData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setMaintenanceLogs(Array.isArray(maintData) ? maintData : []);
    } catch (e) {
      console.error('Failed to load fuel data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.fuel.create({
        vehicle_id: Number(formData.vehicle_id),
        liters: Number(formData.liters),
        cost: Number(formData.cost),
        odometer_reading: formData.odometer_reading ? Number(formData.odometer_reading) : undefined,
      });
      setIsModalOpen(false);
      setFormData({ vehicle_id: '', liters: '', cost: '', odometer_reading: '' });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create fuel log');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Compute stats
  const totalFuelCost = fuelLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
  const totalLiters = fuelLogs.reduce((sum, l) => sum + (l.liters || 0), 0);
  // Weighted average: total_distance / total_liters (reconstructing distance as efficiency × liters)
  const totalWeightedDistance = fuelLogs.reduce((sum, l) => {
    if (l.efficiency && l.liters) return sum + (l.efficiency * l.liters);
    return sum;
  }, 0);
  const efficiencyLiters = fuelLogs.filter(l => l.efficiency && l.liters).reduce((sum, l) => sum + l.liters, 0);
  const avgEfficiency = efficiencyLiters > 0 && totalWeightedDistance > 0
    ? (totalWeightedDistance / efficiencyLiters).toFixed(1)
    : '—';
  const totalMaintenanceCost = maintenanceLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
  const totalOperational = totalFuelCost + totalMaintenanceCost;

  // Per-vehicle operational cost summary
  const vehicleCostMap: Record<number, { fuel: number; maintenance: number; trips: number }> = {};
  fuelLogs.forEach(l => {
    if (!vehicleCostMap[l.vehicle_id]) vehicleCostMap[l.vehicle_id] = { fuel: 0, maintenance: 0, trips: 0 };
    vehicleCostMap[l.vehicle_id].fuel += l.cost || 0;
  });
  maintenanceLogs.forEach(l => {
    if (!vehicleCostMap[l.vehicle_id]) vehicleCostMap[l.vehicle_id] = { fuel: 0, maintenance: 0, trips: 0 };
    vehicleCostMap[l.vehicle_id].maintenance += l.cost || 0;
  });

  const vehicleMap: Record<number, any> = {};
  vehicles.forEach(v => { vehicleMap[v.id] = v; });

  const perVehicleCosts = Object.entries(vehicleCostMap).map(([vid, costs]) => {
    const v = vehicleMap[Number(vid)];
    return {
      vehicle: v ? `${v.license_plate} — ${v.model}` : `Vehicle #${vid}`,
      fuel_cost: costs.fuel,
      maintenance_cost: costs.maintenance,
      total_operational: costs.fuel + costs.maintenance,
      trips: fuelLogs.filter(l => l.vehicle_id === Number(vid) && l.trip_id).length,
    };
  }).sort((a, b) => b.total_operational - a.total_operational);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-card border border-border rounded-[14px] p-6 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Fuel Costs</p>
              <p className="text-2xl font-bold text-foreground">${totalFuelCost.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{fuelLogs.length} records</p>
            </div>
            <div className="w-12 h-12 bg-[#FACC15]/10 rounded-lg flex items-center justify-center">
              <Fuel className="w-6 h-6 text-[#FACC15]" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-[14px] p-6 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Maintenance Costs</p>
              <p className="text-2xl font-bold text-foreground">${totalMaintenanceCost.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{maintenanceLogs.length} records</p>
            </div>
            <div className="w-12 h-12 bg-[#EF4444]/10 rounded-lg flex items-center justify-center">
              <Wrench className="w-6 h-6 text-[#EF4444]" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-[14px] p-6 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Operational Cost</p>
              <p className="text-2xl font-bold text-[#EF4444]">${totalOperational.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Fuel + Maintenance</p>
            </div>
            <div className="w-12 h-12 bg-[#A855F7]/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-[#A855F7]" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-[14px] p-6 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Avg Fuel Efficiency</p>
              <p className="text-2xl font-bold text-foreground">{avgEfficiency} km/L</p>
              <p className="text-xs text-muted-foreground mt-1">{totalLiters.toLocaleString()} L total</p>
            </div>
            <div className="w-12 h-12 bg-[#22C55E]/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-[#22C55E]" />
            </div>
          </div>
        </div>
      </div>

      {/* Per-Vehicle Cost Summary */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">Per-Vehicle Operational Costs</h2>
          <p className="text-sm text-muted-foreground">Total Fuel + Maintenance cost breakdown by vehicle</p>
        </div>
        <DataTable
          columns={costColumns}
          data={perVehicleCosts}
          renderCell={(column, row) => {
            if (column.key === 'fuel_cost') return <span className="text-[#FACC15]">${Number(row.fuel_cost).toLocaleString()}</span>;
            if (column.key === 'maintenance_cost') return <span className="text-[#EF4444]">${Number(row.maintenance_cost).toLocaleString()}</span>;
            if (column.key === 'total_operational') return <span className="font-bold text-foreground">${Number(row.total_operational).toLocaleString()}</span>;
            return row[column.key];
          }}
        />
      </div>

      {/* Fuel Log Header + Modal */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Fuel Log Records</h2>
          <p className="text-sm text-muted-foreground">Individual fuel entries with efficiency tracking</p>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <Plus className="w-4 h-4 mr-2" />
              Add Fuel Log
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Add Fuel Log</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {error && (
                <div className="bg-[#EF4444]/10 text-[#EF4444] px-4 py-2 rounded-lg text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Vehicle</label>
                <Select value={formData.vehicle_id} onValueChange={(value) => setFormData({ ...formData, vehicle_id: value })}>
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.license_plate} — {v.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Liters</label>
                <Input
                  type="number"
                  placeholder="e.g., 40"
                  value={formData.liters}
                  onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Cost ($)</label>
                <Input
                  type="number"
                  placeholder="e.g., 3200"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Odometer Reading</label>
                <Input
                  type="number"
                  placeholder="e.g., 45230"
                  value={formData.odometer_reading}
                  onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={submitting} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Log
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1 bg-transparent border-border text-foreground hover:bg-secondary">
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Fuel Logs Table */}
      <DataTable
        columns={columns}
        data={fuelLogs.map(log => ({
          ...log,
          vehicle: log.vehicle_model ? `${log.license_plate} — ${log.vehicle_model}` : `Vehicle #${log.vehicle_id}`,
        }))}
        renderCell={(column, row) => {
          if (column.key === 'cost') return `$${Number(row.cost).toLocaleString()}`;
          if (column.key === 'efficiency') return row.efficiency ? `${row.efficiency} km/L` : '—';
          if (column.key === 'odometer_reading') return row.odometer_reading ? row.odometer_reading.toLocaleString() : '—';
          if (column.key === 'liters') return Number(row.liters).toLocaleString();
          if (column.key === 'date') return row.date || '—';
          return row[column.key];
        }}
      />
    </div>
  );
}
