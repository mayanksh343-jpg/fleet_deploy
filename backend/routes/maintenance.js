const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireFields } = require("../middleware/validate");

// GET /maintenance — List all maintenance logs
router.get("/", (req, res) => {
  const logs = db.prepare(`
    SELECT ml.*, v.model AS vehicle_model, v.license_plate
    FROM maintenance_logs ml
    LEFT JOIN vehicles v ON ml.vehicle_id = v.id
    ORDER BY ml.id DESC
  `).all();
  res.json(logs);
});

// GET /maintenance/vehicle/:id — Maintenance logs for a specific vehicle
router.get("/vehicle/:id", (req, res) => {
  const vehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: "Vehicle not found" });
  }

  const logs = db.prepare(
    "SELECT * FROM maintenance_logs WHERE vehicle_id = ? ORDER BY id DESC"
  ).all(req.params.id);

  res.json(logs);
});

// POST /maintenance — Create maintenance log
// Transaction: insert log + set vehicle status to 'InShop'
router.post("/", requireFields(["vehicle_id", "description", "cost"]), (req, res) => {
  const { vehicle_id, description, cost, date } = req.body;

  // Validate vehicle exists
  const vehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vehicle_id);
  if (!vehicle) {
    return res.status(404).json({ error: "Vehicle not found" });
  }

  const createLog = db.transaction(() => {
    const result = db.prepare(
      `INSERT INTO maintenance_logs (vehicle_id, description, cost, date)
       VALUES (?, ?, ?, ?)`
    ).run(vehicle_id, description, cost, date || new Date().toISOString().split("T")[0]);

    // Auto-set vehicle status to 'InShop'
    db.prepare("UPDATE vehicles SET status = 'InShop' WHERE id = ?").run(vehicle_id);

    return result;
  });

  const result = createLog();

  const log = db.prepare("SELECT * FROM maintenance_logs WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({
    message: "Maintenance log created. Vehicle status set to 'InShop'.",
    log,
  });
});

module.exports = router;
