const express = require("express");
const router = express.Router();
const db = require("../db");

// ── GET /scoring/leaderboard — Ranked driver list ──
router.get("/leaderboard", (req, res) => {
  const period = req.query.period || "current";

  const scores = db.prepare(`
    SELECT ds.*, d.name AS driver_name, d.status AS driver_status, d.license_type
    FROM driver_scores ds
    JOIN drivers d ON ds.driver_id = d.id
    WHERE ds.period = ?
    ORDER BY ds.overall_score DESC
  `).all(period);

  // Assign live ranks
  scores.forEach((s, i) => {
    s.rank = i + 1;
    try { s.badges = JSON.parse(s.badges || "[]"); } catch { s.badges = []; }
  });

  res.json(scores);
});

// ── GET /scoring/driver/:id — Individual score breakdown ──
router.get("/driver/:id", (req, res) => {
  const driverId = req.params.id;

  const driver = db.prepare("SELECT * FROM drivers WHERE id = ?").get(driverId);
  if (!driver) return res.status(404).json({ error: "Driver not found" });

  const scores = db.prepare(`
    SELECT * FROM driver_scores WHERE driver_id = ? ORDER BY calculated_at DESC
  `).all(driverId);

  scores.forEach(s => {
    try { s.badges = JSON.parse(s.badges || "[]"); } catch { s.badges = []; }
  });

  // Get recent trips for context
  const trips = db.prepare(`
    SELECT id, status, revenue, cargo_weight, start_location, end_location, created_at
    FROM trips WHERE driver_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(driverId);

  res.json({ driver, scores, recentTrips: trips });
});

// ── POST /scoring/recalculate — Recalculate scores from data ──
router.post("/recalculate", (req, res) => {
  const period = req.body.period || "current";
  const drivers = db.prepare("SELECT * FROM drivers").all();

  const insertOrUpdate = db.prepare(`
    INSERT INTO driver_scores (driver_id, period, safety_score, efficiency_score, punctuality_score, overall_score, rank, badges)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(driver_id, period) DO UPDATE SET
      safety_score = excluded.safety_score,
      efficiency_score = excluded.efficiency_score,
      punctuality_score = excluded.punctuality_score,
      overall_score = excluded.overall_score,
      badges = excluded.badges,
      calculated_at = datetime('now')
  `);

  const results = [];

  for (const driver of drivers) {
    // Safety: based on trip completion rate (no cancellations)
    const tripStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(revenue) as total_revenue,
        AVG(revenue) as avg_revenue
      FROM trips WHERE driver_id = ?
    `).get(driver.id);

    // Efficiency: based on fuel efficiency of associated trips
    const fuelStats = db.prepare(`
      SELECT AVG(f.efficiency) as avg_efficiency, SUM(f.cost) as total_fuel_cost
      FROM fuel_logs f
      JOIN trips t ON f.trip_id = t.id
      WHERE t.driver_id = ?
    `).get(driver.id);

    const total = tripStats.total || 0;
    const completed = tripStats.completed || 0;
    const cancelled = tripStats.cancelled || 0;

    // Score calculations (0-100)
    const safetyScore = total > 0 ? Math.round(((total - cancelled) / total) * 100) : 50;
    const efficiencyScore = fuelStats.avg_efficiency ? Math.min(100, Math.round(fuelStats.avg_efficiency * 10)) : 50;
    const punctualityScore = total > 0 ? Math.round((completed / total) * 100) : 50;
    const overallScore = Math.round((safetyScore * 0.35 + efficiencyScore * 0.35 + punctualityScore * 0.30));

    // Badges
    const badges = [];
    if (completed >= 10) badges.push({ icon: "🏆", name: "Road Warrior", desc: "10+ completed trips" });
    if (completed >= 5) badges.push({ icon: "⭐", name: "Rising Star", desc: "5+ completed trips" });
    if (safetyScore >= 90) badges.push({ icon: "🛡️", name: "Safety Champion", desc: "90%+ safety score" });
    if (efficiencyScore >= 80) badges.push({ icon: "⛽", name: "Fuel Saver", desc: "80%+ efficiency" });
    if (cancelled === 0 && total > 0) badges.push({ icon: "✅", name: "Perfect Record", desc: "Zero cancellations" });
    if ((tripStats.total_revenue || 0) > 5000) badges.push({ icon: "💰", name: "Revenue King", desc: "$5K+ total revenue" });

    insertOrUpdate.run(driver.id, period, safetyScore, efficiencyScore, punctualityScore, overallScore, JSON.stringify(badges));

    results.push({
      driver_id: driver.id,
      driver_name: driver.name,
      overall_score: overallScore,
      badges: badges.length,
    });
  }

  // Update ranks
  const ranked = db.prepare(`
    SELECT id FROM driver_scores WHERE period = ? ORDER BY overall_score DESC
  `).all(period);
  const updateRank = db.prepare("UPDATE driver_scores SET rank = ? WHERE id = ?");
  ranked.forEach((r, i) => updateRank.run(i + 1, r.id));

  res.json({ message: "Scores recalculated", count: results.length, results });
});

module.exports = router;
