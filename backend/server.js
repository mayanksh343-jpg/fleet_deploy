const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const db = require("./db");
const errorHandler = require("./middleware/errorHandler");
const { authenticateToken } = require("./middleware/auth");

// Route modules
const authRoutes = require("./routes/auth");
const vehicleRoutes = require("./routes/vehicles");
const driverRoutes = require("./routes/drivers");
const tripRoutes = require("./routes/trips");
const fuelRoutes = require("./routes/fuel");
const maintenanceRoutes = require("./routes/maintenance");
const analyticsRoutes = require("./routes/analytics");
const regionRoutes = require("./routes/regions");
const adminRoutes = require("./routes/admin");
const profileRoutes = require("./routes/profile");
const notificationRoutes = require("./routes/notifications");
const scoringRoutes = require("./routes/scoring");
const geofenceRoutes = require("./routes/geofences");
const documentRoutes = require("./routes/documents");

const app = express();

// ── Security Middleware ──────────────────────────────────

// Helmet — secure HTTP headers (XSS, clickjacking, MIME-sniff protection)
app.use(helmet());

// CORS — restrict to frontend origin
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173").split(",");
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// Body parser with size limit
app.use(express.json({ limit: "1mb" }));

// ── Rate Limiting ────────────────────────────────────────

// Auth routes: 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API: 100 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: "Too many requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Routes ───────────────────────────────────────────────

// Health check (public)
app.get("/", (req, res) => {
  res.json({ message: "FleetFlow Backend Running", version: "2.1.0" });
});

// Auth routes (public — rate limited)
app.use("/auth", authLimiter, authRoutes);

// Protected routes — require JWT
app.use("/vehicles", apiLimiter, authenticateToken, vehicleRoutes);
app.use("/drivers", apiLimiter, authenticateToken, driverRoutes);
app.use("/trips", apiLimiter, authenticateToken, tripRoutes);
app.use("/fuel", apiLimiter, authenticateToken, fuelRoutes);
app.use("/maintenance", apiLimiter, authenticateToken, maintenanceRoutes);
app.use("/analytics", apiLimiter, authenticateToken, analyticsRoutes);
app.use("/regions", apiLimiter, authenticateToken, regionRoutes);
app.use("/admin", apiLimiter, authenticateToken, adminRoutes);
app.use("/profile", apiLimiter, authenticateToken, profileRoutes);
app.use("/notifications", apiLimiter, authenticateToken, notificationRoutes);
app.use("/scoring", apiLimiter, authenticateToken, scoringRoutes);
app.use("/geofences", apiLimiter, authenticateToken, geofenceRoutes);
app.use("/documents", apiLimiter, authenticateToken, documentRoutes);

// Centralized error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`FleetFlow API running on http://localhost:${PORT}`);
  console.log("Routes: /auth, /vehicles, /drivers, /trips, /fuel, /maintenance, /analytics, /regions, /admin, /profile, /notifications, /scoring, /geofences, /documents");
  console.log("Security: helmet, CORS, rate-limiting, JWT auth");
});