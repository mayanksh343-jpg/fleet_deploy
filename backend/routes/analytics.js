const express = require("express");
const router = express.Router();
const db = require("../db");

// Helper: Get operational costs per vehicle
const getOperationalCostPerVehicle = () => {
  const fuelCosts = db
    .prepare(
      "SELECT vehicle_id, COALESCE(SUM(cost), 0) AS cost FROM fuel_logs GROUP BY vehicle_id",
    )
    .all();
  const maintenanceCosts = db
    .prepare(
      "SELECT vehicle_id, COALESCE(SUM(cost), 0) AS cost FROM maintenance_logs GROUP BY vehicle_id",
    )
    .all();

  const costs = {};
  fuelCosts.forEach((f) => {
    costs[f.vehicle_id] = { fuel: f.cost, maintenance: 0, total: f.cost };
  });

  maintenanceCosts.forEach((m) => {
    if (!costs[m.vehicle_id])
      costs[m.vehicle_id] = { fuel: 0, maintenance: 0, total: 0 };
    costs[m.vehicle_id].maintenance = m.cost;
    costs[m.vehicle_id].total += m.cost;
  });

  return costs;
};

// GET /analytics/summary — Fleet-wide analytics (accessible to both Manager and Dispatcher)
router.get("/summary", (req, res) => {
  // Total vehicles by status
  const vehicleCounts = db
    .prepare(
      `
    SELECT
      COUNT(*) AS total_vehicles,
      SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) AS available,
      SUM(CASE WHEN status = 'OnTrip' THEN 1 ELSE 0 END) AS on_trip,
      SUM(CASE WHEN status = 'InShop' THEN 1 ELSE 0 END) AS in_shop,
      SUM(CASE WHEN status = 'Retired' THEN 1 ELSE 0 END) AS retired
    FROM vehicles
  `,
    )
    .get();

  const activeFleet =
    vehicleCounts.total_vehicles - (vehicleCounts.retired || 0);
  const utilizationRate =
    activeFleet > 0
      ? Math.round(((vehicleCounts.on_trip || 0) / activeFleet) * 10000) / 100
      : 0;

  // Driver counts
  const driverCounts = db
    .prepare(
      `
    SELECT COUNT(*) AS total_drivers,
      SUM(CASE WHEN status = 'OnDuty' THEN 1 ELSE 0 END) AS on_duty,
      SUM(CASE WHEN status = 'OnTrip' THEN 1 ELSE 0 END) AS on_trip,
      SUM(CASE WHEN status = 'OffDuty' THEN 1 ELSE 0 END) AS off_duty,
      SUM(CASE WHEN status = 'Suspended' THEN 1 ELSE 0 END) AS suspended
    FROM drivers
  `,
    )
    .get();

  // Trip counts
  const tripCounts = db
    .prepare(
      `
    SELECT COUNT(*) AS total_trips,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status = 'Dispatched' THEN 1 ELSE 0 END) AS dispatched,
      SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) AS draft,
      SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled
    FROM trips
  `,
    )
    .get();

  // Regional Vehicle Counts and Utilization
  const regionalVehicles = db
    .prepare(
      `
    SELECT r.name,
           COUNT(v.id) AS total_vehicles,
           SUM(CASE WHEN v.status = 'OnTrip' THEN 1 ELSE 0 END) AS on_trip,
           SUM(CASE WHEN v.status = 'Retired' THEN 1 ELSE 0 END) AS retired
    FROM regions r
    LEFT JOIN vehicles v ON r.id = v.region_id
    GROUP BY r.id
  `,
    )
    .all();

  const regionalUtilization = regionalVehicles.map((r) => {
    const activeInRegion = r.total_vehicles - (r.retired || 0);
    return {
      region: r.name,
      total_vehicles: r.total_vehicles,
      active_vehicles: activeInRegion,
      on_trip: r.on_trip,
      utilization_rate_percent:
        activeInRegion > 0
          ? Math.round(((r.on_trip || 0) / activeInRegion) * 10000) / 100
          : 0,
    };
  });

  // Top performing driver by region
  const topDrivers = db
    .prepare(
      `
    SELECT r.name AS region, d.name AS driver_name, COUNT(t.id) as completed_trips
    FROM regions r
    LEFT JOIN drivers d ON r.id = d.region_id
    LEFT JOIN trips t ON d.id = t.driver_id AND t.status = 'Completed'
    GROUP BY r.id, d.id
    HAVING completed_trips > 0
    ORDER BY r.id, completed_trips DESC
  `,
    )
    .all();

  const topDriverPerRegion = {};
  topDrivers.forEach((td) => {
    if (!topDriverPerRegion[td.region]) {
      topDriverPerRegion[td.region] = {
        driver_name: td.driver_name,
        completed_trips: td.completed_trips,
      };
    }
  });

  // Most expensive vehicle by maintenance cost
  const mostExpensiveVehicle = db
    .prepare(
      `
    SELECT v.id, v.model, v.license_plate, COALESCE(SUM(m.cost), 0) AS total_maintenance_cost
    FROM vehicles v
    LEFT JOIN maintenance_logs m ON v.id = m.vehicle_id
    GROUP BY v.id
    ORDER BY total_maintenance_cost DESC
    LIMIT 1
  `,
    )
    .get();

  // Pending Cargo - sum of cargo_weight for Draft trips
  const pendingCargoResult = db
    .prepare(
      "SELECT COALESCE(SUM(cargo_weight), 0) AS total_weight, COUNT(*) AS count FROM trips WHERE status = 'Draft'",
    )
    .get();

  // Total revenue and costs
  const totalRevenue = db
    .prepare(
      "SELECT COALESCE(SUM(revenue), 0) AS total FROM trips WHERE status = 'Completed'",
    )
    .get().total;
  const fuelCost = db
    .prepare("SELECT COALESCE(SUM(cost), 0) AS total FROM fuel_logs")
    .get().total;
  const maintenanceCost = db
    .prepare("SELECT COALESCE(SUM(cost), 0) AS total FROM maintenance_logs")
    .get().total;
  const totalOperationalCost = fuelCost + maintenanceCost;

  // Monthly revenue trend (last 6 months)
  const monthlyRevenue = db
    .prepare(
      `
    SELECT strftime('%Y-%m', created_at) AS month,
           COALESCE(SUM(revenue), 0) AS revenue,
           COUNT(*) AS trips
    FROM trips
    WHERE status = 'Completed'
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month ASC
  `,
    )
    .all();

  res.json({
    kpis: {
      total_vehicles: vehicleCounts.total_vehicles || 0,
      active_fleet: activeFleet,
      on_trip: vehicleCounts.on_trip || 0,
      available: vehicleCounts.available || 0,
      in_shop: vehicleCounts.in_shop || 0,
      retired: vehicleCounts.retired || 0,
      utilization_rate_percent: utilizationRate,
      pending_cargo: pendingCargoResult.count || 0,
      pending_cargo_weight: pendingCargoResult.total_weight || 0,
      total_drivers: driverCounts.total_drivers || 0,
      drivers_on_duty: driverCounts.on_duty || 0,
      total_trips: tripCounts.total_trips || 0,
      completed_trips: tripCounts.completed || 0,
      dispatched_trips: tripCounts.dispatched || 0,
    },
    revenue: totalRevenue,
    costs: {
      fuel_cost: fuelCost,
      maintenance_cost: maintenanceCost,
      total_operational_cost: totalOperationalCost,
    },
    profit: totalRevenue - totalOperationalCost,
    monthly_revenue: monthlyRevenue,
    regional_metrics: {
      utilization: regionalUtilization,
      top_drivers: topDriverPerRegion,
    },
    most_expensive_vehicle:
      mostExpensiveVehicle && mostExpensiveVehicle.total_maintenance_cost > 0
        ? mostExpensiveVehicle
        : null,
  });
});

