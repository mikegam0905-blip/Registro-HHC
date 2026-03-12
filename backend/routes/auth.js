const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { dbGet, dbRun } = require('../database/db');
const { generateToken, requireAuth } = require('../middleware/auth');
const { nowTijuana } = require('../database/db');

function validateGPID(gpid) {
  return /^\d{8}$/.test(gpid);
}

router.post('/login', async (req, res) => {
  try {
    const { gpid, password } = req.body;

    if (!gpid || !password) {
      return res.status(400).json({ error: 'GPID y contraseña son requeridos' });
    }

    if (!validateGPID(gpid)) {
      return res.status(400).json({ error: 'El GPID debe ser exactamente 8 dígitos numéricos' });
    }

    const user = await dbGet('SELECT * FROM usuarios WHERE gpid = ?', [gpid]);
    if (!user) {
      return res.status(401).json({ error: 'GPID o contraseña incorrectos' });
    }

    if (user.rol === 'usuario' && user.bloqueado_hasta) {
      const blockedUntil = new Date(user.bloqueado_hasta);
      const now = new Date();
      if (blockedUntil > now) {
        const minutesLeft = Math.ceil((blockedUntil - now) / 60000);
        return res.status(403).json({
          error: 'bloqueado',
          message: `Tu cuenta está temporalmente bloqueada. Intenta nuevamente en ${minutesLeft} minuto${minutesLeft !== 1 ? 's' : ''}.`,
          minutesLeft,
          blockedUntil: blockedUntil.toISOString()
        });
      } else {
        await dbRun('UPDATE usuarios SET bloqueado_hasta = NULL WHERE gpid = ?', [gpid]);
      }
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'GPID o contraseña incorrectos' });
    }

    // Registrar último acceso en hora Tijuana
    await dbRun(
      'UPDATE usuarios SET ultimo_acceso = ? WHERE gpid = ?',
      [nowTijuana(), gpid]
    );

    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const { token, tokenId } = generateToken({ gpid: user.gpid, rol: user.rol });

    await dbRun(
      'INSERT INTO sesiones (gpid, token_id, creado_en, expira_en) VALUES (?, ?, ?, ?)',
      [user.gpid, tokenId, nowTijuana(), expiresAt]
    );

    res.json({
      success: true,
      token,
      user: { gpid: user.gpid, rol: user.rol }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    await dbRun(
      'UPDATE sesiones SET activa = 0 WHERE token_id = ?',
      [req.user.jti]
    );
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await dbGet(
      'SELECT gpid, rol, bloqueado_hasta FROM usuarios WHERE gpid = ?',
      [req.user.gpid]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ gpid: user.gpid, rol: user.rol });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
