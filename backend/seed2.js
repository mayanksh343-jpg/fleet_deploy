/**
 * FleetFlow Rich Sample Data Seeder
 * Seeds the database with realistic demo data for all tables.
 * Run: node seed2.js
 */
const db = require("./db");
const bcrypt = require("bcryptjs");

// Wipe existing data in correct FK order
console.log("Clearing existing data...");
db.exec("DELETE FROM permissions");
db.exec("DELETE FROM refresh_tokens");
db.exec("DELETE FROM fuel_logs");
db.exec("DELETE FROM maintenance_logs");
db.exec("DELETE FROM trips");
db.exec("DELETE FROM drivers");
db.exec("DELETE FROM vehicles");
db.exec("DELETE FROM users");
db.exec("DELETE FROM regions");

// Reset auto-increment counters
db.exec("DELETE FROM sqlite_sequence");

console.log("Seeding regions...");
const insertRegion = db.prepare("INSERT INTO regions (name) VALUES (?)");
["North", "South", "East", "West"].forEach(r => insertRegion.run(r));

console.log("Seeding users...");
const insertUser = db.prepare(
  "INSERT INTO users (name, email, password_hash, role, phone, address) VALUES (?, ?, ?, ?, ?, ?)"
);
const hash = (pw) => bcrypt.hashSync(pw, 10);

insertUser.run("Super Admin", "superadmin@fleetflow.com", hash("superadmin123"), "Super Admin", "+1-555-000-0001", "100 Admin Blvd, HQ City");
insertUser.run("Admin Manager", "admin@fleetflow.com", hash("admin123"), "Manager", "+1-555-100-0001", "200 Fleet Ave, Logistics Park");
insertUser.run("Jane Dispatcher", "jane@fleetflow.com", hash("jane123"), "Dispatcher", "+1-555-200-0002", "300 Dispatch Rd, Transport Hub");
insertUser.run("Bob Manager", "bob@fleetflow.com", hash("bob123"), "Manager", "+1-555-100-0003", "201 Fleet Ave, Logistics Park");
insertUser.run("Sara Safety", "sara@fleetflow.com", hash("sara123"), "Safety Officer", "+1-555-300-0004", "400 Safety Lane, Compliance Center");
insertUser.run("Frank Finance", "frank@fleetflow.com", hash("frank123"), "Financial Analyst", "+1-555-400-0005", "500 Finance St, Analytics Wing");
insertUser.run("John Driver", "john@driver.com", hash("driver123"), "Driver", "+1-555-500-0006", "600 Driver Way, Depot A");

