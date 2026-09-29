// Phase 2 Seed Data — Driver Scores, Geofences, Documents
const db = require("./db");

// ── Seed Driver Scores ────────────────────────────────────
const drivers = db.prepare("SELECT * FROM drivers").all();
const existingScores = db.prepare("SELECT COUNT(*) as c FROM driver_scores").get().c;

if (existingScores === 0 && drivers.length > 0) {
  console.log("Seeding driver scores...");
  
  const insert = db.prepare(`
    INSERT OR IGNORE INTO driver_scores (driver_id, period, safety_score, efficiency_score, punctuality_score, overall_score, rank, badges)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const driver of drivers) {
    // Calculate from real data
    const tripStats = db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(revenue) as total_revenue
      FROM trips WHERE driver_id = ?
    `).get(driver.id);

    const fuelStats = db.prepare(`
      SELECT AVG(f.efficiency) as avg_eff
      FROM fuel_logs f JOIN trips t ON f.trip_id = t.id WHERE t.driver_id = ?
    `).get(driver.id);

    const total = tripStats.total || 0;
    const completed = tripStats.completed || 0;
    const cancelled = tripStats.cancelled || 0;

    const safety = total > 0 ? Math.round(((total - cancelled) / total) * 100) : 50;
    const efficiency = fuelStats.avg_eff ? Math.min(100, Math.round(fuelStats.avg_eff * 10)) : 50;
    const punctuality = total > 0 ? Math.round((completed / total) * 100) : 50;
    const overall = Math.round(safety * 0.35 + efficiency * 0.35 + punctuality * 0.30);

    const badges = [];
    if (completed >= 10) badges.push({ icon: "🏆", name: "Road Warrior", desc: "10+ completed trips" });
    if (completed >= 5) badges.push({ icon: "⭐", name: "Rising Star", desc: "5+ completed trips" });
    if (safety >= 90) badges.push({ icon: "🛡️", name: "Safety Champion", desc: "90%+ safety score" });
    if (efficiency >= 80) badges.push({ icon: "⛽", name: "Fuel Saver", desc: "80%+ efficiency" });
    if (cancelled === 0 && total > 0) badges.push({ icon: "✅", name: "Perfect Record", desc: "Zero cancellations" });
    if ((tripStats.total_revenue || 0) > 5000) badges.push({ icon: "💰", name: "Revenue King", desc: "$5K+ revenue" });

    insert.run(driver.id, "current", safety, efficiency, punctuality, overall, 0, JSON.stringify(badges));
  }

  // Update ranks
  const ranked = db.prepare("SELECT id FROM driver_scores WHERE period = 'current' ORDER BY overall_score DESC").all();
  const updateRank = db.prepare("UPDATE driver_scores SET rank = ? WHERE id = ?");
  ranked.forEach((r, i) => updateRank.run(i + 1, r.id));
  console.log(`  Seeded ${drivers.length} driver scores`);
}

// ── Seed Geofences ────────────────────────────────────────
const existingGeo = db.prepare("SELECT COUNT(*) as c FROM geofences").get().c;
if (existingGeo === 0) {
  console.log("Seeding geofences...");
  const regions = db.prepare("SELECT * FROM regions").all();
  
  const geofenceData = [
    { name: "Downtown Warehouse Hub", lat: 40.7128, lng: -74.006, radius: 3, region: "East" },
    { name: "Airport Cargo Terminal", lat: 33.9425, lng: -118.408, radius: 5, region: "West" },
    { name: "Central Distribution Center", lat: 41.8781, lng: -87.6298, radius: 4, region: "Central" },
    { name: "Port Authority Zone", lat: 40.7282, lng: -74.0776, radius: 2, region: "East" },
    { name: "Highway Rest Stop Alpha", lat: 39.7392, lng: -104.9903, radius: 1, region: "West" },
    { name: "Industrial Park South", lat: 29.7604, lng: -95.3698, radius: 6, region: "South" },
  ];

  const insertGeo = db.prepare(`
    INSERT INTO geofences (name, type, center_lat, center_lng, radius_km, region_id, alert_on_entry, alert_on_exit)
    VALUES (?, 'circle', ?, ?, ?, ?, ?, ?)
  `);

  for (const g of geofenceData) {
    const region = regions.find(r => r.name === g.region);
    insertGeo.run(g.name, g.lat, g.lng, g.radius, region?.id || null, 1, 1);
  }

  // Seed some geofence events
  const vehicles = db.prepare("SELECT id FROM vehicles LIMIT 6").all();
  const geofences = db.prepare("SELECT id FROM geofences").all();
  const insertEvent = db.prepare("INSERT INTO geofence_events (vehicle_id, geofence_id, event_type) VALUES (?, ?, ?)");

  for (let i = 0; i < Math.min(vehicles.length, geofences.length); i++) {
    insertEvent.run(vehicles[i].id, geofences[i].id, "entry");
    if (i % 2 === 0) insertEvent.run(vehicles[i].id, geofences[i].id, "exit");
  }
  console.log(`  Seeded ${geofenceData.length} geofences + events`);
}

// ── Seed Documents ────────────────────────────────────────
const existingDocs = db.prepare("SELECT COUNT(*) as c FROM documents").get().c;
if (existingDocs === 0) {
  console.log("Seeding documents...");
  const insertDoc = db.prepare(`
    INSERT INTO documents (entity_type, entity_id, doc_type, doc_name, expiry_date, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Driver documents
  for (const driver of drivers) {
    // Driver's license
    const licExpiry = driver.license_expiry || "2027-06-15";
    const daysUntil = Math.ceil((new Date(licExpiry) - new Date()) / (1000 * 60 * 60 * 24));
    const licStatus = daysUntil < 0 ? "Expired" : daysUntil <= 30 ? "Expiring" : "Valid";
    insertDoc.run("driver", driver.id, "Driver License", `${driver.name} - License (${driver.license_type || "CDL"})`, licExpiry, licStatus);

    // Insurance
    const insExpiry = "2026-09-30";
    insertDoc.run("driver", driver.id, "Insurance Certificate", `${driver.name} - Insurance`, insExpiry, "Valid");
  }

  // Vehicle documents
  const vehicles = db.prepare("SELECT * FROM vehicles").all();
  for (const v of vehicles) {
    // Registration
    insertDoc.run("vehicle", v.id, "Vehicle Registration", `${v.model} (${v.license_plate}) - Registration`, "2027-03-15", "Valid");

    // Insurance
    const vinsExpiry = v.id <= 3 ? "2026-04-01" : "2027-01-01";
    const vinsStatus = Math.ceil((new Date(vinsExpiry) - new Date()) / (1000 * 60 * 60 * 24)) <= 30 ? "Expiring" : "Valid";
    insertDoc.run("vehicle", v.id, "Insurance Policy", `${v.model} (${v.license_plate}) - Insurance`, vinsExpiry, vinsStatus);

    // Inspection if id is even
    if (v.id % 2 === 0) {
      insertDoc.run("vehicle", v.id, "Safety Inspection", `${v.model} - Inspection Report`, "2026-12-01", "Valid");
    }
  }

  console.log(`  Seeded driver + vehicle documents`);
}

console.log("Phase 2 seed data complete.");
