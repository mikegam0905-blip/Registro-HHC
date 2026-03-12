const express = require('express');
const router = express.Router();
const { dbRun } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { nowTijuana } = require('../database/db');

const BLOCK_MINUTES = 10;

router.post('/', requireAuth, async (req, res) => {
  try {
    const { gpid, rol } = req.user;

    if (rol !== 'usuario') {
      return res.status(403).json({ error: 'Solo usuarios normales pueden enviar registros' });
    }

    const { hhc, turno } = req.body;

    if (!hhc || !hhc.trim()) {
      return res.status(400).json({ error: 'El número de HHC es requerido' });
    }

    const validTurnos = ['Turno 1', 'Turno 2', 'Turno 3'];
    if (!turno || !validTurnos.includes(turno)) {
      return res.status(400).json({ error: 'El turno debe ser Turno 1, Turno 2 o Turno 3' });
    }

    // Guardar registro con hora Tijuana
    const fechaHoraTijuana = nowTijuana();
    await dbRun(
      'INSERT INTO registros (gpid, hhc, turno, fecha_hora) VALUES (?, ?, ?, ?)',
      [gpid, hhc.trim(), turno, fechaHoraTijuana]
    );

    // Bloquear usuario 10 minutos (timestamp ISO para comparación correcta)
    const blockedUntil = new Date(Date.now() + BLOCK_MINUTES * 60 * 1000).toISOString();
    await dbRun(
      'UPDATE usuarios SET bloqueado_hasta = ? WHERE gpid = ?',
      [blockedUntil, gpid]
    );

    // Invalidar sesión actual
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
