const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireFields } = require("../middleware/validate");

const VALID_STATUSES = ["OnDuty", "OffDuty", "OnTrip", "Suspended"];

// GET /drivers — List all drivers
router.get("/", (req, res) => {
  const drivers = db.prepare(`
    SELECT d.*, r.name AS region_name
    FROM drivers d
    LEFT JOIN regions r ON d.region_id = r.id
    ORDER BY d.id DESC
  `).all();
  res.json(drivers);
});

// GET /drivers/:id — Get single driver
router.get("/:id", (req, res) => {
  const driver = db.prepare("SELECT * FROM drivers WHERE id = ?").get(req.params.id);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found" });
  }
  res.json(driver);
});

// POST /drivers — Create driver
router.post("/", requireFields(["name", "license_expiry"]), (req, res) => {
  const { name, license_type, license_expiry, region_id } = req.body;

  const result = db.prepare(
    `INSERT INTO drivers (name, license_type, license_expiry, region_id)
     VALUES (?, ?, ?, ?)`
  ).run(name, license_type || null, license_expiry, region_id || null);

  const driver = db.prepare("SELECT * FROM drivers WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(driver);
});

// PUT /drivers/:id — Update driver
router.put("/:id", (req, res) => {
  const driver = db.prepare("SELECT * FROM drivers WHERE id = ?").get(req.params.id);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found" });
  }

  const { name, license_type, license_expiry, status, region_id } = req.body;

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  db.prepare(
    `UPDATE drivers SET
      name = COALESCE(?, name),
      license_type = COALESCE(?, license_type),
      license_expiry = COALESCE(?, license_expiry),
      status = COALESCE(?, status),
      region_id = COALESCE(?, region_id)
     WHERE id = ?`
  ).run(
    name || null,
    license_type || null,
    license_expiry || null,
    status || null,
    region_id || null,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM drivers WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// DELETE /drivers/:id — Delete driver (not if OnTrip)
router.delete("/:id", (req, res) => {
  const driver = db.prepare("SELECT * FROM drivers WHERE id = ?").get(req.params.id);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found" });
  }

  if (driver.status === "OnTrip") {
    return res.status(400).json({
      error: "Cannot delete driver currently on a trip.",
    });
  }

  db.prepare("DELETE FROM drivers WHERE id = ?").run(req.params.id);
  res.json({ message: "Driver deleted successfully" });
});

module.exports = router;
