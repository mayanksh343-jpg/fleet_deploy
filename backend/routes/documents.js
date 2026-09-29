const express = require("express");
const router = express.Router();
const db = require("../db");

// ── GET /documents — List documents with filters ──
router.get("/", (req, res) => {
  const { entity_type, entity_id, status } = req.query;
  let sql = "SELECT * FROM documents WHERE 1=1";
  const params = [];

  if (entity_type) { sql += " AND entity_type = ?"; params.push(entity_type); }
  if (entity_id) { sql += " AND entity_id = ?"; params.push(entity_id); }
  if (status) { sql += " AND status = ?"; params.push(status); }

  sql += " ORDER BY uploaded_at DESC";
  const docs = db.prepare(sql).all(...params);
  res.json(docs);
});

// ── GET /documents/expiring — Documents expiring within N days ──
router.get("/expiring", (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const docs = db.prepare(`
    SELECT d.*,
      CASE d.entity_type
        WHEN 'driver' THEN (SELECT name FROM drivers WHERE id = d.entity_id)
        WHEN 'vehicle' THEN (SELECT model || ' (' || license_plate || ')' FROM vehicles WHERE id = d.entity_id)
      END AS entity_name
    FROM documents d
    WHERE d.expiry_date IS NOT NULL
      AND d.expiry_date <= date('now', '+' || ? || ' days')
      AND d.expiry_date >= date('now')
    ORDER BY d.expiry_date ASC
  `).all(days);
  res.json(docs);
});

// ── GET /documents/expired — Already expired documents ──
router.get("/expired", (req, res) => {
  const docs = db.prepare(`
    SELECT d.*,
      CASE d.entity_type
        WHEN 'driver' THEN (SELECT name FROM drivers WHERE id = d.entity_id)
        WHEN 'vehicle' THEN (SELECT model || ' (' || license_plate || ')' FROM vehicles WHERE id = d.entity_id)
      END AS entity_name
    FROM documents d
    WHERE d.expiry_date IS NOT NULL AND d.expiry_date < date('now')
    ORDER BY d.expiry_date ASC
  `).all();
  res.json(docs);
});

// ── POST /documents — Upload a new document ──
router.post("/", (req, res) => {
  const { entity_type, entity_id, doc_type, doc_name, file_url, expiry_date } = req.body;

  if (!entity_type || !entity_id || !doc_type || !doc_name) {
    return res.status(400).json({ error: "entity_type, entity_id, doc_type, and doc_name are required" });
  }

  // Auto-set status based on expiry
  let status = "Valid";
  if (expiry_date) {
    const now = new Date();
    const exp = new Date(expiry_date);
    const daysUntil = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) status = "Expired";
    else if (daysUntil <= 30) status = "Expiring";
  }

  const result = db.prepare(`
    INSERT INTO documents (entity_type, entity_id, doc_type, doc_name, file_url, expiry_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(entity_type, entity_id, doc_type, doc_name, file_url || null, expiry_date || null, status);

  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(doc);
});

// ── PUT /documents/:id — Update a document ──
router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Document not found" });

  const { doc_type, doc_name, file_url, expiry_date, status } = req.body;

  // Auto-calculate status if expiry changed
  let newStatus = status || existing.status;
  const newExpiry = expiry_date !== undefined ? expiry_date : existing.expiry_date;
  if (newExpiry && !status) {
    const now = new Date();
    const exp = new Date(newExpiry);
    const daysUntil = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) newStatus = "Expired";
    else if (daysUntil <= 30) newStatus = "Expiring";
    else newStatus = "Valid";
  }

  db.prepare(`
    UPDATE documents SET doc_type = ?, doc_name = ?, file_url = ?, expiry_date = ?, status = ?
    WHERE id = ?
  `).run(
    doc_type || existing.doc_type,
    doc_name || existing.doc_name,
    file_url !== undefined ? file_url : existing.file_url,
    newExpiry,
    newStatus,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// ── DELETE /documents/:id — Delete a document ──
router.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Document not found" });

  db.prepare("DELETE FROM documents WHERE id = ?").run(req.params.id);
  res.json({ message: "Document deleted" });
});

// ── GET /documents/stats — Summary counts ──
router.get("/stats", (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Valid' THEN 1 ELSE 0 END) as valid,
      SUM(CASE WHEN status = 'Expiring' THEN 1 ELSE 0 END) as expiring,
      SUM(CASE WHEN status = 'Expired' THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending
    FROM documents
  `).get();
  res.json(stats);
});

module.exports = router;
