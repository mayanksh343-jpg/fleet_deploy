const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireFields } = require("../middleware/validate");

// GET /fuel — List all fuel logs
router.get("/", (req, res) => {
  const logs = db.prepare(`
    SELECT fl.*, v.model AS vehicle_model, v.license_plate
    FROM fuel_logs fl
    LEFT JOIN vehicles v ON fl.vehicle_id = v.id
    ORDER BY fl.id DESC
  `).all();
  res.json(logs);
});

// GET /fuel/vehicle/:id — Fuel logs for a specific vehicle
router.get("/vehicle/:id", (req, res) => {
  const vehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: "Vehicle not found" });
  }

  const logs = db.prepare(
    "SELECT * FROM fuel_logs WHERE vehicle_id = ? ORDER BY id DESC"
  ).all(req.params.id);

  res.json(logs);
});

// POST /fuel — Create fuel log
// Auto-calculates efficiency if trip_id is provided (from trip's odometer readings)
router.post("/", requireFields(["vehicle_id", "liters", "cost"]), (req, res) => {
  const { vehicle_id, trip_id, liters, cost, odometer_reading, date } = req.body;

  // Validate vehicle exists
  const vehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vehicle_id);
  if (!vehicle) {
    return res.status(404).json({ error: "Vehicle not found" });
  }

  // Validate trip if provided
  let efficiency = null;
  if (trip_id) {
    const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(trip_id);
    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }

    // Calculate fuel efficiency: (end_odometer - start_odometer) / liters
    if (trip.end_odometer && trip.start_odometer && liters > 0) {
      const distance = trip.end_odometer - trip.start_odometer;
      efficiency = Math.round((distance / liters) * 100) / 100;
    }
  }

  const result = db.prepare(
    `INSERT INTO fuel_logs (vehicle_id, trip_id, liters, cost, odometer_reading, efficiency, date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    vehicle_id,
    trip_id || null,
    liters,
    cost,
    odometer_reading || null,
    efficiency,
    date || new Date().toISOString().split("T")[0]
  );

  const log = db.prepare("SELECT * FROM fuel_logs WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(log);
});

module.exports = router;
