/**
 * FleetFlow — Comprehensive Self-Contained E2E Test Suite
 * Run: node test_e2e.js  (requires node seed2.js first to get regions)
 */

const http = require("http");
const MANAGER    = { "x-role": "Manager",    "Content-Type": "application/json" };
const DISPATCHER = { "x-role": "Dispatcher", "Content-Type": "application/json" };
const NO_ROLE    = { "Content-Type": "application/json" };

let passed = 0, failed = 0;
const failures = [];

function assert(label, condition, got, expected) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else {
    console.log(`  ❌ FAIL: ${label} | got: ${JSON.stringify(got)} | expected: ${JSON.stringify(expected)}`);
    failed++; failures.push({ label, got, expected });
  }
}

function request(method, path, body, headers = {}) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "localhost", port: 5000, path, method,
      headers: { "Content-Type": "application/json", ...headers,
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}) },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    if (payload) req.write(payload);
    req.end();
  });
}

const GET   = (path, h)      => request("GET",    path, null, h);
const POST  = (path, b, h)   => request("POST",   path, b, h);
const PUT   = (path, b, h)   => request("PUT",    path, b, h);
const PATCH = (path, b, h)   => request("PATCH",  path, b, h);
const DEL   = (path, h)      => request("DELETE", path, null, h);