// GET /analytics/vehicle/:id/history — Historical Monthly Trend
router.get("/vehicle/:id/history", (req, res) => {
  const vid = req.params.id;
  const vehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vid);
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

  const monthsRows = db
    .prepare(
      `
    SELECT DISTINCT strftime('%Y-%m', created_at) AS month FROM trips WHERE vehicle_id = ? AND status = 'Completed'
    UNION
    SELECT DISTINCT strftime('%Y-%m', created_at) AS month FROM fuel_logs WHERE vehicle_id = ?
    UNION
    SELECT DISTINCT strftime('%Y-%m', created_at) AS month FROM maintenance_logs WHERE vehicle_id = ?
    ORDER BY month ASC
  `,
    )
    .all(vid, vid, vid);

  const months = monthsRows.map((r) => r.month).filter((m) => m != null);

  const history = {
    vehicle_id: parseInt(vid),
    monthly_revenue: [],
    monthly_fuel_cost: [],
    monthly_maintenance_cost: [],
    cost_per_km_trend: [],
  };

  for (const month of months) {
    const rev = db
      .prepare(
        "SELECT COALESCE(SUM(revenue), 0) as total, COALESCE(SUM(end_odometer - start_odometer), 0) as distance FROM trips WHERE vehicle_id = ? AND status = 'Completed' AND strftime('%Y-%m', created_at) = ?",
      )
      .get(vid, month);
    history.monthly_revenue.push({ month, revenue: rev.total });

    const fuel = db
      .prepare(
        "SELECT COALESCE(SUM(cost), 0) as total FROM fuel_logs WHERE vehicle_id = ? AND strftime('%Y-%m', created_at) = ?",
      )
      .get(vid, month);
    history.monthly_fuel_cost.push({ month, fuel_cost: fuel.total });

    const maint = db
      .prepare(
        "SELECT COALESCE(SUM(cost), 0) as total FROM maintenance_logs WHERE vehicle_id = ? AND strftime('%Y-%m', created_at) = ?",
      )
      .get(vid, month);
    history.monthly_maintenance_cost.push({
      month,
      maintenance_cost: maint.total,
    });

    const op_cost = fuel.total + maint.total;
    const cpkm =
      rev.distance > 0
        ? Math.round((op_cost / rev.distance) * 100) / 100
        : null;
    history.cost_per_km_trend.push({ month, cost_per_km: cpkm });
  }

  res.json(history);
});

