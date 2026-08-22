-- FleetFlow Schema with CHECK constraints and timestamps

CREATE TABLE IF NOT EXISTS regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('Super Admin', 'Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst', 'Driver')),
  phone TEXT,
  avatar_url TEXT,
  address TEXT,
  timezone TEXT DEFAULT 'UTC',
  notifications_enabled INTEGER DEFAULT 1,
  theme_preference TEXT DEFAULT 'dark',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  permission TEXT NOT NULL,
  granted_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(granted_by) REFERENCES users(id),
  UNIQUE(user_id, permission)
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT NOT NULL,
  type TEXT DEFAULT 'Truck' CHECK(type IN ('Truck', 'Van', 'Bike', 'Car', 'Other')),
  license_plate TEXT UNIQUE NOT NULL,
  max_capacity REAL NOT NULL,
  odometer REAL DEFAULT 0,
  acquisition_cost REAL DEFAULT 0,
  status TEXT DEFAULT 'Available' CHECK(status IN ('Available', 'OnTrip', 'InShop', 'Retired')),
  region_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(region_id) REFERENCES regions(id)
);

CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  license_type TEXT,
  license_expiry TEXT,
  status TEXT DEFAULT 'OnDuty' CHECK(status IN ('OnDuty', 'OffDuty', 'OnTrip', 'Suspended')),
  region_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(region_id) REFERENCES regions(id)
);

CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  driver_id INTEGER NOT NULL,
  cargo_weight REAL,
  start_location TEXT,
  end_location TEXT,
  start_odometer REAL,
  end_odometer REAL,
  revenue REAL DEFAULT 0,
  status TEXT DEFAULT 'Draft' CHECK(status IN ('Draft', 'Dispatched', 'Completed', 'Cancelled')),
  origin_region_id INTEGER,
  destination_region_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY(driver_id) REFERENCES drivers(id),
  FOREIGN KEY(origin_region_id) REFERENCES regions(id),
  FOREIGN KEY(destination_region_id) REFERENCES regions(id)
);

CREATE TABLE IF NOT EXISTS fuel_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  trip_id INTEGER,
  liters REAL NOT NULL,
  cost REAL NOT NULL,
  odometer_reading REAL,
  efficiency REAL,
  date TEXT DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY(trip_id) REFERENCES trips(id)
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  cost REAL NOT NULL,
  date TEXT DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Phase 2: Driver Scoring & Gamification
CREATE TABLE IF NOT EXISTS driver_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  safety_score REAL DEFAULT 0,
  efficiency_score REAL DEFAULT 0,
  punctuality_score REAL DEFAULT 0,
  overall_score REAL DEFAULT 0,
  rank INTEGER DEFAULT 0,
  badges TEXT DEFAULT '[]',
  calculated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(driver_id) REFERENCES drivers(id),
  UNIQUE(driver_id, period)
);

-- Phase 2: Geofencing & Zone Alerts
CREATE TABLE IF NOT EXISTS geofences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'circle' CHECK(type IN ('circle', 'polygon')),
  center_lat REAL,
  center_lng REAL,
  radius_km REAL DEFAULT 5,
  region_id INTEGER,
  alert_on_entry INTEGER DEFAULT 1,
  alert_on_exit INTEGER DEFAULT 1,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(region_id) REFERENCES regions(id)
);

CREATE TABLE IF NOT EXISTS geofence_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  geofence_id INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('entry', 'exit')),
  timestamp TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY(geofence_id) REFERENCES geofences(id)
);

-- Phase 2: Document & License Center
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('driver', 'vehicle')),
  entity_id INTEGER NOT NULL,
  doc_type TEXT NOT NULL,
  doc_name TEXT NOT NULL,
  file_url TEXT,
  expiry_date TEXT,
  status TEXT DEFAULT 'Valid' CHECK(status IN ('Valid', 'Expiring', 'Expired', 'Pending')),
  uploaded_at TEXT DEFAULT (datetime('now'))
);