console.log("Seeding vehicles...");
const insertVehicle = db.prepare(
  "INSERT INTO vehicles (model, type, license_plate, max_capacity, odometer, acquisition_cost, status, region_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);

const vehicles = [
  ["Ford F-150", "Truck", "TRK-001", 5000, 45230, 35000, "Available", 1],
  ["Mercedes Sprinter", "Van", "VAN-002", 3000, 62100, 42000, "Available", 1],
  ["Toyota HiAce", "Van", "VAN-003", 2500, 38400, 28000, "Available", 2],
  ["Volvo FH16", "Truck", "TRK-004", 8000, 120500, 85000, "OnTrip", 2],
  ["Isuzu NPR", "Truck", "TRK-005", 4500, 55800, 32000, "Available", 3],
  ["Honda PCX", "Bike", "BIK-006", 50, 12300, 3500, "Available", 3],
  ["Suzuki Carry", "Van", "VAN-007", 1500, 41200, 18000, "InShop", 4],
  ["Scania R500", "Truck", "TRK-008", 10000, 89000, 95000, "Available", 4],
  ["Nissan NV200", "Van", "VAN-009", 2000, 27600, 22000, "Available", 1],
  ["Yamaha NMAX", "Bike", "BIK-010", 30, 8400, 2800, "Available", 2],
  ["Mitsubishi Fuso", "Truck", "TRK-011", 7000, 67800, 55000, "OnTrip", 3],
  ["Toyota Corolla", "Car", "CAR-012", 400, 31200, 25000, "Available", 4],
];

vehicles.forEach(v => insertVehicle.run(...v));

console.log("Seeding drivers...");
const insertDriver = db.prepare(
  "INSERT INTO drivers (name, license_type, license_expiry, status, region_id) VALUES (?, ?, ?, ?, ?)"
);

const drivers = [
  ["Alex Johnson", "Truck", "2027-06-15", "OnDuty", 1],
  ["Maria Garcia", "Van", "2026-12-01", "OnDuty", 1],
  ["James Williams", "Truck", "2027-03-22", "OnTrip", 2],
  ["Sarah Brown", "Van", "2026-08-10", "OnDuty", 2],
  ["Michael Davis", "Bike", "2027-01-30", "OffDuty", 3],
  ["Emily Wilson", "Truck", "2025-11-15", "Suspended", 3],
  ["David Martinez", "Van", "2027-09-05", "OnTrip", 4],
  ["Lisa Anderson", "Truck", "2026-04-18", "OnDuty", 4],
  ["Robert Taylor", "Car", "2027-07-20", "OnDuty", 1],
  ["Jennifer Thomas", "Bike", "2026-10-12", "OnDuty", 2],
];

drivers.forEach(d => insertDriver.run(...d));

console.log("Seeding trips...");
const insertTrip = db.prepare(
  `INSERT INTO trips (vehicle_id, driver_id, cargo_weight, start_location, end_location,
   start_odometer, end_odometer, revenue, status, origin_region_id, destination_region_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const trips = [
  // Completed trips (with end_odometer and revenue)
  [1, 1, 3500, "123 Main St, New York", "456 Oak Ave, Boston", 44800, 45230, 4200, "Completed", 1, 1, "2026-01-15 08:00:00"],
  [2, 2, 2200, "789 Pine Rd, Newark", "321 Elm St, Philadelphia", 61500, 62100, 3100, "Completed", 1, 2, "2026-01-18 09:30:00"],
  [3, 4, 1800, "100 Park Ave, Miami", "200 Beach Blvd, Orlando", 37800, 38400, 2800, "Completed", 2, 2, "2026-01-20 07:00:00"],
  [5, 1, 4000, "50 Industrial Blvd, Atlanta", "75 Commerce Way, Charlotte", 55100, 55800, 5500, "Completed", 3, 1, "2026-01-22 06:30:00"],
  [1, 2, 2800, "456 Oak Ave, Boston", "789 Cedar Ln, Hartford", 45230, 45580, 3200, "Completed", 1, 1, "2026-01-25 10:00:00"],
  [9, 4, 1500, "300 River Rd, Albany", "400 Lake Dr, Syracuse", 27000, 27600, 2100, "Completed", 1, 1, "2026-01-28 11:00:00"],
  [8, 8, 7500, "600 Port St, Seattle", "700 Dock Ave, Portland", 88000, 89000, 8900, "Completed", 4, 4, "2026-02-01 05:00:00"],
  [3, 4, 2000, "200 Beach Blvd, Orlando", "150 Gulf Rd, Tampa", 38400, 38700, 2500, "Completed", 2, 2, "2026-02-03 08:00:00"],
  [5, 1, 3800, "75 Commerce Way, Charlotte", "90 Trade St, Raleigh", 55800, 56200, 4800, "Completed", 3, 3, "2026-02-05 07:30:00"],
  [2, 9, 1200, "321 Elm St, Philadelphia", "500 Market St, Trenton", 62100, 62400, 1800, "Completed", 1, 1, "2026-02-08 09:00:00"],

  // Dispatched (in-progress) trips
  [4, 3, 6500, "500 Highway 1, Dallas", "600 Route 66, Houston", 120500, null, 7200, "Dispatched", 2, 2, "2026-02-18 06:00:00"],
  [11, 7, 5500, "800 Mountain Rd, Denver", "900 Valley Dr, Phoenix", 67800, null, 6800, "Dispatched", 3, 4, "2026-02-19 07:00:00"],

  // Draft trips
  [1, 1, 4200, "123 Main St, New York", "250 Broadway, Newark", 45580, null, 3500, "Draft", 1, 1, "2026-02-20 08:00:00"],
  [10, 10, 25, "100 Campus Dr, San Jose", "200 Tech Blvd, Palo Alto", 8400, null, 500, "Draft", 2, 2, "2026-02-20 10:00:00"],

  // Cancelled trips
  [6, 5, 40, "400 Express Way, Chicago", "450 Rapid Rd, Milwaukee", 12300, null, 600, "Cancelled", 3, 3, "2026-02-10 09:00:00"],
  [3, 2, 2400, "150 Gulf Rd, Tampa", "100 Park Ave, Miami", 38700, null, 3000, "Cancelled", 2, 2, "2026-02-12 06:30:00"],
];

trips.forEach(t => insertTrip.run(...t));

console.log("Seeding fuel logs...");
const insertFuel = db.prepare(
  "INSERT INTO fuel_logs (vehicle_id, trip_id, liters, cost, odometer_reading, efficiency, date) VALUES (?, ?, ?, ?, ?, ?, ?)"
);

const fuelLogs = [
  [1, 1, 85, 127.50, 45230, 5.06, "2026-01-15"],
  [2, 2, 60, 90.00, 62100, 10.0, "2026-01-18"],
  [3, 3, 55, 82.50, 38400, 10.9, "2026-01-20"],
  [5, 4, 95, 142.50, 55800, 7.37, "2026-01-22"],
  [1, 5, 40, 60.00, 45580, 8.75, "2026-01-25"],
  [9, 6, 50, 75.00, 27600, 12.0, "2026-01-28"],
  [8, 7, 150, 225.00, 89000, 6.67, "2026-02-01"],
  [3, 8, 35, 52.50, 38700, 8.57, "2026-02-03"],
  [5, 9, 70, 105.00, 56200, 5.71, "2026-02-05"],
  [2, 10, 30, 45.00, 62400, 10.0, "2026-02-08"],
  [4, 11, 120, 180.00, null, null, "2026-02-18"],
  [11, 12, 100, 150.00, null, null, "2026-02-19"],
  // Extra standalone fuel logs
  [1, null, 90, 135.00, 44800, null, "2026-01-10"],
  [8, null, 160, 240.00, 88000, null, "2026-01-28"],
  [6, null, 8, 12.00, 12300, null, "2026-01-15"],
  [10, null, 5, 7.50, 8400, null, "2026-02-01"],
  [12, null, 45, 67.50, 31200, null, "2026-02-05"],
  [3, null, 50, 75.00, 37800, null, "2026-01-12"],
  [5, null, 80, 120.00, 55100, null, "2026-01-18"],
  [9, null, 40, 60.00, 27000, null, "2026-01-20"],
];

fuelLogs.forEach(f => insertFuel.run(...f));

console.log("Seeding maintenance logs...");
const insertMaint = db.prepare(
  "INSERT INTO maintenance_logs (vehicle_id, description, cost, date) VALUES (?, ?, ?, ?)"
);

const maintenanceLogs = [
  [7, "Engine oil change and filter replacement", 350, "2026-02-15"],
  [1, "Brake pad replacement — front axle", 820, "2026-01-05"],
  [2, "Transmission fluid flush", 450, "2026-01-12"],
  [4, "Tire rotation and alignment", 280, "2026-01-20"],
  [8, "Full engine service — 100k km checkpoint", 2200, "2026-01-25"],
  [3, "AC compressor repair", 650, "2026-02-01"],
  [5, "Battery replacement", 320, "2026-02-06"],
  [11, "Windshield wiper replacement", 85, "2026-02-10"],
  [6, "Chain and sprocket replacement", 180, "2026-02-12"],
  [9, "Oil change and tire pressure check", 220, "2026-02-14"],
  [1, "Suspension spring replacement", 1100, "2026-02-18"],
  [12, "Full vehicle inspection", 150, "2026-02-20"],
];

maintenanceLogs.forEach(m => insertMaint.run(...m));

// Restore vehicle 7 status to InShop (last maintenance entry)
db.prepare("UPDATE vehicles SET status = 'InShop' WHERE id = 7").run();

console.log("\n✅ Seed complete!");
console.log("   Regions:     4");
console.log("   Users:       7  (1 Super Admin, 2 Manager, 1 Dispatcher, 1 Safety, 1 Finance, 1 Driver)");
console.log("   Vehicles:   12");
console.log("   Drivers:    10");
console.log("   Trips:      16  (10 Completed, 2 Dispatched, 2 Draft, 2 Cancelled)");
console.log("   Fuel logs:  20");
console.log("   Maint logs: 12");
console.log("\nLogin credentials:");
console.log("   Super Admin:        superadmin@fleetflow.com / superadmin123");
console.log("   Fleet Manager:      admin@fleetflow.com / admin123");
console.log("   Dispatcher:         jane@fleetflow.com  / jane123");
console.log("   Safety Officer:     sara@fleetflow.com  / sara123");
console.log("   Financial Analyst:  frank@fleetflow.com / frank123");
console.log("   Driver:             john@driver.com     / driver123");

