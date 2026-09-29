import { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, Loader2, Search, Radio, LogIn, LogOut, AlertTriangle, CheckCircle, XCircle, Shield } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import api from '../services/api';

interface Geofence {
  id: number;
  name: string;
  type: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  region_id: number | null;
  region_name: string | null;
  alert_on_entry: number;
  alert_on_exit: number;
  status: string;
  created_at: string;
}

interface GeofenceEvent {
  id: number;
  vehicle_id: number;
  geofence_id: number;
  event_type: string;
  timestamp: string;
  geofence_name: string;
  vehicle_model: string;
  license_plate: string;
}

export function GeofencePage() {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [events, setEvents] = useState<GeofenceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'zones' | 'events'>('zones');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', center_lat: '', center_lng: '', radius_km: '5', alert_on_entry: true, alert_on_exit: true });
  const [saving, setSaving] = useState(false);
  const [regions, setRegions] = useState<any[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [geoData, eventData, regionData] = await Promise.all([
        api.geofences.list(),
        api.geofences.events(),
        api.regions.list(),
      ]);
      setGeofences(geoData);
      setEvents(eventData);
      setRegions(regionData);
    } catch { /* handled */ } finally { setLoading(false); }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const data = {
        name: formData.name,
        center_lat: parseFloat(formData.center_lat) || 0,
        center_lng: parseFloat(formData.center_lng) || 0,
        radius_km: parseFloat(formData.radius_km) || 5,
        region_id: selectedRegion ? parseInt(selectedRegion) : undefined,
        alert_on_entry: formData.alert_on_entry ? 1 : 0,
        alert_on_exit: formData.alert_on_exit ? 1 : 0,
      };
      if (editingId) {
        await api.geofences.update(editingId, data);
      } else {
        await api.geofences.create(data);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', center_lat: '', center_lng: '', radius_km: '5', alert_on_entry: true, alert_on_exit: true });
      setSelectedRegion('');
      await loadData();
    } catch { /* handled */ } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this geofence and all its events?')) return;
    try {
      await api.geofences.delete(id);
      await loadData();
    } catch { /* handled */ }
  }

  function startEdit(g: Geofence) {
    setFormData({
      name: g.name,
      center_lat: String(g.center_lat),
      center_lng: String(g.center_lng),
      radius_km: String(g.radius_km),
      alert_on_entry: !!g.alert_on_entry,
      alert_on_exit: !!g.alert_on_exit,
    });
    setSelectedRegion(g.region_id ? String(g.region_id) : '');
    setEditingId(g.id);
    setShowForm(true);
  }

  const filtered = geofences.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));
  const activeCount = geofences.filter(g => g.status === 'Active').length;
  const entryEvents = events.filter(e => e.event_type === 'entry').length;
  const exitEvents = events.filter(e => e.event_type === 'exit').length;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Zones</p>
              <p className="text-2xl font-bold text-foreground">{geofences.length}</p>
            </div>
            <MapPin className="w-8 h-8 text-primary/30" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-[#22C55E]">{activeCount}</p>
            </div>
            <Radio className="w-8 h-8 text-[#22C55E]/30" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Entry Events</p>
              <p className="text-2xl font-bold text-blue-400">{entryEvents}</p>
            </div>
            <LogIn className="w-8 h-8 text-blue-400/30" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Exit Events</p>
              <p className="text-2xl font-bold text-amber-400">{exitEvents}</p>
            </div>
            <LogOut className="w-8 h-8 text-amber-400/30" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-2">
          <button onClick={() => setTab('zones')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'zones' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
            <MapPin className="w-4 h-4 inline mr-1.5" /> Zones ({geofences.length})
          </button>
          <button onClick={() => setTab('events')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'events' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
            <AlertTriangle className="w-4 h-4 inline mr-1.5" /> Events ({events.length})
          </button>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {tab === 'zones' && (
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search zones..." className="pl-9 bg-background border-border" />
            </div>
          )}
          <Button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ name: '', center_lat: '', center_lng: '', radius_km: '5', alert_on_entry: true, alert_on_exit: true }); }} className="bg-primary hover:bg-primary/90 text-primary-foreground whitespace-nowrap">
            <Plus className="w-4 h-4 mr-1.5" /> Add Zone
          </Button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">{editingId ? 'Edit Zone' : 'New Geofence Zone'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Zone Name *</label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Warehouse Hub" className="bg-background border-border" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Region</label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {regions.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Latitude</label>
              <Input value={formData.center_lat} onChange={e => setFormData({ ...formData, center_lat: e.target.value })} placeholder="40.7128" className="bg-background border-border" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Longitude</label>
              <Input value={formData.center_lng} onChange={e => setFormData({ ...formData, center_lng: e.target.value })} placeholder="-74.006" className="bg-background border-border" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Radius (km)</label>
              <Input value={formData.radius_km} onChange={e => setFormData({ ...formData, radius_km: e.target.value })} type="number" min="0.1" step="0.5" className="bg-background border-border" />
            </div>
            <div className="flex items-center gap-6 pt-5">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={formData.alert_on_entry} onChange={e => setFormData({ ...formData, alert_on_entry: e.target.checked })} className="w-4 h-4 rounded accent-primary" />
                Alert on Entry
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={formData.alert_on_exit} onChange={e => setFormData({ ...formData, alert_on_exit: e.target.checked })} className="w-4 h-4 rounded accent-primary" />
                Alert on Exit
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} disabled={saving || !formData.name} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              {editingId ? 'Update' : 'Create'} Zone
            </Button>
            <Button onClick={() => { setShowForm(false); setEditingId(null); }} variant="outline" className="border-border text-foreground">Cancel</Button>
          </div>
        </div>
      )}

      {/* Zones Tab */}
      {tab === 'zones' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Zone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Region</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Coordinates</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Radius</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Alerts</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{g.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{g.region_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{g.center_lat.toFixed(4)}, {g.center_lng.toFixed(4)}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{g.radius_km} km</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {g.alert_on_entry ? <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/15 text-blue-400">Entry</span> : null}
                        {g.alert_on_exit ? <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/15 text-amber-400">Exit</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.status === 'Active' ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-muted text-muted-foreground'}`}>{g.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(g)} className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(g.id)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No geofence zones found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Events Tab */}
      {tab === 'events' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Vehicle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Zone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${e.event_type === 'entry' ? 'bg-blue-500/15 text-blue-400' : 'bg-amber-500/15 text-amber-400'}`}>
                        {e.event_type === 'entry' ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                        {e.event_type === 'entry' ? 'Entry' : 'Exit'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{e.vehicle_model} <span className="text-muted-foreground">({e.license_plate})</span></td>
                    <td className="px-4 py-3 text-sm text-foreground">{e.geofence_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">No geofence events yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
