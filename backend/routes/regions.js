const express = require("express");
const router = express.Router();
const db = require("../db");

// GET /regions — List all regions
router.get("/", (req, res) => {
  const regions = db.prepare("SELECT * FROM regions ORDER BY id ASC").all();
  res.json(regions);
});

module.exports = router;
