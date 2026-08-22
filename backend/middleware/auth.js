const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./config");

/**
 * JWT Authentication Middleware.
 * Verifies Bearer token and attaches user info to req.user.
 * No fallback — valid JWT required for all protected routes.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role }
    req.userRole = decoded.role;
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * RBAC Middleware — checks req.userRole against allowed roles.
 * Super Admin bypasses all role checks.
 * Must be used AFTER authenticateToken.
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    const role = req.userRole;

    if (!role) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Super Admin bypasses all RBAC
    if (role === "Super Admin") {
      return next();
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        error: `Forbidden. Requires one of: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
}

/**
 * Super Admin Only Middleware.
 * Must be used AFTER authenticateToken.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.userRole) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.userRole !== "Super Admin") {
    return res.status(403).json({ error: "Super Admin access required" });
  }
  next();
}

module.exports = { authenticateToken, requireRole, requireSuperAdmin };
