import { useState, useEffect } from 'react';
import { Plus, Search, Filter, ArrowUpDown, MoreVertical, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import api from '../services/api';

const columns = [
  { key: 'id', label: 'ID', width: '8%' },
  { key: 'license_plate', label: 'Plate', width: '15%' },
  { key: 'model', label: 'Model', width: '20%' },
  { key: 'type', label: 'Type', width: '12%' },
  { key: 'max_capacity', label: 'Capacity (kg)', width: '13%' },
  { key: 'odometer', label: 'Odometer (km)', width: '13%' },
  { key: 'status', label: 'Status', width: '14%' },
  { key: 'actions', label: '', width: '5%' },
];

export function VehicleRegistryPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    license_plate: '',
    model: '',
    type: '',
    max_capacity: '',
    odometer: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadVehicles = async () => {
    try {
      const data = await api.vehicles.list();
      setVehicles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load vehicles:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVehicles(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.vehicles.create({
        model: formData.model,
        type: formData.type || undefined,
        license_plate: formData.license_plate,
        max_capacity: Number(formData.max_capacity) || 0,
        odometer: formData.odometer ? Number(formData.odometer) : undefined,
      });
      setIsModalOpen(false);
      setFormData({ license_plate: '', model: '', type: '', max_capacity: '', odometer: '' });
      await loadVehicles();
    } catch (err: any) {
      setError(err.message || 'Failed to create vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = vehicles.filter(v =>
    !searchQuery ||
    v.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.license_plate?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <Plus className="w-4 h-4 mr-2" />
              New Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">New Vehicle Registration</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {error && (
                <div className="bg-[#EF4444]/10 text-[#EF4444] px-4 py-2 rounded-lg text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">License Plate</label>
                <Input
                  placeholder="e.g., ABC-1234"
                  value={formData.license_plate}
                  onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Model</label>
                <Input
                  placeholder="e.g., Ford F-150"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Type</label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="Truck">Truck</SelectItem>
                    <SelectItem value="Van">Van</SelectItem>
                    <SelectItem value="Car">Car</SelectItem>
                    <SelectItem value="Bike">Bike</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Max Capacity (kg)</label>
                <Input
                  type="number"
                  placeholder="e.g., 2000"
                  value={formData.max_capacity}
                  onChange={(e) => setFormData({ ...formData, max_capacity: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Initial Odometer (km)</label>
                <Input
                  type="number"
                  placeholder="e.g., 45230"
                  value={formData.odometer}
                  onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={submitting} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Vehicle
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1 bg-transparent border-border text-foreground hover:bg-secondary">
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Vehicles Table */}
      <DataTable
        columns={columns}
        data={filtered}
        renderCell={(column, row) => {
          if (column.key === 'status') {
            return <StatusBadge status={row.status} />;
          }
          if (column.key === 'max_capacity') {
            return `${(row.max_capacity || 0).toLocaleString()}`;
          }
          if (column.key === 'odometer') {
            return `${(row.odometer || 0).toLocaleString()}`;
          }
          if (column.key === 'actions') {
            return (
              <div className="flex gap-2 justify-end">
                {row.status === 'Available' ? (
                  <button
                    onClick={async () => {
                      if (!confirm('Are you sure you want to retire this vehicle?')) return;
                      await api.vehicles.update(row.id, { status: 'Retired' });
                      loadVehicles();
                    }}
                    className="text-xs px-2 py-1 rounded bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition-colors"
                  >
                    Retire
                  </button>
                ) : row.status === 'Retired' ? (
                  <button
                    onClick={async () => {
                      await api.vehicles.update(row.id, { status: 'Available' });
                      loadVehicles();
                    }}
                    className="text-xs px-2 py-1 rounded bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 transition-colors"
                  >
                    Reactivate
                  </button>
                ) : null}
              </div>
            );
          }
          return row[column.key];
        }}
      />
    </div>
  );
}
