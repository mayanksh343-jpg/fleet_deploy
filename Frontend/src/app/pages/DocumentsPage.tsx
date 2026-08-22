import { useState, useEffect } from 'react';
import { FileText, Plus, Edit2, Trash2, Loader2, Search, AlertTriangle, CheckCircle, Clock, XCircle, Shield, Truck, User, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import api from '../services/api';

interface Document {
  id: number;
  entity_type: string;
  entity_id: number;
  doc_type: string;
  doc_name: string;
  file_url: string | null;
  expiry_date: string | null;
  status: string;
  uploaded_at: string;
  entity_name?: string;
}

interface Stats {
  total: number;
  valid: number;
  expiring: number;
  expired: number;
  pending: number;
}

const STATUS_STYLES: Record<string, string> = {
  Valid: 'bg-[#22C55E]/15 text-[#22C55E]',
  Expiring: 'bg-amber-500/15 text-amber-400',
  Expired: 'bg-red-500/15 text-red-400',
  Pending: 'bg-blue-500/15 text-blue-400',
};

const DOC_TYPES = ['Driver License', 'Insurance Certificate', 'Vehicle Registration', 'Insurance Policy', 'Safety Inspection', 'Road Tax', 'Permit', 'Other'];

export function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'expiring' | 'expired'>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);

  // Form state
  const [formEntityType, setFormEntityType] = useState('driver');
  const [formEntityId, setFormEntityId] = useState('');
  const [formDocType, setFormDocType] = useState('');
  const [formDocName, setFormDocName] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    try {
      setLoading(true);
      const [statsData, driverData, vehicleData] = await Promise.all([
        api.documents.stats(),
        api.drivers.list(),
        api.vehicles.list(),
      ]);
      setStats(statsData);
      setDrivers(Array.isArray(driverData) ? driverData : driverData.drivers || []);
      setVehicles(Array.isArray(vehicleData) ? vehicleData : vehicleData.vehicles || []);

      let docs;
      if (tab === 'expiring') {
        docs = await api.documents.expiring(30);
      } else if (tab === 'expired') {
        docs = await api.documents.expired();
      } else {
        docs = await api.documents.list();
      }
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch { /* handled */ } finally { setLoading(false); }
  }

  async function handleSave() {
    if (!formEntityId || !formDocType || !formDocName) return;
    try {
      setSaving(true);
      const data = {
        entity_type: formEntityType,
        entity_id: parseInt(formEntityId),
        doc_type: formDocType,
        doc_name: formDocName,
        expiry_date: formExpiryDate || undefined,
      };
      if (editingId) {
        await api.documents.update(editingId, data);
      } else {
        await api.documents.create(data as any);
      }
      setShowForm(false);
      setEditingId(null);
      resetForm();
      await loadData();
    } catch { /* handled */ } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this document?')) return;
    try {
      await api.documents.delete(id);
      await loadData();
    } catch { /* handled */ }
  }

  function startEdit(doc: Document) {
    setFormEntityType(doc.entity_type);
    setFormEntityId(String(doc.entity_id));
    setFormDocType(doc.doc_type);
    setFormDocName(doc.doc_name);
    setFormExpiryDate(doc.expiry_date || '');
    setEditingId(doc.id);
    setShowForm(true);
  }

  function resetForm() {
    setFormEntityType('driver');
    setFormEntityId('');
    setFormDocType('');
    setFormDocName('');
    setFormExpiryDate('');
  }

  const filtered = documents.filter(d => {
    const matchesSearch = d.doc_name.toLowerCase().includes(search.toLowerCase()) || d.doc_type.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchesType = typeFilter === 'all' || d.entity_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  function getDaysUntilExpiry(date: string | null) {
    if (!date) return null;
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-foreground">{stats?.total || 0}</p>
            </div>
            <FileText className="w-8 h-8 text-primary/30" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Valid</p>
              <p className="text-2xl font-bold text-[#22C55E]">{stats?.valid || 0}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-[#22C55E]/30" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Expiring</p>
              <p className="text-2xl font-bold text-amber-400">{stats?.expiring || 0}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-amber-400/30" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Expired</p>
              <p className="text-2xl font-bold text-red-400">{stats?.expired || 0}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-400/30" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-blue-400">{stats?.pending || 0}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-400/30" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-2">
          {(['all', 'expiring', 'expired'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
              {t === 'all' ? 'All Documents' : t === 'expiring' ? '⚠️ Expiring Soon' : '❌ Expired'}
            </button>
          ))}
        </div>
        <Button onClick={() => { setShowForm(true); setEditingId(null); resetForm(); }} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="w-4 h-4 mr-1.5" /> Add Document
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..." className="pl-9 bg-background border-border" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="bg-background border-border w-40"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="driver"><User className="w-3 h-3 inline mr-1" />Driver</SelectItem>
            <SelectItem value="vehicle"><Truck className="w-3 h-3 inline mr-1" />Vehicle</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-background border-border w-40"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Valid">✅ Valid</SelectItem>
            <SelectItem value="Expiring">⚠️ Expiring</SelectItem>
            <SelectItem value="Expired">❌ Expired</SelectItem>
            <SelectItem value="Pending">🕐 Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">{editingId ? 'Edit Document' : 'New Document'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Entity Type *</label>
              <Select value={formEntityType} onValueChange={v => { setFormEntityType(v); setFormEntityId(''); }}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="driver"><User className="w-3 h-3 inline mr-1" /> Driver</SelectItem>
                  <SelectItem value="vehicle"><Truck className="w-3 h-3 inline mr-1" /> Vehicle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">{formEntityType === 'driver' ? 'Driver' : 'Vehicle'} *</label>
              <Select value={formEntityId} onValueChange={setFormEntityId}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent className="bg-card border-border max-h-48">
                  {formEntityType === 'driver'
                    ? drivers.map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)
                    : vehicles.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.model} ({v.license_plate})</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Document Type *</label>
              <Select value={formDocType} onValueChange={setFormDocType}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {DOC_TYPES.map(dt => <SelectItem key={dt} value={dt}>{dt}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Document Name *</label>
              <Input value={formDocName} onChange={e => setFormDocName(e.target.value)} placeholder="e.g. CDL License 2026" className="bg-background border-border" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Expiry Date</label>
              <Input type="date" value={formExpiryDate} onChange={e => setFormExpiryDate(e.target.value)} className="bg-background border-border" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} disabled={saving || !formEntityId || !formDocType || !formDocName} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              {editingId ? 'Update' : 'Add'} Document
            </Button>
            <Button onClick={() => { setShowForm(false); setEditingId(null); }} variant="outline" className="border-border text-foreground">Cancel</Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Document</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Expiry</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const daysLeft = getDaysUntilExpiry(d.expiry_date);
                return (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${d.entity_type === 'driver' ? 'bg-blue-500/10' : 'bg-green-500/10'}`}>
                          {d.entity_type === 'driver' ? <User className="w-4 h-4 text-blue-400" /> : <Truck className="w-4 h-4 text-green-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{d.doc_name}</p>
                          <p className="text-xs text-muted-foreground">{d.doc_type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.entity_type === 'driver' ? 'bg-blue-500/15 text-blue-400' : 'bg-green-500/15 text-green-400'}`}>
                        {d.entity_type === 'driver' ? '👤 Driver' : '🚛 Vehicle'} #{d.entity_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{d.doc_type}</td>
                    <td className="px-4 py-3">
                      {d.expiry_date ? (
                        <div>
                          <p className="text-sm text-foreground">{new Date(d.expiry_date).toLocaleDateString()}</p>
                          {daysLeft !== null && (
                            <p className={`text-xs ${daysLeft < 0 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today' : `${daysLeft}d remaining`}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No expiry</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[d.status] || 'bg-muted text-muted-foreground'}`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(d)} className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">{tab === 'expired' ? 'No expired documents' : tab === 'expiring' ? 'No documents expiring soon' : 'No documents found'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
