import { useState, useEffect } from 'react';
import {
  ShieldCheck, Users, Key, Trash2, Plus, X, Search, Loader2,
  UserPlus, Crown, Shield, AlertTriangle, CheckCircle
} from 'lucide-react';
import api from '../services/api';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface Permission {
  id: number;
  permission: string;
  created_at: string;
  granted_by_name: string;
}

interface AdminStats {
  total_users: number;
  total_permissions: number;
  role_breakdown: { role: string; count: number }[];
  recent_users: User[];
}

const ALL_ROLES = ['Super Admin', 'Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst', 'Driver'];

const AVAILABLE_PERMISSIONS = [
  'manage_vehicles', 'manage_drivers', 'manage_trips', 'manage_fuel',
  'manage_maintenance', 'view_analytics', 'export_data', 'manage_regions',
  'dispatch_trips', 'complete_trips', 'cancel_trips', 'view_notifications',
];

const roleBadgeStyles: Record<string, string> = {
  'Super Admin': 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
  'Manager': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Dispatcher': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Safety Officer': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Financial Analyst': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  'Driver': 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

export function SuperAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // User detail / permissions panel
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permLoading, setPermLoading] = useState(false);

  // Create user modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'Manager' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Grant permission
  const [newPermission, setNewPermission] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);

  // Feedback messages
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, statsData] = await Promise.all([
        api.admin.listUsers(),
        api.admin.stats(),
      ]);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setStats(statsData);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async (user: User) => {
    setSelectedUser(user);
    setPermLoading(true);
    try {
      const data = await api.admin.listPermissions(user.id);
      setPermissions(data.permissions || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load permissions' });
    } finally {
      setPermLoading(false);
    }
  };

  const handleChangeRole = async (userId: number, newRole: string) => {
    try {
      await api.admin.changeRole(userId, newRole);
      setFeedback({ type: 'success', message: 'Role updated successfully' });
      loadData();
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to change role' });
    }
  };

  const handleDeleteUser = (user: User) => {
    setConfirmAction({
      title: 'Delete User',
      message: `Are you sure you want to delete ${user.name} (${user.email})? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await api.admin.deleteUser(user.id);
          setFeedback({ type: 'success', message: 'User deleted successfully' });
          if (selectedUser?.id === user.id) {
            setSelectedUser(null);
            setPermissions([]);
          }
          loadData();
        } catch (err: any) {
          setFeedback({ type: 'error', message: err.message || 'Failed to delete user' });
        }
        setConfirmAction(null);
      },
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);
    try {
      await api.admin.createUser(createForm);
      setFeedback({ type: 'success', message: 'User created successfully' });
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', role: 'Manager' });
      loadData();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleGrantPermission = async () => {
    if (!selectedUser || !newPermission) return;
    setGrantLoading(true);
    try {
      await api.admin.grantPermission(selectedUser.id, newPermission);
      setFeedback({ type: 'success', message: 'Permission granted' });
      setNewPermission('');
      loadPermissions(selectedUser);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to grant permission' });
    } finally {
      setGrantLoading(false);
    }
  };

  const handleRevokePermission = async (permId: number) => {
    if (!selectedUser) return;
    try {
      await api.admin.revokePermission(selectedUser.id, permId);
      setFeedback({ type: 'success', message: 'Permission revoked' });
      loadPermissions(selectedUser);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to revoke permission' });
    }
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchSearch = !searchQuery || u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Feedback Toast */}
      {feedback && (
        <div className={`fixed top-20 right-8 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-sm animate-in slide-in-from-right duration-300 ${
          feedback.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span className="text-sm font-medium">{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="ml-2 hover:opacity-70 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-500/15 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-foreground">{confirmAction.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">{confirmAction.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2.5 bg-secondary text-foreground rounded-xl hover:bg-muted transition-colors font-medium cursor-pointer">Cancel</button>
              <button onClick={confirmAction.onConfirm} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-medium cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-2xl font-bold text-foreground">{stats.total_users}</span>
            </div>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-2xl font-bold text-foreground">{stats.role_breakdown.find(r => r.role === 'Super Admin')?.count || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground">Super Admins</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center">
                <Key className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-2xl font-bold text-foreground">{stats.total_permissions}</span>
            </div>
            <p className="text-sm text-muted-foreground">Active Permissions</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-purple-500/15 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-2xl font-bold text-foreground">{stats.role_breakdown.length}</span>
            </div>
            <p className="text-sm text-muted-foreground">Active Roles</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Management Panel (left 2/3) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">User Management</h2>
                  <p className="text-xs text-muted-foreground">{filteredUsers.length} users</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium text-sm cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> Create User
              </button>
            </div>

            {/* Search + Filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              >
                <option value="">All Roles</option>
                {ALL_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
          </div>

          {/* User List */}
          <div className="max-h-[500px] overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No users found</div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => loadPermissions(user)}
                  className={`flex items-center justify-between px-5 py-3.5 border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer ${
                    selectedUser?.id === user.id ? 'bg-secondary/50 border-l-2 border-l-primary' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 bg-primary/15 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <select
                      value={user.role}
                      onChange={(e) => { e.stopPropagation(); handleChangeRole(user.id, e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer focus:outline-none ${roleBadgeStyles[user.role] || 'bg-secondary text-foreground border-border'}`}
                    >
                      {ALL_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteUser(user); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/15 hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Permissions Panel (right 1/3) */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center">
                <Key className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Permissions</h2>
                <p className="text-xs text-muted-foreground">
                  {selectedUser ? selectedUser.name : 'Select a user'}
                </p>
              </div>
            </div>
          </div>

          {!selectedUser ? (
            <div className="py-16 text-center">
              <Key className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Click a user to manage their permissions</p>
            </div>
          ) : (
            <div>
              {/* Grant Permission */}
              <div className="p-4 border-b border-border/50">
                <div className="flex gap-2">
                  <select
                    value={newPermission}
                    onChange={(e) => setNewPermission(e.target.value)}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                  >
                    <option value="">Select permission...</option>
                    {AVAILABLE_PERMISSIONS
                      .filter(p => !permissions.some(ep => ep.permission === p))
                      .map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
                  </select>
                  <button
                    disabled={!newPermission || grantLoading}
                    onClick={handleGrantPermission}
                    className="px-3 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {grantLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Permission List */}
              <div className="max-h-[400px] overflow-y-auto">
                {permLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : permissions.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">No permissions granted</div>
                ) : (
                  permissions.map((perm) => (
                    <div key={perm.id} className="flex items-center justify-between px-4 py-3 border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-foreground">{perm.permission.replace(/_/g, ' ')}</p>
                        <p className="text-[11px] text-muted-foreground">
                          by {perm.granted_by_name} • {new Date(perm.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRevokePermission(perm.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/15 hover:text-red-400 transition-colors cursor-pointer"
                        title="Revoke"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Role Breakdown */}
      {stats && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Role Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.role_breakdown.map((rb) => (
              <div key={rb.role} className={`px-4 py-3 rounded-xl border text-center ${roleBadgeStyles[rb.role] || 'bg-secondary border-border'}`}>
                <p className="text-xl font-bold">{rb.count}</p>
                <p className="text-xs mt-0.5 opacity-80">{rb.role}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Create User</h3>
              </div>
              <button onClick={() => { setShowCreateModal(false); setCreateError(''); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 bg-red-500/10 text-red-400 px-4 py-2.5 rounded-xl text-sm border border-red-500/20">{createError}</div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                <input
                  type="text" required
                  value={createForm.name} onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <input
                  type="email" required
                  value={createForm.email} onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                <input
                  type="password" required minLength={6}
                  value={createForm.password} onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
                <select
                  value={createForm.role} onChange={(e) => setCreateForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                >
                  {ALL_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <button
                type="submit" disabled={createLoading}
                className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium text-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create User
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
