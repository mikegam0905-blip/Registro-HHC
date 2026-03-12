const express = require('express');
const router = express.Router();
const { dbRun, dbGet } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const BLOCK_MINUTES = 10;

// POST /api/records - Save a new record (normal user only)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { gpid, rol } = req.user;

    // Only normal users can submit forms
    if (rol !== 'usuario') {
      return res.status(403).json({ error: 'Solo usuarios normales pueden enviar registros' });
    }

    const { hhc, turno } = req.body;

    // Validate inputs
    if (!hhc || !hhc.trim()) {
      return res.status(400).json({ error: 'El número de HHC es requerido' });
    }

    const validTurnos = ['Turno 1', 'Turno 2', 'Turno 3'];
    if (!turno || !validTurnos.includes(turno)) {
      return res.status(400).json({ error: 'El turno debe ser Turno 1, Turno 2 o Turno 3' });
    }

    // Save record
    await dbRun(
      "INSERT INTO registros (gpid, hhc, turno, fecha_hora) VALUES (?, ?, ?, datetime('now'))",
      [gpid, hhc.trim(), turno]
    );

    // Block user for 10 minutes
    const blockedUntil = new Date(Date.now() + BLOCK_MINUTES * 60 * 1000).toISOString();
    await dbRun(
      'UPDATE usuarios SET bloqueado_hasta = ? WHERE gpid = ?',
      [blockedUntil, gpid]
    );

    // Invalidate current session
    await dbRun(
      'UPDATE sesiones SET activa = 0 WHERE token_id = ?',
      [req.user.jti]
    );

    res.json({
      success: true,
      message: 'Registro guardado correctamente',
      blockedUntil
    });
  } catch (err) {
    console.error('Record save error:', err);
    res.status(500).json({ error: 'Error al guardar el registro' });
  }
});

module.exports = router;
