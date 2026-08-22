# FleetFlow — Complete Mathematical Logic & Business Rules

This document provides a comprehensive breakdown of every mathematical formula, computed metric, business rule, and state machine transition used throughout the FleetFlow system.

---

## 1. Fleet Utilization Metrics

### 1.1 Active Fleet Count

```
Active Fleet = Total Vehicles − Retired Vehicles
```

**Source:** [`analytics.js:37`](file:///d:/FleetFlow/backend/routes/analytics.js#L37)

Retired vehicles are excluded from operational calculations to prevent skewing utilization metrics.

---

### 1.2 Fleet Utilization Rate (%)

```
Utilization Rate = (Vehicles OnTrip / Active Fleet) × 100
```

**Precision:** Rounded to 2 decimal places via `Math.round(value × 10000) / 100`.

**Source:** [`analytics.js:38-40`](file:///d:/FleetFlow/backend/routes/analytics.js#L38-L40) (backend), [`DashboardPage.tsx:99`](file:///d:/FleetFlow/frontend/src/app/pages/DashboardPage.tsx#L99) (frontend)

**Edge case:** Returns `0` when `Active Fleet = 0` to avoid division by zero.

---

### 1.3 Regional Utilization Rate (%)

Per-region utilization follows the same formula applied to each region's vehicle subset, **excluding Retired vehicles** (consistent with fleet-wide utilization):

```
Active Vehicles in Region = Total Vehicles in Region − Retired Vehicles in Region
Regional Utilization = (Vehicles OnTrip in Region / Active Vehicles in Region) × 100
```

**Source:** [`analytics.js:72-82`](file:///d:/FleetFlow/backend/routes/analytics.js#L72-L82)

---

## 2. Financial Analytics

### 2.1 Total Operational Cost

```
Total Operational Cost = Σ(fuel_logs.cost) + Σ(maintenance_logs.cost)
```

**Source:** [`analytics.js:112-114`](file:///d:/FleetFlow/backend/routes/analytics.js#L112-L114)

Both fuel and maintenance costs are aggregated fleet-wide using `SUM()` SQL aggregation with `COALESCE(..., 0)` for null safety.

---

### 2.2 Per-Vehicle Operational Cost

```
Vehicle Operational Cost = Vehicle Fuel Cost + Vehicle Maintenance Cost
```

Where:

```
Vehicle Fuel Cost        = Σ(fuel_logs.cost) WHERE vehicle_id = V
Vehicle Maintenance Cost = Σ(maintenance_logs.cost) WHERE vehicle_id = V
```

**Source:** [`analytics.js:6-22`](file:///d:/FleetFlow/backend/routes/analytics.js#L6-L22) (backend helper), [`ExpensesPage.tsx:92-98`](file:///d:/FleetFlow/frontend/src/app/pages/ExpensesPage.tsx#L92-L98) (frontend)

---

### 2.3 Net Profit

```
Net Profit = Total Revenue − Total Operational Cost
```

Where:

```
Total Revenue = Σ(trips.revenue) WHERE status = 'Completed'
```

**Source:** [`analytics.js:150`](file:///d:/FleetFlow/backend/routes/analytics.js#L150)

---

### 2.4 Profit Margin (%)

Computed on the frontend for display:

```
Profit Margin = (Net Profit / Total Revenue) × 100
```

**Edge case:** Uses `(totalRevenue || 1)` as denominator to avoid division by zero.

**Source:** [`AnalyticsPage.tsx:451`](file:///d:/FleetFlow/frontend/src/app/pages/AnalyticsPage.tsx#L451)

---

### 2.5 Vehicle ROI (%)

```
ROI = ((Total Vehicle Revenue − Vehicle Operational Cost) / Vehicle Acquisition Cost) × 100
```

**Precision:** Rounded to 2 decimal places.

**Edge case:** Returns `null` (or `"N/A"` in CSV) when `acquisition_cost = 0`.

**Source:** [`analytics.js:217`](file:///d:/FleetFlow/backend/routes/analytics.js#L217) (per-vehicle API), [`analytics.js:344`](file:///d:/FleetFlow/backend/routes/analytics.js#L344) (CSV export)

---

### 2.6 Cost Per Kilometer

```
Cost/km = Total Operational Cost / Total Distance Traveled
```

Where:

```
Total Distance = Σ(end_odometer − start_odometer) for completed trips
```

**Precision:** Rounded to 2 decimal places.

**Edge case:** Returns `null` when `distance = 0`.

**Source:** [`analytics.js:219`](file:///d:/FleetFlow/backend/routes/analytics.js#L219) (per-vehicle), [`analytics.js:196`](file:///d:/FleetFlow/backend/routes/analytics.js#L196) (monthly trend)

---

### 2.7 Monthly Revenue Trend

Aggregates revenue by calendar month using SQL `strftime('%Y-%m', created_at)`:

```
Monthly Revenue[month] = Σ(trips.revenue) WHERE status = 'Completed' AND month(created_at) = month
Monthly Trips[month]   = COUNT(trips) for that month
```

**Source:** [`analytics.js:117-125`](file:///d:/FleetFlow/backend/routes/analytics.js#L117-L125)

---

## 3. Fuel Efficiency

### 3.1 Trip Fuel Efficiency (km/L)

```
Efficiency = (Trip End Odometer − Trip Start Odometer) / Fuel Liters
```

**Precision:** Rounded to 2 decimal places.

**Precondition:** Both `end_odometer` and `start_odometer` must be non-null, and `liters > 0`.

**Source:** [`fuel.js:50-54`](file:///d:/FleetFlow/backend/routes/fuel.js#L50-L54)

---

### 3.2 Average Fleet Fuel Efficiency (km/L)

```
Avg Efficiency = Total Distance / Total Liters
```

Per-vehicle:

```
Avg Vehicle Efficiency = Vehicle Total Distance / Vehicle Total Fuel Liters
```

**Edge case:** Returns `null` when `total_liters = 0`.

**Source:** [`analytics.js:218`](file:///d:/FleetFlow/backend/routes/analytics.js#L218) (backend), [`ExpensesPage.tsx:94-96`](file:///d:/FleetFlow/frontend/src/app/pages/ExpensesPage.tsx#L94-L96) (frontend average across logs)

---

## 4. Driver Performance

### 4.1 Trip Completion Rate (%)

```
Completion Rate = (Completed Trips / Total Trips) × 100
```

**Precision:** Rounded to 2 decimal places.

**Edge case:** Returns `0` when `total_trips = 0`.

**Source:** [`analytics.js:247`](file:///d:/FleetFlow/backend/routes/analytics.js#L247)

---

### 4.2 Safety Score (0–100)

```
Safety Score = max(0, 100 − (Cancelled Trips × 5))
```

Each cancelled trip deducts 5 points from a perfect 100. The score is floored at 0.

**Source:** [`analytics.js:248`](file:///d:/FleetFlow/backend/routes/analytics.js#L248)

---

### 4.3 License Compliance Check

```
License Valid = (driver.license_expiry ≥ today)
```

Where `today = new Date().toISOString().split("T")[0]` (ISO date string comparison).

**Source:** [`analytics.js:249`](file:///d:/FleetFlow/backend/routes/analytics.js#L249) (analytics), [`trips.js:74-79`](file:///d:/FleetFlow/backend/routes/trips.js#L74-L79) (trip creation guard)

---

## 5. Trip Lifecycle State Machine

### 5.1 State Diagram

```
[*] → Draft → Dispatched → Completed → [*]
                    ↘ Cancelled → [*]
         Draft → Cancelled → [*]
```

### 5.2 Transition Rules & Side Effects

| Transition                       | Guard Conditions                                                                                                                   | Transactional Side Effects                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Create → Draft**               | `cargo_weight ≤ vehicle.max_capacity`; `vehicle.status = 'Available'`; `driver.status = 'OnDuty'`; `driver.license_expiry ≥ today` | `trip.start_odometer = vehicle.odometer`                                                      |
| **Draft → Dispatched**           | `trip.status = 'Draft'`                                                                                                            | `vehicle.status → 'OnTrip'`; `driver.status → 'OnTrip'`                                       |
| **Dispatched → Completed**       | `trip.status = 'Dispatched'`; `end_odometer` required                                                                              | `vehicle.status → 'Available'`; `vehicle.odometer = end_odometer`; `driver.status → 'OnDuty'` |
| **Draft/Dispatched → Cancelled** | `trip.status ≠ 'Completed'` and `≠ 'Cancelled'`                                                                                    | If was Dispatched: `vehicle.status → 'Available'`; `driver.status → 'OnDuty'`                 |

**Source:** [`trips.js:37-184`](file:///d:/FleetFlow/backend/routes/trips.js#L37-L184)

All transitions are wrapped in SQLite transactions (`db.transaction()`) for atomicity.

---

### 5.3 Capacity Validation

```
IF cargo_weight > vehicle.max_capacity THEN reject with 400
```

**Source:** [`trips.js:52-57`](file:///d:/FleetFlow/backend/routes/trips.js#L52-L57)

---

## 6. Maintenance Side Effects

When a maintenance log is created:

```
INSERT maintenance_log → vehicle.status = 'InShop'
```

This is an atomic transaction — the log insertion and vehicle status update happen together.

**Source:** [`maintenance.js:42-52`](file:///d:/FleetFlow/backend/routes/maintenance.js#L42-L52)

---

## 7. Vehicle Deletion Guards

A vehicle can only be deleted when ALL of the following are true:

```
vehicle.status = 'Available'
COUNT(fuel_logs WHERE vehicle_id = V) = 0
COUNT(maintenance_logs WHERE vehicle_id = V) = 0
COUNT(trips WHERE vehicle_id = V) = 0
```

If any referenced records exist, the user is advised to set status to `'Retired'` instead.

**Source:** [`vehicles.js:117-141`](file:///d:/FleetFlow/backend/routes/vehicles.js#L117-L141)

---

## 8. Authentication & Security

### 8.1 Password Hashing

```
password_hash = bcrypt.hashSync(password, salt)     // salt rounds = 10
```

**Source:** [`auth.js:48-49`](file:///d:/FleetFlow/backend/routes/auth.js#L48-L49)

### 8.2 JWT Token Generation

```
token = jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '7d' })
```

**Source:** [`auth.js:58`](file:///d:/FleetFlow/backend/routes/auth.js#L58)

### 8.3 RBAC Hierarchy

Super Admin bypasses all role checks. Other roles are validated against per-route allow-lists:

| Route                                                                 | Allowed Roles               |
| --------------------------------------------------------------------- | --------------------------- |
| `POST /trips`, `PATCH /trips/:id/dispatch`, `PATCH /trips/:id/cancel` | Manager, Dispatcher         |
| `PATCH /trips/:id/complete`                                           | Manager, Dispatcher, Driver |
| All `/admin/*` routes                                                 | Super Admin only            |

**Source:** [`auth.js:41-62`](file:///d:/FleetFlow/backend/middleware/auth.js#L41-L62)

---

## 9. Vehicle Historical Trend Analysis

### 9.1 Monthly Cost-per-Kilometer Trend

For each calendar month with activity, the system computes:

```
Monthly Cost/km = (Monthly Fuel Cost + Monthly Maintenance Cost) / Monthly Distance
```

Where:

```
Monthly Fuel Cost        = Σ(fuel_logs.cost) for that vehicle & month
Monthly Maintenance Cost = Σ(maintenance_logs.cost) for that vehicle & month
Monthly Distance         = Σ(end_odometer − start_odometer) for completed trips in that month
```

**Edge case:** Returns `null` when `Monthly Distance = 0`.

**Source:** [`analytics.js:185-198`](file:///d:/FleetFlow/backend/routes/analytics.js#L185-L198)

---

## 10. CSV Export Calculations

The CSV export computes per-vehicle:

| Column                        | Formula                                                   |
| ----------------------------- | --------------------------------------------------------- |
| Column                        | Formula                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `total_distance_km`           | `Σ(end_odometer − start_odometer)` for completed trips    |
| `revenue`                     | `Σ(trips.revenue)` for completed trips                    |
| `fuel_cost`                   | `Σ(fuel_logs.cost)`                                       |
| `maintenance_cost`            | `Σ(maintenance_logs.cost)`                                |
| `operational_cost`            | `fuel_cost + maintenance_cost`                            |
| `profit`                      | `revenue − operational_cost`                              |
| `roi_percent`                 | `((revenue − operational_cost) / acquisition_cost) × 100` |
| `cost_per_km`                 | `operational_cost / total_distance_km`                    |
| `avg_efficiency_km_per_liter` | `total_distance_km / total_fuel_liters`                   |

**Source:** [`analytics.js:336-370`](file:///d:/FleetFlow/backend/routes/analytics.js#L336-L370)

---

## 11. Frontend Client-Side Computations

### 11.1 Dashboard Filtered KPIs

When filters (type/status/region) are active, the frontend recomputes KPIs client-side:

```javascript
totalVehicles = filteredVehicles.length
onTrip        = filteredVehicles.filter(v => v.status === 'OnTrip').length
available     = filteredVehicles.filter(v => v.status === 'Available').length
inShop        = filteredVehicles.filter(v => v.status === 'InShop').length
activeFleet   = filteredVehicles.filter(v => v.status !== 'Retired').length
utilization   = (onTrip / activeFleet) × 100   // same 2-decimal rounding
```

**Source:** [`DashboardPage.tsx:84-99`](file:///d:/FleetFlow/frontend/src/app/pages/DashboardPage.tsx#L84-L99)

### 11.2 Expenses Page Aggregations

```javascript
totalFuelCost = Σ(fuelLogs.cost);
totalLiters = Σ(fuelLogs.liters);
totalMaintenanceCost = Σ(maintenanceLogs.cost);
totalOperational = totalFuelCost + totalMaintenanceCost;
```

**Weighted Average Fuel Efficiency** (not arithmetic mean):

```javascript
totalWeightedDistance = Σ(log.efficiency × log.liters)   // reconstructs distance
efficiencyLiters      = Σ(log.liters) for logs with efficiency
avgEfficiency         = totalWeightedDistance / efficiencyLiters
```

Per-vehicle costs are computed by iterating fuel and maintenance logs client-side and grouping by `vehicle_id`.

**Source:** [`ExpensesPage.tsx:92-129`](file:///d:/FleetFlow/frontend/src/app/pages/ExpensesPage.tsx#L92-L129)

---

## 12. Summary of Rounding Conventions

| Metric              | Precision                  | Method                        |
| ------------------- | -------------------------- | ----------------------------- |
| Utilization Rate    | 2 decimal places           | `Math.round(x × 10000) / 100` |
| ROI                 | 2 decimal places           | `Math.round(x × 10000) / 100` |
| Fuel Efficiency     | 2 decimal places           | `Math.round(x × 100) / 100`   |
| Cost per km         | 2 decimal places           | `Math.round(x × 100) / 100`   |
| Profit Margin       | 0 decimal places (display) | `.toFixed(0)`                 |
| Utilization display | 1 decimal place            | `.toFixed(1)`                 |
