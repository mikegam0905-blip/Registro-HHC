const express = require('express');
const router = express.Router();
const { dbAll, dbRun, dbGet } = require('../database/db');
const { requireAdmin } = require('../middleware/auth');
const { nowTijuana } = require('../database/db');

// Eliminar registros con más de 7 días (comparando en hora local Tijuana)
async function cleanOldRecords() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toLocaleString('sv-SE', { timeZone: 'America/Tijuana' });
  await dbRun('DELETE FROM registros WHERE fecha_hora < ?', [cutoff]);
}

router.get('/records', requireAdmin, async (req, res) => {
  try {
    await cleanOldRecords();

    const records = await dbAll(`
      SELECT
        id, gpid, hhc, turno,
        substr(fecha_hora, 1, 10) as fecha,
        substr(fecha_hora, 12, 5) as hora,
        fecha_hora
      FROM registros
      ORDER BY fecha_hora DESC
    `);

    res.json({ success: true, records });
  } catch (err) {
    console.error('Admin records error:', err);
    res.status(500).json({ error: 'Error al obtener registros' });
  }
});

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await dbAll(`
      SELECT gpid, rol, bloqueado_hasta, ultimo_acceso
      FROM usuarios
      ORDER BY rol ASC, gpid ASC
    `);

    const now = new Date();
    const usersWithStatus = users.map(user => {
      let status = 'Disponible';
      let minutesLeft = null;
      let blockedUntil = null;

      if (user.rol === 'usuario' && user.bloqueado_hasta) {
        const blockEnd = new Date(user.bloqueado_hasta);
        if (blockEnd > now) {
          status = 'Bloqueado';
          minutesLeft = Math.ceil((blockEnd - now) / 60000);
          blockedUntil = user.bloqueado_hasta;
        }
      }

      return {
        gpid: user.gpid,
        rol: user.rol === 'admin' ? 'Administrador' : 'Usuario',
        status,
        minutesLeft,
        blockedUntil,
        ultimoAcceso: user.ultimo_acceso
      };
    });

    res.json({ success: true, users: usersWithStatus });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.post('/users', requireAdmin, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { gpid, password, rol } = req.body;

    if (!gpid || !/^\d{8}$/.test(gpid)) {
      return res.status(400).json({ error: 'GPID debe ser exactamente 8 dígitos' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    if (!['admin', 'usuario'].includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const existing = await dbGet('SELECT id FROM usuarios WHERE gpid = ?', [gpid]);
    if (existing) {
      return res.status(409).json({ error: 'El GPID ya existe' });
    }

    const hash = await bcrypt.hash(password, 12);
    await dbRun(
      'INSERT INTO usuarios (gpid, password, rol, creado_en) VALUES (?, ?, ?, ?)',
      [gpid, hash, rol, nowTijuana()]
    );

    res.json({ success: true, message: 'Usuario creado correctamente' });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.delete('/users/:gpid', requireAdmin, async (req, res) => {
  try {
    const { gpid } = req.params;

    if (gpid === req.user.gpid) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }

    const user = await dbGet('SELECT id FROM usuarios WHERE gpid = ?', [gpid]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    await dbRun('DELETE FROM usuarios WHERE gpid = ?', [gpid]);
    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

router.patch('/users/:gpid/unblock', requireAdmin, async (req, res) => {
  try {
    const { gpid } = req.params;
    await dbRun('UPDATE usuarios SET bloqueado_hasta = NULL WHERE gpid = ?', [gpid]);
    res.json({ success: true, message: 'Usuario desbloqueado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al desbloquear usuario' });
  }
});

module.exports = router;
