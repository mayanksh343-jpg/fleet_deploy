import { useState, useEffect } from 'react';
import { Plus, Calendar, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import api from '../services/api';

const columns = [
  { key: 'id', label: 'Log ID', width: '10%' },
  { key: 'vehicle', label: 'Vehicle', width: '20%' },
  { key: 'description', label: 'Issue/Service', width: '30%' },
  { key: 'date', label: 'Date', width: '15%' },
  { key: 'cost', label: 'Cost ($)', width: '15%' },
  { key: 'vehicle_status', label: 'Vehicle Status', width: '10%' },
];

export function MaintenancePage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: '',
    description: '',
    cost: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const [logsData, vehiclesData] = await Promise.all([
        api.maintenance.list().catch(() => []),
        api.vehicles.list().catch(() => []),
      ]);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
    } catch (e) {
      console.error('Failed to load maintenance data:', e);
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
      await api.maintenance.create({
        vehicle_id: Number(formData.vehicle_id),
        description: formData.description,
        cost: Number(formData.cost),
      });
      setIsModalOpen(false);
      setFormData({ vehicle_id: '', description: '', cost: '' });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create maintenance log');
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

  // Build vehicle lookup map
  const vehicleMap: Record<number, any> = {};
  vehicles.forEach(v => { vehicleMap[v.id] = v; });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Maintenance & Service Logs</h2>
          <p className="text-sm text-muted-foreground">Track vehicle maintenance and repairs</p>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <Plus className="w-4 h-4 mr-2" />
              New Service Log
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Create New Service Log</DialogTitle>
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
                <label className="block text-sm font-medium text-foreground mb-2">Issue/Service Description</label>
                <Input
                  placeholder="e.g., Oil Change, Brake Replacement"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Cost ($)</label>
                <Input
                  type="number"
                  placeholder="e.g., 120"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
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

      {/* Maintenance Table */}
      <DataTable
        columns={columns}
        data={logs.map(log => ({
          ...log,
          vehicle: log.vehicle_model ? `${log.license_plate} — ${log.vehicle_model}` : `Vehicle #${log.vehicle_id}`,
          date: log.created_at ? new Date(log.created_at).toLocaleDateString() : '—',
          vehicle_status: vehicleMap[log.vehicle_id]?.status || '—',
        }))}
        renderCell={(column, row) => {
          if (column.key === 'vehicle_status') {
            return row.vehicle_status !== '—' ? <StatusBadge status={row.vehicle_status} /> : '—';
          }
          if (column.key === 'cost') {
            return `$${Number(row.cost).toLocaleString()}`;
          }
          return row[column.key];
        }}
      />
    </div>
  );
}