// GET /analytics/vehicle/:id — Per-vehicle analytics summary
router.get("/vehicle/:id", (req, res) => {
  const vehicle = db
    .prepare("SELECT * FROM vehicles WHERE id = ?")
    .get(req.params.id);
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

  const tripStats = db
    .prepare(
      `
    SELECT COUNT(*) AS total_trips, COALESCE(SUM(revenue), 0) AS total_revenue, COALESCE(SUM(end_odometer - start_odometer), 0) AS total_distance
    FROM trips WHERE vehicle_id = ? AND status = 'Completed'
  `,
    )
    .get(req.params.id);

  const fuelData = db
    .prepare(
      "SELECT COALESCE(SUM(cost), 0) AS total, COALESCE(SUM(liters), 0) AS total_liters FROM fuel_logs WHERE vehicle_id = ?",
    )
    .get(req.params.id);
  const maintenanceCost = db
    .prepare(
      "SELECT COALESCE(SUM(cost), 0) AS total FROM maintenance_logs WHERE vehicle_id = ?",
    )
    .get(req.params.id).total;

  const operationalCost = fuelData.total + maintenanceCost;
  const roi =
    vehicle.acquisition_cost > 0
      ? Math.round(
          ((tripStats.total_revenue - operationalCost) /
            vehicle.acquisition_cost) *
            10000,
        ) / 100
      : null;
  const avgEfficiency =
    fuelData.total_liters > 0
      ? Math.round((tripStats.total_distance / fuelData.total_liters) * 100) /
        100
      : null;
  const costPerKm =
    tripStats.total_distance > 0
      ? Math.round((operationalCost / tripStats.total_distance) * 100) / 100
      : null;

  res.json({
    vehicle,
    trips: tripStats,
    costs: {
      fuel_cost: fuelData.total,
      maintenance_cost: maintenanceCost,
      operational_cost: operationalCost,
    },
    revenue: tripStats.total_revenue,
    profit: tripStats.total_revenue - operationalCost,
    roi_percent: roi,
    avg_fuel_efficiency_km_per_liter: avgEfficiency,
    cost_per_km: costPerKm,
  });
});

// GET /analytics/driver/:id — Per-driver analytics
router.get("/driver/:id", (req, res) => {
  const driver = db
    .prepare("SELECT * FROM drivers WHERE id = ?")
    .get(req.params.id);
  if (!driver) return res.status(404).json({ error: "Driver not found" });

  const tripStats = db
    .prepare(
      `
    SELECT COUNT(*) AS total_trips, 
           SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed_trips,
           SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_trips,
           COALESCE(SUM(CASE WHEN status = 'Completed' THEN revenue ELSE 0 END), 0) AS total_revenue,
           COALESCE(SUM(CASE WHEN status = 'Completed' THEN (end_odometer - start_odometer) ELSE 0 END), 0) AS total_distance
    FROM trips WHERE driver_id = ?
  `,
    )
    .get(req.params.id);

  const completionRate =
    tripStats.total_trips > 0
      ? Math.round(
          ((tripStats.completed_trips || 0) / tripStats.total_trips) * 10000,
        ) / 100
      : 0;
  const safetyScore = Math.max(0, 100 - (tripStats.cancelled_trips || 0) * 5);
  const licenseValid = driver.license_expiry
    ? driver.license_expiry >= new Date().toISOString().split("T")[0]
    : false;

  res.json({
    driver,
    performance: {
      completion_rate_percent: completionRate,
      safety_score: safetyScore,
      total_distance_km: tripStats.total_distance,
      total_revenue: tripStats.total_revenue,
    },
    compliance: {
      license_valid: licenseValid,
      license_expiry: driver.license_expiry,
    },
  });
});

