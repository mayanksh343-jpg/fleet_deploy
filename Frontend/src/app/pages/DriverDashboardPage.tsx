import { useState, useEffect } from 'react';
import { Package, MapPin, Loader2, CheckCircle, Navigation, Clock, Truck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { StatusBadge } from '../components/StatusBadge';
import api from '../services/api';

export function DriverDashboardPage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: number; name: string; email: string; role: string } | null>(null);
  const [completeDialog, setCompleteDialog] = useState<{ open: boolean; tripId: number | null }>({ open: false, tripId: null });
  const [endOdometer, setEndOdometer] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load(isBackground = false) {
      if (!isBackground) setLoading(true);
      try {
        const [meRes, allTrips] = await Promise.all([
          api.auth.me().catch(() => null),
          api.trips.list().catch(() => [])
        ]);

        if (!mounted) return;

        if (meRes?.user) {
          setUser(meRes.user);
          // Filter to only match the driver's name
          const myTrips = Array.isArray(allTrips) 
            ? allTrips.filter((t: any) => t.driver_name === meRes.user.name) 
            : [];
          setTrips(myTrips);
        }
      } catch (e) {
        console.error('Driver portal load error:', e);
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

  const handleComplete = async () => {
    if (!completeDialog.tripId) return;
    try {
      await api.trips.complete(completeDialog.tripId, { end_odometer: Number(endOdometer) });
      setCompleteDialog({ open: false, tripId: null });
      setEndOdometer('');
      
      // Reload trips immediately
      const allTrips = await api.trips.list();
      setTrips(allTrips.filter((t: any) => t.driver_name === user?.name));
    } catch (err: any) {
      alert(err.message || 'Failed to complete trip');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeTrips = trips.filter(t => t.status === 'Dispatched');
  const pastTrips = trips.filter(t => t.status === 'Completed' || t.status === 'Cancelled');

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Welcome Header */}
      <div className="bg-primary/10 border border-primary/20 rounded-[14px] p-6 text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Hello, {user?.name || 'Driver'} 👋</h1>
        <p className="text-muted-foreground">Welcome to your delivery portal. You have {activeTrips.length} active dispatches.</p>
      </div>

      {/* Active Trips Section */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
          <Navigation className="w-5 h-5 text-blue-500" /> Active Dispatches
        </h2>
        
        {activeTrips.length === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-[14px] p-8 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-20" />
            <h3 className="text-lg font-medium text-foreground">No active dispatches right now.</h3>
            <p className="text-sm text-muted-foreground">Relax until dispatch assigns a new route!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {activeTrips.map(trip => (
              <div key={trip.id} className="bg-card border border-blue-500/30 rounded-[14px] p-5 shadow-sm shadow-blue-500/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded">
                        TRIP-#{trip.id}
                      </span>
                      <StatusBadge status={trip.status} />
                    </div>
                    
                    <div className="flex items-start gap-3 mt-4">
                      <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Origin</p>
                        <p className="text-sm text-muted-foreground">{trip.start_location || 'Depot'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 mt-2">
                      <MapPin className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Destination</p>
                        <p className="text-sm text-muted-foreground">{trip.end_location || 'TBD'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-4 md:w-1/3 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Package className="w-3 h-3" /> Cargo Weight</p>
                      <p className="font-bold text-foreground text-lg">{trip.cargo_weight?.toLocaleString() || 0} kg</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Truck className="w-3 h-3" /> Assigned Vehicle</p>
                      <p className="font-bold text-foreground">{trip.vehicle_model} <span className="font-mono uppercase text-xs">({trip.license_plate})</span></p>
                    </div>
                    <Button 
                      onClick={() => setCompleteDialog({ open: true, tripId: trip.id })}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-bold h-12 mt-2"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Confirm Delivery
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complete Trip Dialog */}
      <Dialog open={completeDialog.open} onOpenChange={(open) => setCompleteDialog({ ...completeDialog, open })}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Confirm Delivery Completion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Please enter the vehicle's current odometer reading to officially close out Trip #{completeDialog.tripId}.</p>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Final Odometer Reading (km)</label>
              <Input
                type="number"
                placeholder="e.g., 45600"
                value={endOdometer}
                onChange={(e) => setEndOdometer(e.target.value)}
                className="bg-background border-border text-foreground"
                autoFocus
                required
              />
            </div>
            <Button onClick={handleComplete} disabled={!endOdometer} className="w-full bg-green-500 hover:bg-green-600 text-white h-12 font-bold text-lg">
              Finish Trip
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Past Trips History */}
      <div className="pt-8">
        <h2 className="text-xl font-bold text-foreground mb-4">Past Deliveries History</h2>
        {pastTrips.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No past trips recorded.</p>
        ) : (
          <div className="bg-card border border-border rounded-[14px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-muted-foreground">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Trip ID</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Cargo</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pastTrips.map(trip => (
                    <tr key={trip.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 font-mono font-bold text-foreground">#{trip.id}</td>
                      <td className="px-4 py-3 truncate max-w-[200px]">{trip.start_location} → {trip.end_location}</td>
                      <td className="px-4 py-3">{trip.cargo_weight?.toLocaleString()} kg</td>
                      <td className="px-4 py-3"><StatusBadge status={trip.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
