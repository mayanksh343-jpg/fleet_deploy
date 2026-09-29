import { useState, useEffect } from 'react';
import { Search, Loader2, Trophy, Users, Award, Star, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import api from '../services/api';

const columns = [
  { key: 'id', label: 'ID', width: '6%' },
  { key: 'name', label: 'Name', width: '16%' },
  { key: 'license_type', label: 'License', width: '10%' },
  { key: 'license_expiry', label: 'Expiry', width: '13%' },
  { key: 'status', label: 'Status', width: '11%' },
  { key: 'completion_rate', label: 'Completion %', width: '11%' },
  { key: 'safety_score', label: 'Safety Score', width: '10%' },
  { key: 'license_valid', label: 'License Valid', width: '10%' },
  { key: 'actions', label: '', width: '13%' },
];

interface DriverScore {
  id: number;
  driver_id: number;
  driver_name: string;
  driver_status: string;
  safety_score: number;
  efficiency_score: number;
  punctuality_score: number;
  overall_score: number;
  rank: number;
  badges: Array<{ icon: string; name: string; desc: string }>;
}

export function DriversPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driverAnalytics, setDriverAnalytics] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<'performance' | 'leaderboard'>('performance');
  const [leaderboard, setLeaderboard] = useState<DriverScore[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const loadDrivers = async () => {
    try {
      const driversData = await api.drivers.list().catch(() => []);
      const driversList = Array.isArray(driversData) ? driversData : [];
      setDrivers(driversList);

      const analyticsMap: Record<number, any> = {};
      await Promise.all(
        driversList.map(async (d: any) => {
          try {
            const analytics = await api.analytics.driver(d.id);
            analyticsMap[d.id] = analytics;
          } catch { /* Dispatcher can't access analytics */ }
        })
      );
      setDriverAnalytics(analyticsMap);
    } catch (e) {
      console.error('Failed to load drivers:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      setLbLoading(true);
      const data = await api.scoring.leaderboard();
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch { /* handled */ } finally { setLbLoading(false); }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      await api.scoring.recalculate();
      await loadLeaderboard();
    } catch { /* handled */ } finally { setRecalculating(false); }
  };

  useEffect(() => { loadDrivers(); loadLeaderboard(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  const totalDrivers = drivers.length;
  const onDuty = drivers.filter(d => d.status === 'OnDuty').length;
  const onTrip = drivers.filter(d => d.status === 'OnTrip').length;
  const activeToday = onDuty + onTrip;
  const today = new Date();
  const sixMonthsFromNow = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());
  const expiringSoon = drivers.filter(d => {
    if (!d.license_expiry) return false;
    const exp = new Date(d.license_expiry);
    return exp <= sixMonthsFromNow && exp >= today;
  }).length;

  const topDriver = leaderboard.length > 0 ? leaderboard[0] : null;

  const allScores = Object.values(driverAnalytics)
    .map((a: any) => a?.performance?.safety_score)
    .filter((s: any) => typeof s === 'number');
  const avgSafety = allScores.length > 0
    ? (allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length).toFixed(1)
    : '—';

  const filtered = drivers.filter(d =>
    !searchQuery || d.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function getScoreColor(score: number) {
    if (score >= 80) return 'text-[#22C55E]';
    if (score >= 60) return 'text-[#FACC15]';
    return 'text-[#EF4444]';
  }

  function getScoreBg(score: number) {
    if (score >= 80) return 'bg-[#22C55E]';
    if (score >= 60) return 'bg-[#FACC15]';
    return 'bg-[#EF4444]';
  }

  function getRankBadge(rank: number) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-card border border-border rounded-[14px] p-6">
          <p className="text-sm text-muted-foreground mb-2">Total Drivers</p>
          <p className="text-3xl font-bold text-foreground">{totalDrivers}</p>
        </div>
        <div className="bg-card border border-border rounded-[14px] p-6">
          <p className="text-sm text-muted-foreground mb-2">Active Today</p>
          <p className="text-3xl font-bold text-[#22C55E]">{activeToday}</p>
        </div>
        <div className="bg-card border border-border rounded-[14px] p-6">
          <p className="text-sm text-muted-foreground mb-2">Avg Safety Score</p>
          <p className="text-3xl font-bold text-foreground">{avgSafety}/100</p>
        </div>
        <div className="bg-card border border-border rounded-[14px] p-6">
          <p className="text-sm text-muted-foreground mb-2">Top Driver</p>
          <p className="text-lg font-bold text-foreground truncate">{topDriver ? `🥇 ${topDriver.driver_name}` : '—'}</p>
          {topDriver && <p className="text-xs text-muted-foreground">Score: {topDriver.overall_score}</p>}
        </div>
      </div>

      {/* Tab Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-2">
          <button onClick={() => setTab('performance')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'performance' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
            <Users className="w-4 h-4 inline mr-1.5" /> Performance
          </button>
          <button onClick={() => setTab('leaderboard')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'leaderboard' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
            <Trophy className="w-4 h-4 inline mr-1.5" /> Leaderboard
          </button>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search drivers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground" />
          </div>
          {tab === 'leaderboard' && (
            <Button onClick={handleRecalculate} disabled={recalculating} className="bg-primary hover:bg-primary/90 text-primary-foreground whitespace-nowrap">
              {recalculating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
              Recalculate
            </Button>
          )}
        </div>
      </div>

      {/* Performance Tab */}
      {tab === 'performance' && (
        <>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Driver Performance & Safety</h2>
            <p className="text-sm text-muted-foreground">Monitor driver metrics and compliance</p>
          </div>
          <DataTable
            columns={columns}
            data={filtered.map(d => {
              const analytics = driverAnalytics[d.id];
              return {
                ...d,
                completion_rate: analytics?.performance?.completion_rate_percent ?? '—',
                safety_score: analytics?.performance?.safety_score ?? '—',
                license_valid: analytics?.compliance?.license_valid ?? (d.license_expiry && new Date(d.license_expiry) > today),
              };
            })}
            renderCell={(column, row) => {
              if (column.key === 'status') return <StatusBadge status={row.status} />;
              if (column.key === 'safety_score') {
                if (row.safety_score === '—') return '—';
                const s = Number(row.safety_score);
                const color = s >= 80 ? 'text-[#22C55E]' : s >= 60 ? 'text-[#FACC15]' : 'text-[#EF4444]';
                return <span className={`font-semibold ${color}`}>{s}/100</span>;
              }
              if (column.key === 'completion_rate') {
                if (row.completion_rate === '—') return '—';
                const r = Number(row.completion_rate);
                const color = r >= 95 ? 'text-[#22C55E]' : r >= 80 ? 'text-foreground' : 'text-[#FACC15]';
                return <span className={color}>{r.toFixed(0)}%</span>;
              }
              if (column.key === 'license_valid') {
                return row.license_valid ? <span className="text-[#22C55E] font-medium">✓ Valid</span> : <span className="text-[#EF4444] font-medium">✗ Expired</span>;
              }
              if (column.key === 'actions') {
                return (
                  <div className="flex gap-1 justify-end">
                    {row.status !== 'OnDuty' && row.status !== 'OnTrip' && (
                      <button onClick={async () => { await api.drivers.update(row.id, { status: 'OnDuty' }); await loadDrivers(); }} className="text-xs px-2 py-1 rounded bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 transition-colors">On Duty</button>
                    )}
                    {row.status !== 'OffDuty' && row.status !== 'OnTrip' && (
                      <button onClick={async () => { await api.drivers.update(row.id, { status: 'OffDuty' }); await loadDrivers(); }} className="text-xs px-2 py-1 rounded bg-secondary text-foreground hover:bg-muted transition-colors">Off Duty</button>
                    )}
                    {row.status !== 'Suspended' && row.status !== 'OnTrip' && (
                      <button onClick={async () => { if (!confirm(`Suspend driver ${row.name}?`)) return; await api.drivers.update(row.id, { status: 'Suspended' }); await loadDrivers(); }} className="text-xs px-2 py-1 rounded bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition-colors">Suspend</button>
                    )}
                  </div>
                );
              }
              return row[column.key] || '—';
            }}
          />
        </>
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Driver Leaderboard & Gamification</h2>
            <p className="text-sm text-muted-foreground">Ranked by overall performance score — safety, efficiency, and punctuality</p>
          </div>

          {lbLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : leaderboard.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No scores yet. Click "Recalculate" to generate scores from trip data.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard
                .filter(s => !searchQuery || s.driver_name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((score) => (
                <div key={score.id} className={`bg-card border rounded-xl p-5 transition-all hover:border-primary/30 ${score.rank <= 3 ? 'border-primary/20 bg-primary/[0.02]' : 'border-border'}`}>
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="text-center w-12 shrink-0">
                      <span className="text-2xl">{getRankBadge(score.rank)}</span>
                    </div>

                    {/* Driver Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-foreground">{score.driver_name}</h3>
                        <StatusBadge status={score.driver_status} />
                      </div>
                      {/* Badges */}
                      {score.badges.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {score.badges.map((b, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20" title={b.desc}>
                              {b.icon} {b.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Score Breakdown */}
                    <div className="hidden md:flex items-center gap-6 shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Safety</p>
                        <p className={`text-sm font-bold ${getScoreColor(score.safety_score)}`}>{score.safety_score}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Efficiency</p>
                        <p className={`text-sm font-bold ${getScoreColor(score.efficiency_score)}`}>{score.efficiency_score}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Punctuality</p>
                        <p className={`text-sm font-bold ${getScoreColor(score.punctuality_score)}`}>{score.punctuality_score}</p>
                      </div>
                    </div>

                    {/* Overall Score */}
                    <div className="text-center shrink-0">
                      <div className="relative w-14 h-14">
                        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
                          <circle cx="28" cy="28" r="24" fill="none" strokeWidth="4" strokeDasharray={`${score.overall_score * 1.508} 150.8`} strokeLinecap="round" className={getScoreBg(score.overall_score)} />
                        </svg>
                        <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${getScoreColor(score.overall_score)}`}>{score.overall_score}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
