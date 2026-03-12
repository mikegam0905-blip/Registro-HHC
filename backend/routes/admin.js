const express = require('express');
const router = express.Router();
const { dbAll, dbRun, dbGet } = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

// Auto-cleanup records older than 7 days
async function cleanOldRecords() {
  await dbRun(
    "DELETE FROM registros WHERE fecha_hora < datetime('now', '-7 days')"
  );
}

// GET /api/admin/records - Get all records (last 7 days)
router.get('/records', requireAdmin, async (req, res) => {
  try {
    await cleanOldRecords();

    const records = await dbAll(`
      SELECT 
        id,
        gpid,
        hhc,
        turno,
        date(fecha_hora) as fecha,
        time(fecha_hora) as hora,
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

// GET /api/admin/users - Get all users with status
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

// POST /api/admin/users - Create a new user
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
      'INSERT INTO usuarios (gpid, password, rol) VALUES (?, ?, ?)',
      [gpid, hash, rol]
    );

    res.json({ success: true, message: 'Usuario creado correctamente' });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// DELETE /api/admin/users/:gpid - Delete a user
router.delete('/users/:gpid', requireAdmin, async (req, res) => {
  try {
    const { gpid } = req.params;
    
    // Prevent self-deletion
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

// PATCH /api/admin/users/:gpid/unblock - Manually unblock a user
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
