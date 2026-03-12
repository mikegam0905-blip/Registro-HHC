const jwt = require('jsonwebtoken');
const { dbGet } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production-min-32-chars!!';

function generateToken(payload) {
  const { v4: uuidv4 } = require('uuid');
  const tokenId = uuidv4();
  const token = jwt.sign(
    { ...payload, jti: tokenId },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  return { token, tokenId };
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const session = await dbGet(
      'SELECT * FROM sesiones WHERE token_id = ? AND activa = 1',
      [decoded.jti]
    );

    if (!session) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    if (new Date(session.expira_en) < new Date()) {
      await dbGet('UPDATE sesiones SET activa = 0 WHERE token_id = ?', [decoded.jti]);
      return res.status(401).json({ error: 'Sesión expirada' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
  });
}

module.exports = { generateToken, verifyToken, requireAuth, requireAdmin };