// GET /analytics/notifications — Recent activity notifications
router.get("/notifications", (req, res) => {
  const notifications = [];

  // Recent completed trips
  const recentTrips = db
    .prepare(
      `
    SELECT t.id, d.name AS driver_name, v.license_plate, t.revenue, t.status, t.created_at
    FROM trips t
    LEFT JOIN drivers d ON t.driver_id = d.id
    LEFT JOIN vehicles v ON t.vehicle_id = v.id
    WHERE t.status IN ('Completed', 'Dispatched')
    ORDER BY t.created_at DESC LIMIT 5
  `,
    )
    .all();

  recentTrips.forEach((t) => {
    if (t.status === "Completed") {
      notifications.push({
        id: `trip-${t.id}`,
        type: "success",
        title: "Trip Completed",
        message: `Trip #${t.id} completed by ${t.driver_name} — $${t.revenue} revenue`,
        time: t.created_at,
      });
    } else {
      notifications.push({
        id: `trip-${t.id}`,
        type: "info",
        title: "Trip Dispatched",
        message: `Trip #${t.id} dispatched with ${t.license_plate}`,
        time: t.created_at,
      });
    }
  });

  // Vehicles in maintenance
  const inShop = db
    .prepare(
      `
    SELECT v.model, v.license_plate, ml.description, ml.date
    FROM vehicles v
    JOIN maintenance_logs ml ON v.id = ml.vehicle_id
    WHERE v.status = 'InShop'
    ORDER BY ml.date DESC LIMIT 3
  `,
    )
    .all();

  inShop.forEach((v) => {
    notifications.push({
      id: `maint-${v.license_plate}`,
      type: "warning",
      title: "Vehicle in Maintenance",
      message: `${v.license_plate} (${v.model}) — ${v.description}`,
      time: v.date,
    });
  });

  // Expired licenses
  const today = new Date().toISOString().split("T")[0];
  const expiredDrivers = db
    .prepare(
      `
    SELECT name, license_expiry FROM drivers 
    WHERE license_expiry < ? AND status != 'Suspended'
    ORDER BY license_expiry ASC LIMIT 3
  `,
    )
    .all(today);

  expiredDrivers.forEach((d) => {
    notifications.push({
      id: `license-${d.name}`,
      type: "error",
      title: "License Expired",
      message: `${d.name}'s license expired on ${d.license_expiry}`,
      time: d.license_expiry,
    });
  });

  // Sort by time descending
  notifications.sort((a, b) => b.time.localeCompare(a.time));

  res.json(notifications);
});

// GET /analytics/export — CSV export
router.get("/export", (req, res) => {
  const vehicles = db.prepare("SELECT * FROM vehicles ORDER BY id").all();
  const costs = getOperationalCostPerVehicle();

  const rows = vehicles.map((v) => {
    const vCosts = costs[v.id] || { fuel: 0, maintenance: 0, total: 0 };
    const tripData = db
      .prepare(
        "SELECT COUNT(*) AS total_trips, COALESCE(SUM(revenue), 0) AS revenue, COALESCE(SUM(end_odometer - start_odometer), 0) AS distance FROM trips WHERE vehicle_id = ? AND status = 'Completed'",
      )
      .get(v.id);
    const fuelData = db
      .prepare(
        "SELECT COALESCE(SUM(liters), 0) AS total_liters FROM fuel_logs WHERE vehicle_id = ?",
      )
      .get(v.id);

    const roi =
      v.acquisition_cost > 0
        ? Math.round(
            ((tripData.revenue - vCosts.total) / v.acquisition_cost) * 10000,
          ) / 100
        : "N/A";
    const costPerKm =
      tripData.distance > 0
        ? Math.round((vCosts.total / tripData.distance) * 100) / 100
        : "N/A";
    const avgEfficiency =
      fuelData.total_liters > 0
        ? Math.round((tripData.distance / fuelData.total_liters) * 100) / 100
        : "N/A";

    return {
      id: v.id,
      model: v.model,
      type: v.type,
      license_plate: v.license_plate,
      status: v.status,
      region_id: v.region_id,
      total_distance_km: tripData.distance,
      revenue: tripData.revenue,
      fuel_cost: vCosts.fuel,
      maintenance_cost: vCosts.maintenance,
      operational_cost: vCosts.total,
      profit: tripData.revenue - vCosts.total,
      roi_percent: roi,
      cost_per_km: costPerKm,
      avg_efficiency_km_per_liter: avgEfficiency,
    };
  });

  if (rows.length === 0) return res.status(200).send("No vehicles found");

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => `"${row[h]}"`).join(",")),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=fleetflow_report.csv",
  );
  res.send(csv);
});

module.exports = router;
