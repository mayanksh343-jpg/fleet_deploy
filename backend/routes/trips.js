const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireFields } = require("../middleware/validate");
const { requireRole } = require("../middleware/auth");

// GET /trips — List all trips
router.get("/", (req, res) => {
  const trips = db.prepare(`
    SELECT t.*, v.model AS vehicle_model, v.license_plate, d.name AS driver_name
    FROM trips t
    LEFT JOIN vehicles v ON t.vehicle_id = v.id
    LEFT JOIN drivers d ON t.driver_id = d.id
    ORDER BY t.id DESC
  `).all();
  res.json(trips);
});

// GET /trips/:id — Get single trip
router.get("/:id", (req, res) => {
  const trip = db.prepare(`
    SELECT t.*, v.model AS vehicle_model, v.license_plate, d.name AS driver_name
    FROM trips t
    LEFT JOIN vehicles v ON t.vehicle_id = v.id
    LEFT JOIN drivers d ON t.driver_id = d.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }
  res.json(trip);
});

// POST /trips — Create trip (Draft) - Dispatcher Only
// Business rules: capacity check, vehicle Available, driver OnDuty, license not expired
router.post("/", requireRole(["Manager", "Dispatcher"]), requireFields(["vehicle_id", "driver_id", "cargo_weight"]), (req, res) => {
  const { vehicle_id, driver_id, cargo_weight, start_location, end_location, revenue, origin_region_id, destination_region_id } = req.body;

  // Fetch vehicle
  const vehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vehicle_id);
  if (!vehicle) {
    return res.status(404).json({ error: "Vehicle not found" });
  }

  // Fetch driver
  const driver = db.prepare("SELECT * FROM drivers WHERE id = ?").get(driver_id);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found" });
  }

  // Rule: cargo_weight must not exceed vehicle max_capacity
  if (cargo_weight > vehicle.max_capacity) {
    return res.status(400).json({
      error: `Cargo weight (${cargo_weight}) exceeds vehicle max capacity (${vehicle.max_capacity})`,
    });
  }

  // Rule: vehicle must be Available
  if (vehicle.status !== "Available") {
    return res.status(400).json({
      error: `Vehicle status is '${vehicle.status}'. Must be 'Available' to assign a trip.`,
    });
  }

  // Rule: driver must be OnDuty
  if (driver.status !== "OnDuty") {
    return res.status(400).json({
      error: `Driver status is '${driver.status}'. Must be 'OnDuty' to assign a trip.`,
    });
  }

  // Rule: driver license must not be expired
  const today = new Date().toISOString().split("T")[0];
  if (driver.license_expiry && driver.license_expiry < today) {
    return res.status(400).json({
      error: `Driver license expired on ${driver.license_expiry}. Cannot assign trip.`,
    });
  }

  const result = db.prepare(
    `INSERT INTO trips (vehicle_id, driver_id, cargo_weight, start_location, end_location, start_odometer, revenue, origin_region_id, destination_region_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(vehicle_id, driver_id, cargo_weight, start_location || null, end_location || null, vehicle.odometer, revenue || 0, origin_region_id || null, destination_region_id || null);

  const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(trip);
});

// PATCH /trips/:id/dispatch — Dispatch a trip - Dispatcher Only
// Transaction: trip → Dispatched, vehicle → OnTrip, driver → OnTrip
router.patch("/:id/dispatch", requireRole(["Manager", "Dispatcher"]), (req, res) => {
  const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(req.params.id);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  if (trip.status !== "Draft") {
    return res.status(400).json({
      error: `Cannot dispatch trip with status '${trip.status}'. Must be 'Draft'.`,
    });
  }

  const dispatchTrip = db.transaction(() => {
    db.prepare("UPDATE trips SET status = 'Dispatched' WHERE id = ?").run(trip.id);
    db.prepare("UPDATE vehicles SET status = 'OnTrip' WHERE id = ?").run(trip.vehicle_id);
    db.prepare("UPDATE drivers SET status = 'OnTrip' WHERE id = ?").run(trip.driver_id);
  });

  dispatchTrip();

  const updated = db.prepare("SELECT * FROM trips WHERE id = ?").get(trip.id);
  res.json({ message: "Trip dispatched successfully", trip: updated });
});

// PATCH /trips/:id/complete — Complete a trip - Dispatcher & Driver Only
// Transaction: trip → Completed, vehicle → Available + odometer update, driver → OnDuty
router.patch("/:id/complete", requireRole(["Manager", "Dispatcher", "Driver"]), (req, res) => {
  const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(req.params.id);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  if (trip.status !== "Dispatched") {
    return res.status(400).json({
      error: `Cannot complete trip with status '${trip.status}'. Must be 'Dispatched'.`,
    });
  }

  const { end_odometer, revenue } = req.body || {};

  if (end_odometer == null) {
    return res.status(400).json({ error: "end_odometer is required to complete a trip" });
  }

  // If role is strictly "Driver", we can optionally enforce they only complete their OWN trips
  // req.user might be loaded by requireRole (if the middleware attaches it), but for now trusting the token role.
  
  const completeTrip = db.transaction(() => {
    db.prepare(
      "UPDATE trips SET status = 'Completed', end_odometer = ?, revenue = COALESCE(?, revenue) WHERE id = ?"
    ).run(end_odometer, revenue || null, trip.id);

    db.prepare(
      "UPDATE vehicles SET status = 'Available', odometer = ? WHERE id = ?"
    ).run(end_odometer, trip.vehicle_id);

    db.prepare("UPDATE drivers SET status = 'OnDuty' WHERE id = ?").run(trip.driver_id);
  });

  completeTrip();

  const updated = db.prepare("SELECT * FROM trips WHERE id = ?").get(trip.id);
  res.json({ message: "Trip completed successfully", trip: updated });
});

// PATCH /trips/:id/cancel — Cancel a trip - Dispatcher Only
// Transaction: if Dispatched, revert vehicle → Available, driver → OnDuty
router.patch("/:id/cancel", requireRole(["Manager", "Dispatcher"]), (req, res) => {
  const trip = db.prepare("SELECT * FROM trips WHERE id = ?").get(req.params.id);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  if (trip.status === "Completed" || trip.status === "Cancelled") {
    return res.status(400).json({
      error: `Cannot cancel trip with status '${trip.status}'.`,
    });
  }

  const cancelTrip = db.transaction(() => {
    db.prepare("UPDATE trips SET status = 'Cancelled' WHERE id = ?").run(trip.id);

    // If was Dispatched, revert vehicle and driver status
    if (trip.status === "Dispatched") {
      db.prepare("UPDATE vehicles SET status = 'Available' WHERE id = ?").run(trip.vehicle_id);
      db.prepare("UPDATE drivers SET status = 'OnDuty' WHERE id = ?").run(trip.driver_id);
    }
  });

  cancelTrip();

  const updated = db.prepare("SELECT * FROM trips WHERE id = ?").get(trip.id);
  res.json({ message: "Trip cancelled successfully", trip: updated });
});

module.exports = router;
