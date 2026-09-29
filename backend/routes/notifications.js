const express = require("express");
const router = express.Router();
const db = require("../db");

// ── GET /notifications — Auto-generated system notifications ──
router.get("/", (req, res) => {
  try {
    const notifications = [];

    // 1. Vehicles in maintenance/shop (warning)
    const inShop = db.prepare(
      "SELECT id, model, license_plate FROM vehicles WHERE status = 'InShop'"
    ).all();
    inShop.forEach((v) => {
      notifications.push({
        id: `shop-vehicle-${v.id}`,
        type: "warning",
        title: "Vehicle in Shop",
        message: `${v.model} (${v.license_plate}) is currently in the maintenance shop.`,
        time: "Active now",
      });
    });

    // 2. Active dispatches (info)
    const dispatched = db.prepare(
      "SELECT t.id, t.start_location, t.end_location, d.name AS driver_name FROM trips t LEFT JOIN drivers d ON t.driver_id = d.id WHERE t.status = 'Dispatched'"
    ).all();
    dispatched.forEach((t) => {
      notifications.push({
        id: `dispatch-${t.id}`,
        type: "info",
        title: "Active Dispatch",
        message: `Trip #${t.id}: ${t.driver_name || "Unassigned"} on route ${t.start_location || "?"} → ${t.end_location || "?"}`,
        time: "In progress",
      });
    });

    // 3. Recently completed trips (success)
    const completed = db.prepare(
      "SELECT t.id, t.revenue, d.name AS driver_name FROM trips t LEFT JOIN drivers d ON t.driver_id = d.id WHERE t.status = 'Completed' ORDER BY t.created_at DESC LIMIT 5"
    ).all();
    completed.forEach((t) => {
      notifications.push({
        id: `completed-${t.id}`,
        type: "success",
        title: "Trip Completed",
        message: `Trip #${t.id} by ${t.driver_name || "Unknown"} completed. Revenue: $${(t.revenue || 0).toLocaleString()}`,
        time: "Recent",
      });
    });

    // 4. Cancelled trips (error)
    const cancelled = db.prepare(
      "SELECT t.id, t.start_location, t.end_location, d.name AS driver_name FROM trips t LEFT JOIN drivers d ON t.driver_id = d.id WHERE t.status = 'Cancelled' ORDER BY t.created_at DESC LIMIT 3"
    ).all();
    cancelled.forEach((t) => {
      notifications.push({
        id: `cancel-${t.id}`,
        type: "error",
        title: "Trip Cancelled",
        message: `Trip #${t.id}: ${t.start_location || "?"} → ${t.end_location || "?"} was cancelled.`,
        time: "Recent",
      });
    });

    // 5. High mileage vehicles (warning)
    const highOdometer = db.prepare(
      "SELECT id, model, license_plate, odometer FROM vehicles WHERE odometer > 100000 AND status != 'InShop' ORDER BY odometer DESC LIMIT 3"
    ).all();
    highOdometer.forEach((v) => {
      notifications.push({
        id: `odometer-${v.id}`,
        type: "warning",
        title: "High Mileage Alert",
        message: `${v.model} (${v.license_plate}) has ${v.odometer.toLocaleString()} km — schedule maintenance soon.`,
        time: "Action required",
      });
    });

    // 6. Low fleet utilization (info)
    const totalVehicles = db.prepare("SELECT COUNT(*) as count FROM vehicles").get().count;
    const onTrip = db.prepare("SELECT COUNT(*) as count FROM vehicles WHERE status = 'OnTrip'").get().count;
    const utilization = totalVehicles > 0 ? Math.round((onTrip / totalVehicles) * 100) : 0;
    if (utilization < 30 && totalVehicles > 0) {
      notifications.push({
        id: `util-low`,
        type: "info",
        title: "Low Fleet Utilization",
        message: `Only ${utilization}% of fleet is deployed (${onTrip}/${totalVehicles} vehicles). Consider scheduling more dispatches.`,
        time: "Today",
      });
    }

    // 7. Recent maintenance completions (success)
    const recentMaint = db.prepare(
      "SELECT m.id, m.description, v.model, v.license_plate FROM maintenance_logs m JOIN vehicles v ON m.vehicle_id = v.id ORDER BY m.date DESC LIMIT 3"
    ).all();
    recentMaint.forEach((m) => {
      notifications.push({
        id: `maint-done-${m.id}`,
        type: "success",
        title: "Maintenance Completed",
        message: `${m.description} — ${m.model} (${m.license_plate})`,
        time: "Recent",
      });
    });

    // 8. Draft trips needing dispatch (warning)
    const drafts = db.prepare(
      "SELECT t.id, t.start_location, t.end_location FROM trips t WHERE t.status = 'Draft' ORDER BY t.created_at DESC LIMIT 3"
    ).all();
    drafts.forEach((t) => {
      notifications.push({
        id: `draft-${t.id}`,
        type: "warning",
        title: "Trip Awaiting Dispatch",
        message: `Trip #${t.id} (${t.start_location || "?"} → ${t.end_location || "?"}) is still in draft. Dispatch or cancel it.`,
        time: "Pending",
      });
    });

    res.json(notifications);
  } catch (err) {
    console.error("Notifications error:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

module.exports = router;
