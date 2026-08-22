/**
 * FleetFlow API Service Layer
 * Central module for all backend API calls.
 * Uses JWT access tokens with automatic refresh on expiry.
 */

const BASE = '/api';

// ── Token Management ──────────────────────────────────────
function getAccessToken(): string {
  return localStorage.getItem('fleetflow_access_token') || '';
}

function getRefreshToken(): string {
  return localStorage.getItem('fleetflow_refresh_token') || '';
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('fleetflow_access_token', accessToken);
  localStorage.setItem('fleetflow_refresh_token', refreshToken);
}

function clearAuth() {
  localStorage.removeItem('fleetflow_access_token');
  localStorage.removeItem('fleetflow_refresh_token');
  localStorage.removeItem('fleetflow_user');
  localStorage.removeItem('fleetflow_role');
  // Also remove legacy key if present
  localStorage.removeItem('fleetflow_token');
}

function getStoredUser(): { id: number; name: string; email: string; role: string } | null {
  const raw = localStorage.getItem('fleetflow_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function setStoredUser(user: { id: number; name: string; email: string; role: string }) {
  localStorage.setItem('fleetflow_user', JSON.stringify(user));
  localStorage.setItem('fleetflow_role', user.role);
}

export function setRole(role: string) {
  localStorage.setItem('fleetflow_role', role);
}

export function getStoredRole(): string {
  return localStorage.getItem('fleetflow_role') || '';
}

// ── Silent Refresh ───────────────────────────────────────
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  // Prevent concurrent refresh attempts
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;

    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      if (data.user) setStoredUser(data.user);
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── HTTP Request Helper ──────────────────────────────────────
async function request<T = any>(method: string, path: string, body?: any, retried = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Attach JWT access token if available
  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // For CSV export, return text
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    const text = await res.text();
    if (!res.ok) throw new ApiError(res.status, text);
    return text as unknown as T;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // On 401 with TOKEN_EXPIRED, try silent refresh (once)
    if (res.status === 401 && !retried && data?.code === 'TOKEN_EXPIRED') {
      const refreshed = await attemptRefresh();
      if (refreshed) {
        return request<T>(method, path, body, true);
      }
    }

    // Auto-logout on any unrecoverable 401
    if (res.status === 401) {
      clearAuth();
      window.location.reload();
    }

    throw new ApiError(res.status, data?.error || `Request failed with status ${res.status}`);
  }

  return data;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// ── Auth ──────────────────────────────────────
export const auth = {
  signup: async (data: { name: string; email: string; password: string; role: string }) => {
    const result = await request<{ accessToken: string; refreshToken: string; user: any }>('POST', '/auth/signup', data);
    setTokens(result.accessToken, result.refreshToken);
    setStoredUser(result.user);
    return result;
  },
  login: async (data: { email: string; password: string }) => {
    const result = await request<{ accessToken: string; refreshToken: string; user: any }>('POST', '/auth/login', data);
    setTokens(result.accessToken, result.refreshToken);
    setStoredUser(result.user);
    return result;
  },
  me: async () => {
    const result = await request<{ user: any }>('GET', '/auth/me');
    setStoredUser(result.user);
    return result;
  },
  refresh: attemptRefresh,
  logout: async () => {
    const rt = getRefreshToken();
    try {
      await fetch(`${BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
    } catch {
      // Ignore network errors on logout
    }
    clearAuth();
  },
  getStoredUser,
  isLoggedIn: () => !!getAccessToken(),
};

// ── Vehicles ──────────────────────────────────────
export const vehicles = {
  list: (filters?: { type?: string; status?: string; region?: string }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.region) params.set('region', filters.region);
    const qs = params.toString();
    return request('GET', `/vehicles${qs ? '?' + qs : ''}`);
  },
  get: (id: number) => request('GET', `/vehicles/${id}`),
  create: (data: { model: string; type?: string; license_plate: string; max_capacity: number; odometer?: number; acquisition_cost?: number; region_id?: number }) =>
    request('POST', '/vehicles', data),
  update: (id: number, data: any) => request('PUT', `/vehicles/${id}`, data),
  delete: (id: number) => request('DELETE', `/vehicles/${id}`),
};

// ── Drivers ──────────────────────────────────────
export const drivers = {
  list: () => request('GET', '/drivers'),
  get: (id: number) => request('GET', `/drivers/${id}`),
  create: (data: { name: string; license_type?: string; license_expiry: string; region_id?: number }) =>
    request('POST', '/drivers', data),
  update: (id: number, data: any) => request('PUT', `/drivers/${id}`, data),
  delete: (id: number) => request('DELETE', `/drivers/${id}`),
};

// ── Trips ──────────────────────────────────────
export const trips = {
  list: () => request('GET', '/trips'),
  get: (id: number) => request('GET', `/trips/${id}`),
  create: (data: { vehicle_id: number; driver_id: number; cargo_weight: number; start_location?: string; end_location?: string; revenue?: number; origin_region_id?: number; destination_region_id?: number }) =>
    request('POST', '/trips', data),
  dispatch: (id: number) => request('PATCH', `/trips/${id}/dispatch`),
  complete: (id: number, data: { end_odometer: number; revenue?: number }) =>
    request('PATCH', `/trips/${id}/complete`, data),
  cancel: (id: number) => request('PATCH', `/trips/${id}/cancel`),
};

// ── Fuel Logs ──────────────────────────────────────
export const fuel = {
  list: () => request('GET', '/fuel'),
  byVehicle: (vehicleId: number) => request('GET', `/fuel/vehicle/${vehicleId}`),
  create: (data: { vehicle_id: number; trip_id?: number; liters: number; cost: number; odometer_reading?: number; date?: string }) =>
    request('POST', '/fuel', data),
};

// ── Maintenance Logs ──────────────────────────────────────
export const maintenance = {
  list: () => request('GET', '/maintenance'),
  byVehicle: (vehicleId: number) => request('GET', `/maintenance/vehicle/${vehicleId}`),
  create: (data: { vehicle_id: number; description: string; cost: number; date?: string }) =>
    request('POST', '/maintenance', data),
};

// ── Analytics ──────────────────────────────────────
export const analytics = {
  summary: () => request('GET', '/analytics/summary'),
  vehicle: (id: number) => request('GET', `/analytics/vehicle/${id}`),
  driver: (id: number) => request('GET', `/analytics/driver/${id}`),
  vehicleHistory: (id: number) => request('GET', `/analytics/vehicle/${id}/history`),
  export: () => request('GET', '/analytics/export'),
  notifications: () => request('GET', '/analytics/notifications'),
};

// ── Regions ──────────────────────────────────────
export const regions = {
  list: () => request('GET', '/regions'),
};

// ── Admin (Super Admin only) ──────────────────────────────────────
export const admin = {
  stats: () => request('GET', '/admin/stats'),
  listUsers: () => request('GET', '/admin/users'),
  changeRole: (userId: number, role: string) => request('PUT', `/admin/users/${userId}/role`, { role }),
  createUser: (data: { name: string; email: string; password: string; role: string }) =>
    request('POST', '/admin/users', data),
  deleteUser: (userId: number) => request('DELETE', `/admin/users/${userId}`),
  listPermissions: (userId: number) => request('GET', `/admin/users/${userId}/permissions`),
  grantPermission: (userId: number, permission: string) =>
    request('POST', `/admin/users/${userId}/permissions`, { permission }),
  revokePermission: (userId: number, permId: number) =>
    request('DELETE', `/admin/users/${userId}/permissions/${permId}`),
};

// ── Profile ──────────────────────────────────────
export const profile = {
  get: () => request('GET', '/profile'),
  update: (data: { name?: string; phone?: string; address?: string; timezone?: string; notifications_enabled?: boolean; theme_preference?: string }) =>
    request('PUT', '/profile', data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    request('PUT', '/profile/password', data),
  updateAvatar: (avatar_url: string | null) =>
    request('PUT', '/profile/avatar', { avatar_url }),
};

// ── Notifications ──────────────────────────────────────
export const notifications = {
  list: () => request('GET', '/notifications'),
};

// ── Scoring & Gamification ──────────────────────────────
export const scoring = {
  leaderboard: (period = 'current') => request('GET', `/scoring/leaderboard?period=${period}`),
  driver: (id: number) => request('GET', `/scoring/driver/${id}`),
  recalculate: (period = 'current') => request('POST', '/scoring/recalculate', { period }),
};

// ── Geofences ──────────────────────────────────────────
export const geofences = {
  list: () => request('GET', '/geofences'),
  create: (data: { name: string; type?: string; center_lat?: number; center_lng?: number; radius_km?: number; region_id?: number; alert_on_entry?: number; alert_on_exit?: number }) =>
    request('POST', '/geofences', data),
  update: (id: number, data: any) => request('PUT', `/geofences/${id}`, data),
  delete: (id: number) => request('DELETE', `/geofences/${id}`),
  events: () => request('GET', '/geofences/events'),
};

// ── Documents ──────────────────────────────────────────
export const documents = {
  list: (params?: { entity_type?: string; entity_id?: number; status?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request('GET', `/documents${qs}`);
  },
  expiring: (days = 30) => request('GET', `/documents/expiring?days=${days}`),
  expired: () => request('GET', '/documents/expired'),
  stats: () => request('GET', '/documents/stats'),
  create: (data: { entity_type: string; entity_id: number; doc_type: string; doc_name: string; file_url?: string; expiry_date?: string }) =>
    request('POST', '/documents', data),
  update: (id: number, data: any) => request('PUT', `/documents/${id}`, data),
  delete: (id: number) => request('DELETE', `/documents/${id}`),
};

// Default export
const api = { auth, vehicles, drivers, trips, fuel, maintenance, analytics, regions, admin, profile, notifications, scoring, geofences, documents, setRole, getStoredRole, ApiError };
export default api;