async function run() {
  let res;

  // ──────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  SECTION 1: Regions                       ║");
  console.log("╚═══════════════════════════════════════════╝");

  res = await GET("/regions");
  assert("GET /regions — 200", res.status === 200, res.status, 200);
  assert("GET /regions — array", Array.isArray(res.body), typeof res.body, "array");
  const r1Id = res.body[0]?.id;
  assert("Has seeded region (run seed2.js first)", r1Id != null, r1Id, "id");

  res = await GET("/regions/999999");
  assert("GET /regions/999999 — 404", res.status === 404, res.status, 404);

  // ──────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  SECTION 2: Vehicles CRUD                 ║");
  console.log("╚═══════════════════════════════════════════╝");

  res = await POST("/vehicles", { model: "E2E Van", type: "Van", license_plate: "E2E-V001", max_capacity: 1000, acquisition_cost: 300000, region_id: r1Id });
  assert("POST /vehicles — 201", res.status === 201, res.status, 201);
  assert("POST /vehicles — type=Van", res.body.type === "Van", res.body.type, "Van");
  assert("POST /vehicles — region linked", res.body.region_id === r1Id, res.body.region_id, r1Id);
  const v1Id = res.body.id;

  res = await POST("/vehicles", { model: "E2E Truck", type: "Truck", license_plate: "E2E-V002", max_capacity: 5000 });
  assert("POST /vehicles v2 — 201", res.status === 201, res.status, 201);
  const v2Id = res.body.id;

  // Clean vehicle for delete test (no logs)
  res = await POST("/vehicles", { model: "Clean", type: "Truck", license_plate: "E2E-V003", max_capacity: 2000 });
  assert("POST /vehicles v3 — 201", res.status === 201, res.status, 201);
  const v3Id = res.body.id;

  res = await POST("/vehicles", { model: "Dup", license_plate: "E2E-V001", max_capacity: 100 });
  assert("POST /vehicles duplicate plate — 409", res.status === 409, res.status, 409);

  res = await POST("/vehicles", { model: "Missing fields" });
  assert("POST /vehicles missing required — 400", res.status === 400, res.status, 400);

  res = await POST("/vehicles", { model: "BadType", type: "Helicopter", license_plate: "E2E-BADT", max_capacity: 100 });
  assert("POST /vehicles invalid type enum — 500", res.status === 500, res.status, 500);

  res = await GET("/vehicles");
  assert("GET /vehicles — 200", res.status === 200, res.status, 200);

  res = await GET("/vehicles?type=Van");
  assert("GET /vehicles?type=Van — 200", res.status === 200, res.status, 200);
  assert("All results are Van", res.body.every(v => v.type === "Van"), true, true);

  res = await GET("/vehicles?type=Truck&status=Available");
  assert("GET /vehicles?type+status — 200", res.status === 200, res.status, 200);

  res = await GET(`/vehicles?region=${encodeURIComponent("North")}`);
  assert("GET /vehicles?region=North — 200", res.status === 200, res.status, 200);

  res = await GET(`/vehicles/${v1Id}`);
  assert("GET /vehicles/:id — 200", res.status === 200, res.status, 200);

  res = await GET("/vehicles/999999");
  assert("GET /vehicles/999999 — 404", res.status === 404, res.status, 404);

  res = await PUT(`/vehicles/${v1Id}`, { model: "Updated Van" });
  assert("PUT /vehicles/:id — 200", res.status === 200, res.status, 200);
  assert("PUT /vehicles — model changed", res.body.model === "Updated Van", res.body.model, "Updated Van");

  res = await PUT(`/vehicles/${v1Id}`, { status: "Flying" });
  assert("PUT /vehicles invalid status — 400", res.status === 400, res.status, 400);

  res = await PUT(`/vehicles/${v1Id}`, {});
  assert("PUT /vehicles empty body — 200 no-op", res.status === 200, res.status, 200);

  res = await DEL("/vehicles/999999");
  assert("DELETE /vehicles/999999 — 404", res.status === 404, res.status, 404);

  // Clean vehicle with no logs should delete fine
  res = await DEL(`/vehicles/${v3Id}`);
  assert("DELETE /vehicles (no refs) — 200", res.status === 200, res.status, 200);

  // ──────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  SECTION 3: Drivers CRUD                  ║");
  console.log("╚═══════════════════════════════════════════╝");

  res = await POST("/drivers", { name: "E2E Driver 1", license_type: "HMV", license_expiry: "2028-12-31", region_id: r1Id });
  assert("POST /drivers — 201", res.status === 201, res.status, 201);
  assert("POST /drivers — default OnDuty", res.body.status === "OnDuty", res.body.status, "OnDuty");
  assert("POST /drivers — region linked", res.body.region_id === r1Id, res.body.region_id, r1Id);
  const d1Id = res.body.id;

  res = await POST("/drivers", { name: "Expired Driver", license_expiry: "2020-01-01" });
  assert("POST /drivers expired license — 201 (blocked at trip, not at create)", res.status === 201, res.status, 201);
  const d2Id = res.body.id;

  res = await POST("/drivers", { name: "No expiry" });
  assert("POST /drivers missing license_expiry — 400", res.status === 400, res.status, 400);

  res = await GET("/drivers");
  assert("GET /drivers — 200", res.status === 200, res.status, 200);

  res = await GET(`/drivers/${d1Id}`);
  assert("GET /drivers/:id — 200", res.status === 200, res.status, 200);

  res = await GET("/drivers/999999");
  assert("GET /drivers/999999 — 404", res.status === 404, res.status, 404);

  res = await PUT(`/drivers/${d1Id}`, { status: "OffDuty" });
  assert("PUT /drivers OffDuty — 200", res.status === 200, res.status, 200);
  assert("PUT /drivers — status OffDuty", res.body.status === "OffDuty", res.body.status, "OffDuty");

  res = await PUT(`/drivers/${d1Id}`, { status: "Suspended" });
  assert("PUT /drivers Suspended — 200", res.status === 200, res.status, 200);

  res = await PUT(`/drivers/${d1Id}`, { status: "OnDuty" });
  assert("PUT /drivers back to OnDuty — 200", res.status === 200, res.status, 200);

  res = await PUT(`/drivers/${d1Id}`, { status: "Sleeping" });
  assert("PUT /drivers invalid status — 400", res.status === 400, res.status, 400);

  res = await PUT(`/drivers/${d1Id}`, {});
  assert("PUT /drivers empty body — 200 no-op", res.status === 200, res.status, 200);

  res = await DEL("/drivers/999999");
  assert("DELETE /drivers/999999 — 404", res.status === 404, res.status, 404);

  // ──────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  SECTION 4 & 5: Trips RBAC + Business Logic║");
  console.log("╚═══════════════════════════════════════════╝");

  // RBAC
  res = await POST("/trips", { vehicle_id: v1Id, driver_id: d1Id, cargo_weight: 100 }, NO_ROLE);
  assert("POST /trips no role — 401", res.status === 401, res.status, 401);
  res = await POST("/trips", { vehicle_id: v1Id, driver_id: d1Id, cargo_weight: 100 }, MANAGER);
  assert("POST /trips Manager — 403", res.status === 403, res.status, 403);

  // Create trip
  res = await POST("/trips", { vehicle_id: v1Id, driver_id: d1Id, cargo_weight: 100, origin_region_id: r1Id }, DISPATCHER);
  assert("POST /trips Dispatcher — 201", res.status === 201, res.status, 201);
  assert("POST /trips — status Draft", res.body.status === "Draft", res.body.status, "Draft");
  const t1Id = res.body.id;

  // Cargo exceeds capacity
  res = await POST("/trips", { vehicle_id: v1Id, driver_id: d1Id, cargo_weight: 9999 }, DISPATCHER);
  assert("POST /trips cargo exceeds — 400", res.status === 400, res.status, 400);

  // Dispatch
  res = await PATCH(`/trips/${t1Id}/dispatch`, null, DISPATCHER);
  assert("PATCH dispatch — 200", res.status === 200, res.status, 200);
  assert("Trip is Dispatched", res.body.trip?.status === "Dispatched", res.body.trip?.status, "Dispatched");

  // Vehicle OnTrip — can't assign another trip
  res = await POST("/trips", { vehicle_id: v1Id, driver_id: d2Id, cargo_weight: 10 }, DISPATCHER);
  assert("POST /trips vehicle OnTrip — 400", res.status === 400, res.status, 400);

  // Expired license — blocked
  res = await POST("/trips", { vehicle_id: v2Id, driver_id: d2Id, cargo_weight: 10 }, DISPATCHER);
  assert("POST /trips expired license — 400", res.status === 400, res.status, 400);
  assert("Error mentions license", res.body.error?.includes("license"), res.body.error, "contains license");

  // Driver already OnTrip
  res = await POST("/trips", { vehicle_id: v2Id, driver_id: d1Id, cargo_weight: 10 }, DISPATCHER);
  assert("POST /trips driver OnTrip — 400", res.status === 400, res.status, 400);

  // Can't dispatch already dispatched
  res = await PATCH(`/trips/${t1Id}/dispatch`, null, DISPATCHER);
  assert("PATCH dispatch again — 400", res.status === 400, res.status, 400);

  // Complete without end_odometer
  res = await PATCH(`/trips/${t1Id}/complete`, {}, DISPATCHER);
  assert("PATCH complete no odometer — 400", res.status === 400, res.status, 400);

  // Complete trip
  res = await PATCH(`/trips/${t1Id}/complete`, { end_odometer: 500, revenue: 12000 }, DISPATCHER);
  assert("PATCH complete — 200", res.status === 200, res.status, 200);
  assert("Trip is Completed", res.body.trip?.status === "Completed", res.body.trip?.status, "Completed");

  // Verify vehicle and driver reverted
  let vCheck = await GET(`/vehicles/${v1Id}`);
  let dCheck = await GET(`/drivers/${d1Id}`);
  assert("Vehicle reverted to Available after complete", vCheck.body.status === "Available", vCheck.body.status, "Available");
  assert("Driver reverted to OnDuty after complete", dCheck.body.status === "OnDuty", dCheck.body.status, "OnDuty");

  // Can't cancel or complete a completed trip
  res = await PATCH(`/trips/${t1Id}/cancel`, null, DISPATCHER);
  assert("PATCH cancel completed — 400", res.status === 400, res.status, 400);
  res = await PATCH(`/trips/${t1Id}/complete`, { end_odometer: 600 }, DISPATCHER);
  assert("PATCH complete completed again — 400", res.status === 400, res.status, 400);

  // Non-existent trip ops
  res = await PATCH("/trips/999999/dispatch", null, DISPATCHER);
  assert("PATCH dispatch non-existent — 404", res.status === 404, res.status, 404);
  res = await PATCH("/trips/999999/complete", { end_odometer: 100 }, DISPATCHER);
  assert("PATCH complete non-existent — 404", res.status === 404, res.status, 404);
  res = await PATCH("/trips/999999/cancel", null, DISPATCHER);
  assert("PATCH cancel non-existent — 404", res.status === 404, res.status, 404);

  // Cancel Draft trip
  let tc = await POST("/trips", { vehicle_id: v2Id, driver_id: d1Id, cargo_weight: 50 }, DISPATCHER);
  res = await PATCH(`/trips/${tc.body.id}/cancel`, null, DISPATCHER);
  assert("PATCH cancel Draft — 200", res.status === 200, res.status, 200);

  // Cancel Dispatched trip — states revert
  let tc2 = await POST("/trips", { vehicle_id: v2Id, driver_id: d1Id, cargo_weight: 50 }, DISPATCHER);
  await PATCH(`/trips/${tc2.body.id}/dispatch`, null, DISPATCHER);
  res = await PATCH(`/trips/${tc2.body.id}/cancel`, null, DISPATCHER);
  assert("PATCH cancel Dispatched — 200", res.status === 200, res.status, 200);
  vCheck = await GET(`/vehicles/${v2Id}`); dCheck = await GET(`/drivers/${d1Id}`);
  assert("Vehicle reverted to Available after cancel", vCheck.body.status === "Available", vCheck.body.status, "Available");
  assert("Driver reverted to OnDuty after cancel", dCheck.body.status === "OnDuty", dCheck.body.status, "OnDuty");

  // GET trips — no RBAC
  res = await GET("/trips");
  assert("GET /trips — 200 no RBAC", res.status === 200, res.status, 200);
  res = await GET(`/trips/${t1Id}`);
  assert("GET /trips/:id — 200", res.status === 200, res.status, 200);
  res = await GET("/trips/999999");
  assert("GET /trips/999999 — 404", res.status === 404, res.status, 404);
  res = await POST("/trips", {}, DISPATCHER);
  assert("POST /trips empty body — 400", res.status === 400, res.status, 400);

  // ──────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  SECTION 6: Vehicle Delete Rules          ║");
  console.log("╚═══════════════════════════════════════════╝");

  // v1 has trips — blocked
  res = await DEL(`/vehicles/${v1Id}`);
  assert("DELETE /vehicles with trips — 400 blocked", res.status === 400, res.status, 400);
  assert("Error message mentions trip", res.body.error?.includes("trip"), res.body.error, "contains 'trip'");

  // v2 has trips — blocked
  res = await DEL(`/vehicles/${v2Id}`);
  assert("DELETE /vehicles v2 with trips — 400 blocked", res.status === 400, res.status, 400);

  // InShop vehicle blocked by status
  await PUT(`/vehicles/${v1Id}`, { status: "InShop" });
  res = await DEL(`/vehicles/${v1Id}`);
  assert("DELETE /vehicles InShop — 400", res.status === 400, res.status, 400);
  await PUT(`/vehicles/${v1Id}`, { status: "Available" });

  // Retired vehicle — blocked by status
  await PUT(`/vehicles/${v1Id}`, { status: "Retired" });
  res = await DEL(`/vehicles/${v1Id}`);
  assert("DELETE /vehicles Retired — 400", res.status === 400, res.status, 400);
  await PUT(`/vehicles/${v1Id}`, { status: "Available" });

  // ──────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  SECTION 7: Driver Delete Rules           ║");
  console.log("╚═══════════════════════════════════════════╝");

  res = await DEL("/drivers/999999");
  assert("DELETE /drivers/999999 — 404", res.status === 404, res.status, 404);

  let vTmp = await POST("/vehicles", { model: "Tmp", license_plate: "E2E-DTMP", max_capacity: 500 });
  let tDel = await POST("/trips", { vehicle_id: vTmp.body.id, driver_id: d1Id, cargo_weight: 50 }, DISPATCHER);
  await PATCH(`/trips/${tDel.body.id}/dispatch`, null, DISPATCHER);
  res = await DEL(`/drivers/${d1Id}`);
  assert("DELETE /drivers OnTrip — 400", res.status === 400, res.status, 400);
  await PATCH(`/trips/${tDel.body.id}/complete`, { end_odometer: 999 }, DISPATCHER);

  // ──────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  SECTION 8: Fuel Logs                     ║");
  console.log("╚═══════════════════════════════════════════╝");

  let fV = await POST("/vehicles", { model: "Fuel Van", license_plate: "E2E-FUEL", max_capacity: 1000 });
  const fvId = fV.body.id;

  res = await POST("/fuel", { vehicle_id: fvId, liters: 40, cost: 3200 });
  assert("POST /fuel — 201", res.status === 201, res.status, 201);

  res = await POST("/fuel", { vehicle_id: 999999, liters: 10, cost: 500 });
  assert("POST /fuel non-existent vehicle — 404", res.status === 404, res.status, 404);

  res = await POST("/fuel", { vehicle_id: fvId, trip_id: 999999, liters: 10, cost: 500 });
  assert("POST /fuel invalid trip_id — 404 (explicit validation)", res.status === 404, res.status, 404);

  res = await POST("/fuel", { vehicle_id: fvId, liters: 40 });
  assert("POST /fuel missing cost — 400", res.status === 400, res.status, 400);

  res = await POST("/fuel", { liters: 10, cost: 100 });
  assert("POST /fuel missing vehicle_id — 400", res.status === 400, res.status, 400);

  res = await POST("/fuel", { vehicle_id: fvId, liters: 0, cost: 0 });
  assert("POST /fuel zero liters — 201 (no crash)", res.status === 201, res.status, 201);

  res = await GET("/fuel");
  assert("GET /fuel — 200", res.status === 200, res.status, 200);

  res = await GET(`/fuel/vehicle/${fvId}`);
  assert("GET /fuel/vehicle/:id — 200", res.status === 200, res.status, 200);
  assert("GET /fuel/vehicle/:id — array", Array.isArray(res.body), Array.isArray(res.body), true);

  res = await GET("/fuel/vehicle/999999");
  assert("GET /fuel/vehicle/999999 — 404", res.status === 404, res.status, 404);

  // ──────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  SECTION 9: Maintenance Logs              ║");
  console.log("╚═══════════════════════════════════════════╝");

  let mV = await POST("/vehicles", { model: "Maint Truck", license_plate: "E2E-MAINT", max_capacity: 2000 });
  const mvId = mV.body.id;

  res = await POST("/maintenance", { vehicle_id: mvId, description: "Oil change", cost: 3500 });
  assert("POST /maintenance — 201", res.status === 201, res.status, 201);

  let mvCheck = await GET(`/vehicles/${mvId}`);
  assert("Maintenance auto-sets InShop", mvCheck.body.status === "InShop", mvCheck.body.status, "InShop");

  res = await POST("/trips", { vehicle_id: mvId, driver_id: d1Id, cargo_weight: 50 }, DISPATCHER);
  assert("POST /trips InShop vehicle — 400", res.status === 400, res.status, 400);

  res = await POST("/maintenance", { vehicle_id: 999999, description: "Fix", cost: 1000 });
  assert("POST /maintenance non-existent vehicle — 404", res.status === 404, res.status, 404);

  res = await POST("/maintenance", { vehicle_id: mvId, description: "No cost" });
  assert("POST /maintenance missing cost — 400", res.status === 400, res.status, 400);

  res = await GET("/maintenance");
  assert("GET /maintenance — 200", res.status === 200, res.status, 200);

  res = await GET(`/maintenance/vehicle/${mvId}`);
  assert("GET /maintenance/vehicle/:id — 200", res.status === 200, res.status, 200);

  res = await GET("/maintenance/vehicle/999999");
  assert("GET /maintenance/vehicle/999999 — 404", res.status === 404, res.status, 404);

  await PUT(`/vehicles/${mvId}`, { status: "Available" });

  // ──────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  SECTION 10: Analytics RBAC               ║");
  console.log("╚═══════════════════════════════════════════╝");

  const routes = [
    "/analytics/summary", `/analytics/vehicle/${v1Id}`, `/analytics/driver/${d1Id}`,
    `/analytics/vehicle/${v1Id}/history`, "/analytics/export"
  ];
  for (const r of routes) {
    res = await GET(r, DISPATCHER);
    assert(`GET ${r} (Dispatcher) — 403`, res.status === 403, res.status, 403);
  }
  for (const r of routes) {
    res = await GET(r, NO_ROLE);
    assert(`GET ${r} (no role) — 401`, res.status === 401, res.status, 401);
  }

  // ──────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  SECTION 11: Analytics Data               ║");
  console.log("╚═══════════════════════════════════════════╝");

  res = await GET("/analytics/summary", MANAGER);
  assert("GET /analytics/summary — 200", res.status === 200, res.status, 200);
  assert("Has kpis", !!res.body.kpis, !!res.body.kpis, true);
  assert("kpis.utilization_rate_percent >= 0", res.body.kpis?.utilization_rate_percent >= 0, res.body.kpis?.utilization_rate_percent, ">=0");
  assert("kpis.pending_cargo is number", typeof res.body.kpis?.pending_cargo === "number", typeof res.body.kpis?.pending_cargo, "number");
  assert("Has regional_metrics", !!res.body.regional_metrics, !!res.body.regional_metrics, true);
  assert("Has profit field", "profit" in res.body, "profit" in res.body, true);

  res = await GET(`/analytics/vehicle/${v1Id}`, MANAGER);
  assert("GET /analytics/vehicle/:id — 200", res.status === 200, res.status, 200);
  assert("Has cost_per_km field", "cost_per_km" in res.body, "cost_per_km" in res.body, true);
  assert("Has roi_percent field", "roi_percent" in res.body, "roi_percent" in res.body, true);
  assert("Has costs object", !!res.body.costs, !!res.body.costs, true);
  assert("Has profit field", "profit" in res.body, "profit" in res.body, true);

  res = await GET("/analytics/vehicle/999999", MANAGER);
  assert("GET /analytics/vehicle/999999 — 404", res.status === 404, res.status, 404);

  res = await GET(`/analytics/vehicle/${v1Id}/history`, MANAGER);
  assert("GET vehicle history — 200", res.status === 200, res.status, 200);
  assert("History monthly_revenue array", Array.isArray(res.body.monthly_revenue), Array.isArray(res.body.monthly_revenue), true);
  assert("History cost_per_km_trend array", Array.isArray(res.body.cost_per_km_trend), Array.isArray(res.body.cost_per_km_trend), true);

  res = await GET("/analytics/vehicle/999999/history", MANAGER);
  assert("GET vehicle history 999999 — 404", res.status === 404, res.status, 404);

  res = await GET(`/analytics/driver/${d1Id}`, MANAGER);
  assert("GET /analytics/driver/:id — 200", res.status === 200, res.status, 200);
  assert("Has completion_rate_percent", "completion_rate_percent" in (res.body.performance || {}), "completion_rate_percent" in (res.body.performance || {}), true);
  assert("Has safety_score 0-100", res.body.performance?.safety_score >= 0 && res.body.performance?.safety_score <= 100, res.body.performance?.safety_score, "0-100");
  assert("Has license_valid", "license_valid" in (res.body.compliance || {}), "license_valid" in (res.body.compliance || {}), true);

  res = await GET("/analytics/driver/999999", MANAGER);
  assert("GET /analytics/driver/999999 — 404", res.status === 404, res.status, 404);

  res = await GET("/analytics/export", MANAGER);
  assert("GET /analytics/export — 200", res.status === 200, res.status, 200);

  // ──────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  SECTION 12: Edge & Unexpected Cases      ║");
  console.log("╚═══════════════════════════════════════════╝");

  // Zero capacity -> any cargo blocked
  let zV = await POST("/vehicles", { model: "Zero", license_plate: "E2E-Z001", max_capacity: 0 });
  assert("POST zero capacity vehicle — 201", zV.status === 201, zV.status, 201);
  res = await POST("/trips", { vehicle_id: zV.body.id, driver_id: d1Id, cargo_weight: 1 }, DISPATCHER);
  assert("POST /trips cargo=1 vs capacity=0 — 400", res.status === 400, res.status, 400);
  await DEL(`/vehicles/${zV.body.id}`);

  // Non-numeric ID
  res = await GET("/vehicles/abc");
  assert("GET /vehicles/abc — graceful (not crash)", [200, 404].includes(res.status), res.status, "200 or 404");

  // Root health check
  res = await GET("/");
  assert("GET / — 200 health", res.status === 200, res.status, 200);
  assert("GET / — has message", !!res.body.message, !!res.body.message, true);

  // Unknown route
  res = await GET("/not-a-route");
  assert("GET /not-a-route — 404", res.status === 404, res.status, 404);

  // String IDs in trip body
  res = await POST("/trips", { vehicle_id: "abc", driver_id: "xyz", cargo_weight: "heavy" }, DISPATCHER);
  assert("POST /trips string IDs — 400 or 404 (graceful)", [400, 404].includes(res.status), res.status, "400 or 404");

  // ──────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  RESULTS                                  ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log(`  Total:    ${passed + failed}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);

  if (failures.length > 0) {
    console.log("\n─── Failures ──────────────────────────────");
    failures.forEach(f => {
      console.log(`  ❌ ${f.label}`);
      console.log(`     got:      ${JSON.stringify(f.got)}`);
      console.log(`     expected: ${JSON.stringify(f.expected)}`);
    });
    process.exit(1);
  } else {
    console.log("\n  🎉 All tests passed! FleetFlow is rock solid.");
  }
}

run().catch(err => {
  console.error("\n🔥 TEST RUNNER CRASHED:", err.message, err.stack);
  process.exit(1);
});
