import { useState, useEffect } from 'react';
import { Plus, MapPin, Loader2, Play, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import api from '../services/api';

const columns = [
  { key: 'id', label: 'Trip ID', width: '10%' },
  { key: 'vehicle', label: 'Vehicle', width: '18%' },
  { key: 'driver', label: 'Driver', width: '18%' },
  { key: 'cargo_weight', label: 'Cargo (kg)', width: '12%' },
  { key: 'origin', label: 'Origin', width: '14%' },
  { key: 'destination', label: 'Destination', width: '14%' },
  { key: 'status', label: 'Status', width: '10%' },
  { key: 'actions', label: 'Actions', width: '10%' },
];

export function TripDispatcherPage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [allDrivers, setAllDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [completeDialog, setCompleteDialog] = useState<{ open: boolean; tripId: number | null }>({ open: false, tripId: null });
  const [endOdometer, setEndOdometer] = useState('');
  const [formData, setFormData] = useState({
    vehicle_id: '',
    driver_id: '',
    cargo_weight: '',
    start_location: '',
    end_location: '',
    revenue: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const [tripsData, vehiclesData, driversData] = await Promise.all([
        api.trips.list().catch(() => []),
        api.vehicles.list({ status: 'Available' }).catch(() => []),
        api.drivers.list().catch(() => []),
      ]);
      setTrips(Array.isArray(tripsData) ? tripsData : []);
      setAvailableVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setAllDrivers(Array.isArray(driversData) ? driversData.filter((d: any) => d.status === 'OnDuty') : []);
    } catch (e) {
      console.error('Failed to load trip data:', e);
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
      await api.trips.create({
        vehicle_id: Number(formData.vehicle_id),
        driver_id: Number(formData.driver_id),
        cargo_weight: Number(formData.cargo_weight),
        start_location: formData.start_location || undefined,
        end_location: formData.end_location || undefined,
        revenue: formData.revenue ? Number(formData.revenue) : undefined,
      });
      setIsModalOpen(false);
      setFormData({ vehicle_id: '', driver_id: '', cargo_weight: '', start_location: '', end_location: '', revenue: '' });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create trip');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatch = async (tripId: number) => {
    try {
      await api.trips.dispatch(tripId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch');
    }
  };

  const handleComplete = async () => {
    if (!completeDialog.tripId) return;
    try {
      await api.trips.complete(completeDialog.tripId, { end_odometer: Number(endOdometer) });
      setCompleteDialog({ open: false, tripId: null });
      setEndOdometer('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to complete');
    }
  };

  const handleCancel = async (tripId: number) => {
    try {
      await api.trips.cancel(tripId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Active Trips</h2>
          <p className="text-sm text-muted-foreground">Manage and dispatch fleet trips</p>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <Plus className="w-4 h-4 mr-2" />
              New Trip
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Create New Trip</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {error && (
                <div className="bg-[#EF4444]/10 text-[#EF4444] px-4 py-2 rounded-lg text-sm">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Select Vehicle</label>
                  <Select value={formData.vehicle_id} onValueChange={(value) => setFormData({ ...formData, vehicle_id: value })}>
                    <SelectTrigger className="bg-background border-border text-foreground">
                      <SelectValue placeholder="Choose vehicle" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {availableVehicles.map(v => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.license_plate} — {v.model} ({v.max_capacity}kg)
                        </SelectItem>
                      ))}
                      {availableVehicles.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No vehicles available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Select Driver</label>
                  <Select value={formData.driver_id} onValueChange={(value) => setFormData({ ...formData, driver_id: value })}>
                    <SelectTrigger className="bg-background border-border text-foreground">
                      <SelectValue placeholder="Choose driver" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {allDrivers.map(d => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name} ({d.license_type || 'N/A'})
                        </SelectItem>
                      ))}
                      {allDrivers.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No drivers available</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(() => {
                const selectedVehicle = availableVehicles.find(v => String(v.id) === formData.vehicle_id);
                const selectedDriver = allDrivers.find(d => String(d.id) === formData.driver_id);
                const isOverweight = selectedVehicle && Number(formData.cargo_weight) > selectedVehicle.max_capacity;
                const isExpired = selectedDriver && selectedDriver.license_expiry && new Date(selectedDriver.license_expiry) < new Date();
                const isInvalid = isOverweight || isExpired;

                return (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Cargo Weight (kg)
                        {selectedVehicle && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (Max: {selectedVehicle.max_capacity}kg)
                          </span>
                        )}
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g., 1500"
                        value={formData.cargo_weight}
                        onChange={(e) => setFormData({ ...formData, cargo_weight: e.target.value })}
                        className={`bg-background text-foreground ${isOverweight ? 'border-[#EF4444]' : 'border-border'}`}
                        required
                      />
                      {isOverweight && (
                        <p className="text-xs text-[#EF4444] mt-1">Cargo exceeds vehicle maximum capacity.</p>
                      )}
                    </div>

                    {isExpired && (
                      <div className="p-3 rounded bg-[#EF4444]/10 text-[#EF4444] text-sm flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Selected driver's license is expired. Cannot dispatch.
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Origin
                      </label>
                      <Input
                        placeholder="e.g., 123 Main St, New York, NY"
                        value={formData.start_location}
                        onChange={(e) => setFormData({ ...formData, start_location: e.target.value })}
                        className="bg-background border-border text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Destination
                      </label>
                      <Input
                        placeholder="e.g., 456 Oak Ave, Boston, MA"
                        value={formData.end_location}
                        onChange={(e) => setFormData({ ...formData, end_location: e.target.value })}
                        className="bg-background border-border text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Revenue ($)</label>
                      <Input
                        type="number"
                        placeholder="e.g., 5000"
                        value={formData.revenue}
                        onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
                        className="bg-background border-border text-foreground"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button type="submit" disabled={submitting || isInvalid} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Create Trip
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1 bg-transparent border-border text-foreground hover:bg-secondary">
                        Cancel
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Complete Trip Dialog */}
      <Dialog open={completeDialog.open} onOpenChange={(open) => setCompleteDialog({ ...completeDialog, open })}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Complete Trip #{completeDialog.tripId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">End Odometer (km)</label>
              <Input
                type="number"
                placeholder="e.g., 500"
                value={endOdometer}
                onChange={(e) => setEndOdometer(e.target.value)}
                className="bg-background border-border text-foreground"
                required
              />
            </div>
            <Button onClick={handleComplete} className="w-full bg-[#22C55E] hover:bg-[#22C55E]/90 text-white">
              Confirm Completion
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trips Table */}
      <DataTable
        columns={columns}
        data={trips.map(t => ({
          ...t,
          vehicle: t.vehicle_model || `Vehicle #${t.vehicle_id}`,
          driver: t.driver_name || `Driver #${t.driver_id}`,
          origin: t.start_location || '—',
          destination: t.end_location || '—',
        }))}
        renderCell={(column, row) => {
          if (column.key === 'status') {
            return <StatusBadge status={row.status} />;
          }
          if (column.key === 'actions') {
            return (
              <div className="flex gap-1">
                {row.status === 'Draft' && (
                  <button onClick={() => handleDispatch(row.id)} title="Dispatch" className="p-1 rounded hover:bg-[#3B82F6]/10 text-[#3B82F6]">
                    <Play className="w-4 h-4" />
                  </button>
                )}
                {row.status === 'Dispatched' && (
                  <button onClick={() => { setCompleteDialog({ open: true, tripId: row.id }); }} title="Complete" className="p-1 rounded hover:bg-[#22C55E]/10 text-[#22C55E]">
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
                {(row.status === 'Draft' || row.status === 'Dispatched') && (
                  <button onClick={() => handleCancel(row.id)} title="Cancel" className="p-1 rounded hover:bg-[#EF4444]/10 text-[#EF4444]">
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          }
          return row[column.key];
        }}
      />
    </div>
  );
}
