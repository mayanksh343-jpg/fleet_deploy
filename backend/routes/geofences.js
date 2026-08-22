const express = require("express");
const router = express.Router();
const db = require("../db");

// ── GET /geofences — List all geofences ──
router.get("/", (req, res) => {
  const geofences = db.prepare(`
    SELECT g.*, r.name AS region_name
    FROM geofences g
    LEFT JOIN regions r ON g.region_id = r.id
    ORDER BY g.created_at DESC
  `).all();
  res.json(geofences);
});

// ── POST /geofences — Create a geofence ──
router.post("/", (req, res) => {
  const { name, type, center_lat, center_lng, radius_km, region_id, alert_on_entry, alert_on_exit } = req.body;

  if (!name) return res.status(400).json({ error: "Name is required" });

  const result = db.prepare(`
    INSERT INTO geofences (name, type, center_lat, center_lng, radius_km, region_id, alert_on_entry, alert_on_exit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, type || "circle", center_lat || 0, center_lng || 0, radius_km || 5, region_id || null, alert_on_entry ?? 1, alert_on_exit ?? 1);

  const geofence = db.prepare("SELECT * FROM geofences WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(geofence);
});

// ── PUT /geofences/:id — Update a geofence ──
router.put("/:id", (req, res) => {
  const { name, type, center_lat, center_lng, radius_km, region_id, alert_on_entry, alert_on_exit, status } = req.body;
  const existing = db.prepare("SELECT * FROM geofences WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Geofence not found" });

  db.prepare(`
    UPDATE geofences SET name = ?, type = ?, center_lat = ?, center_lng = ?, radius_km = ?,
    region_id = ?, alert_on_entry = ?, alert_on_exit = ?, status = ?
    WHERE id = ?
  `).run(
    name || existing.name,
    type || existing.type,
    center_lat ?? existing.center_lat,
    center_lng ?? existing.center_lng,
    radius_km ?? existing.radius_km,
    region_id ?? existing.region_id,
    alert_on_entry ?? existing.alert_on_entry,
    alert_on_exit ?? existing.alert_on_exit,
    status || existing.status,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM geofences WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// ── DELETE /geofences/:id — Delete geofence ──
router.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM geofences WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Geofence not found" });

  db.prepare("DELETE FROM geofence_events WHERE geofence_id = ?").run(req.params.id);
  db.prepare("DELETE FROM geofences WHERE id = ?").run(req.params.id);
  res.json({ message: "Geofence deleted" });
});

// ── GET /geofences/events — Recent geofence events ──
router.get("/events", (req, res) => {
  const events = db.prepare(`
    SELECT ge.*, g.name AS geofence_name, v.model AS vehicle_model, v.license_plate
    FROM geofence_events ge
    JOIN geofences g ON ge.geofence_id = g.id
    JOIN vehicles v ON ge.vehicle_id = v.id
    ORDER BY ge.timestamp DESC
    LIMIT 50
  `).all();
  res.json(events);
});

module.exports = router;
