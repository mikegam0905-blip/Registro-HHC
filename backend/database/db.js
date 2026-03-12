const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/app.db');

const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

// Baja California (America/Tijuana) = UTC-8 year-round since 2022
// SQLite no tiene soporte nativo de zonas horarias.
// Guardamos todos los timestamps ya convertidos a hora Tijuana.
function nowTijuana() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Tijuana' });
}

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

async function initDB() {
  await dbRun('PRAGMA journal_mode = WAL');
  await dbRun('PRAGMA foreign_keys = ON');

  await dbRun(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gpid TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('admin', 'usuario')),
      bloqueado_hasta TEXT DEFAULT NULL,
      creado_en TEXT DEFAULT NULL,
      ultimo_acceso TEXT DEFAULT NULL
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gpid TEXT NOT NULL,
      hhc TEXT NOT NULL,
      turno TEXT NOT NULL CHECK(turno IN ('Turno 1', 'Turno 2', 'Turno 3')),
      fecha_hora TEXT NOT NULL,
      FOREIGN KEY (gpid) REFERENCES usuarios(gpid)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS sesiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gpid TEXT NOT NULL,
      token_id TEXT UNIQUE NOT NULL,
      creado_en TEXT DEFAULT NULL,
      expira_en TEXT NOT NULL,
      activa INTEGER DEFAULT 1
    )
  `);

  const count = await dbGet('SELECT COUNT(*) as c FROM usuarios');
  if (count.c === 0) {
    const adminHash = await bcrypt.hash('Admin2024!', 12);
    const userHash  = await bcrypt.hash('Usuario123', 12);
    const now = nowTijuana();

    await dbRun(
      'INSERT INTO usuarios (gpid, password, rol, creado_en) VALUES (?, ?, ?, ?)',
      ['00000001', adminHash, 'admin', now]
    );
    await dbRun(
      'INSERT INTO usuarios (gpid, password, rol, creado_en) VALUES (?, ?, ?, ?)',
      ['12345678', userHash, 'usuario', now]
    );

    console.log('✅ Usuarios por defecto creados:');
    console.log('   Admin  → GPID: 00000001 | Pass: Admin2024!');
    console.log('   User   → GPID: 12345678 | Pass: Usuario123');
  }

  console.log('✅ Base de datos inicializada (zona: America/Tijuana)');
}

module.exports = { db, dbRun, dbGet, dbAll, initDB, nowTijuana };
