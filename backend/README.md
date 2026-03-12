# Sistema de Control GPID

Aplicación web segura con login, control de roles y bloqueo temporal de usuarios.

---

## 📁 Estructura del Proyecto

```
app/
├── backend/
│   ├── database/
│   │   └── db.js              # Configuración SQLite + inicialización
│   ├── middleware/
│   │   └── auth.js            # JWT + protección de rutas
│   ├── routes/
│   │   ├── auth.js            # Login / Logout / /me
│   │   ├── records.js         # Guardar registros (usuario normal)
│   │   └── admin.js           # Panel de administrador
│   ├── scripts/
│   │   └── initDB.js          # Script para inicializar BD
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── server.js              # Servidor Express principal
└── frontend/
    └── index.html             # App completa (SPA)
```

---

## 🚀 Instalación y Ejecución Local

### 1. Requisitos
- Node.js v18 o superior
- npm v8 o superior

### 2. Instalar dependencias

```bash
cd backend
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y cambia `JWT_SECRET` por una cadena segura de al menos 32 caracteres.

### 4. Iniciar el servidor

```bash
npm start
```

O en modo desarrollo (recarga automática):

```bash
npm run dev
```

### 5. Abrir en el navegador

```
http://localhost:3000
```

---

## 👤 Usuarios por Defecto

| GPID     | Contraseña  | Rol           |
|----------|-------------|---------------|
| 00000001 | Admin2024!  | Administrador |
| 12345678 | Usuario123  | Usuario       |

> ⚠️ **Cambia estas contraseñas antes de desplegar en producción.**

Para agregar más usuarios, usa el panel de administrador → botón **+ Agregar**.

---

## ☁️ Despliegue en la Nube

### Opción A: Railway (Recomendado — gratis)

1. Crea cuenta en https://railway.app
2. Conecta tu repositorio de GitHub
3. Selecciona la carpeta `backend` como directorio raíz
4. Agrega las variables de entorno:
   - `JWT_SECRET` → cadena aleatoria de 32+ caracteres
   - `NODE_ENV` → `production`
5. Railway detecta automáticamente Node.js y despliega

### Opción B: Render

1. Crea cuenta en https://render.com
2. Nuevo servicio → **Web Service**
3. Conecta tu repositorio
4. Configuración:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Agrega variables de entorno igual que Railway

### Opción C: Fly.io

```bash
# Instalar flyctl
curl -L https://fly.io/install.sh | sh

# Desde el directorio backend:
cd backend
fly launch
fly secrets set JWT_SECRET="tu-secreto-aqui"
fly deploy
```

### Opción D: VPS / Docker

```dockerfile
# Dockerfile (crear en /backend)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t gpid-app .
docker run -d -p 3000:3000 \
  -e JWT_SECRET="tu-secreto" \
  -v $(pwd)/data:/app/data \
  gpid-app
```

---

## 🔒 Características de Seguridad

- **Contraseñas:** Hashed con bcrypt (salt rounds: 12)
- **Sesiones:** JWT con expiración de 8 horas, almacenadas en BD
- **GPID:** Validación de exactamente 8 dígitos numéricos
- **Rutas protegidas:** Middleware de autenticación y rol
- **Rate limiting:** Máximo 20 intentos de login cada 15 minutos
- **Headers seguros:** Helmet.js
- **Bloqueo:** Usuarios normales bloqueados 10 min después de registrar

---

## 📋 API Endpoints

| Método | Endpoint                      | Auth   | Descripción              |
|--------|-------------------------------|--------|--------------------------|
| POST   | /api/auth/login               | No     | Iniciar sesión           |
| POST   | /api/auth/logout              | Sí     | Cerrar sesión            |
| GET    | /api/auth/me                  | Sí     | Verificar sesión         |
| POST   | /api/records                  | Usuario| Guardar registro         |
| GET    | /api/admin/records            | Admin  | Ver todos los registros  |
| GET    | /api/admin/users              | Admin  | Ver todos los usuarios   |
| POST   | /api/admin/users              | Admin  | Crear usuario            |
| DELETE | /api/admin/users/:gpid        | Admin  | Eliminar usuario         |
| PATCH  | /api/admin/users/:gpid/unblock| Admin  | Desbloquear usuario      |

---

## 🗄️ Estructura de la Base de Datos

### Tabla `usuarios`
| Campo          | Tipo    | Descripción                        |
|----------------|---------|------------------------------------|
| id             | INTEGER | Clave primaria                     |
| gpid           | TEXT    | 8 dígitos, único                   |
| password       | TEXT    | Bcrypt hash                        |
| rol            | TEXT    | 'admin' o 'usuario'                |
| bloqueado_hasta| TEXT    | ISO datetime de fin del bloqueo    |
| creado_en      | TEXT    | Fecha de creación                  |
| ultimo_acceso  | TEXT    | Último login                       |

### Tabla `registros`
| Campo     | Tipo    | Descripción                        |
|-----------|---------|------------------------------------|
| id        | INTEGER | Clave primaria                     |
| gpid      | TEXT    | GPID del usuario                   |
| hhc       | TEXT    | Número de HHC                      |
| turno     | TEXT    | 'Turno 1', 'Turno 2', 'Turno 3'   |
| fecha_hora| TEXT    | ISO datetime del registro          |

### Tabla `sesiones`
| Campo     | Tipo    | Descripción                        |
|-----------|---------|------------------------------------|
| id        | INTEGER | Clave primaria                     |
| gpid      | TEXT    | GPID del usuario                   |
| token_id  | TEXT    | UUID del JWT (jti)                 |
| expira_en | TEXT    | ISO datetime de expiración         |
| activa    | INTEGER | 1=activa, 0=invalidada             |
