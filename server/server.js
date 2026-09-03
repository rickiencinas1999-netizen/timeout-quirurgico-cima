"use strict";

/* API compartida del Time Out Quirúrgico (CIMA).
   Permite que distintas personas (preanestesia, quirófano) guarden y
   continúen el mismo registro desde dispositivos distintos. Sin esto,
   cada quien solo veía lo que guardaba en su propio navegador. */

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const APP_KEY = process.env.APP_KEY || "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!process.env.DATABASE_URL) {
  console.error("Falta la variable de entorno DATABASE_URL.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registros (
      id TEXT PRIMARY KEY,
      paciente TEXT,
      expediente TEXT,
      fecha TEXT,
      cirugia TEXT,
      completo BOOLEAN NOT NULL DEFAULT FALSE,
      data JSONB NOT NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_registros_actualizado ON registros (actualizado_en DESC);
  `);
}

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error("Origen no permitido"));
    },
  })
);

// Clave compartida simple (no es una cuenta por persona): evita que
// alguien que encuentre la URL por casualidad lea o modifique registros.
app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/api/health") return next();
  if (!APP_KEY) return next();
  if (req.get("X-App-Key") !== APP_KEY) {
    return res.status(401).json({ error: "Clave de acceso inválida o ausente." });
  }
  next();
});

app.get("/", (req, res) => {
  res.json({ service: "timeout-quirurgico-api", status: "ok" });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/registros", async (req, res) => {
  try {
    const { q } = req.query;
    const limit = Math.min(Number(req.query.limit) || 300, 500);
    const params = [];
    let where = "";
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE paciente ILIKE $${params.length} OR expediente ILIKE $${params.length} OR cirugia ILIKE $${params.length}`;
    }
    params.push(limit);
    const { rows } = await pool.query(
      `SELECT id, data, completo, creado_en, actualizado_en FROM registros ${where}
       ORDER BY actualizado_en DESC LIMIT $${params.length}`,
      params
    );
    res.json(rows.map(rowToRecord));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al listar registros." });
  }
});

app.get("/api/registros/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM registros WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Registro no encontrado." });
    res.json(rowToRecord(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el registro." });
  }
});

app.post("/api/registros", async (req, res) => {
  try {
    const record = req.body;
    if (!record || typeof record !== "object" || !record.id) {
      return res.status(400).json({ error: "Registro inválido: falta id." });
    }
    await upsert(record);
    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar el registro." });
  }
});

app.put("/api/registros/:id", async (req, res) => {
  try {
    const record = { ...req.body, id: req.params.id };
    await upsert(record);
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar el registro." });
  }
});

app.delete("/api/registros/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM registros WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar el registro." });
  }
});

async function upsert(record) {
  const general = record.general || {};
  await pool.query(
    `INSERT INTO registros (id, paciente, expediente, fecha, cirugia, completo, data, creado_en, actualizado_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()), now())
     ON CONFLICT (id) DO UPDATE SET
       paciente = EXCLUDED.paciente,
       expediente = EXCLUDED.expediente,
       fecha = EXCLUDED.fecha,
       cirugia = EXCLUDED.cirugia,
       completo = EXCLUDED.completo,
       data = EXCLUDED.data,
       actualizado_en = now()`,
    [
      record.id,
      general.paciente || null,
      general.expediente || null,
      general.fecha || null,
      general.cirugia || null,
      !!record.completo,
      record,
      record.creadoEn || null,
    ]
  );
}

function rowToRecord(row) {
  const data = row.data || {};
  data.id = row.id;
  data.completo = row.completo;
  data.creadoEn = data.creadoEn || toIso(row.creado_en);
  data.actualizadoEn = toIso(row.actualizado_en);
  return data;
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`API del Time Out Quirúrgico escuchando en el puerto ${PORT}`));
  })
  .catch((err) => {
    console.error("No se pudo inicializar la base de datos:", err);
    process.exit(1);
  });
