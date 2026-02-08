# Guía de Instalación - Sistema de Control Presupuestal
## Dominio: presupuesto.academiajotuns.com

Esta guía asume que ya tienes un VPS con otros sistemas instalados y configurados.

---

## Requisitos Previos

- Ubuntu 20.04/22.04 LTS o Debian 11+
- Docker y Docker Compose instalados
- Nginx instalado como reverse proxy
- Certbot para SSL (Let's Encrypt)
- MongoDB (puede ser local o en contenedor)
- Git instalado

---

## 1. Clonar el Repositorio

```bash
# Crear directorio para el proyecto
sudo mkdir -p /var/www/presupuesto
cd /var/www/presupuesto

# Clonar o copiar los archivos del proyecto
# Si usas Git:
git clone <tu-repositorio> .

# O si copias manualmente los archivos
```

---

## 2. Estructura de Archivos

Asegúrate de tener esta estructura:

```
/var/www/presupuesto/
├── backend/
│   ├── server.py
│   ├── models.py
│   ├── auth.py
│   ├── notifications.py
│   ├── pdf_generator.py
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .env
├── docker-compose.yml
└── nginx.conf
```

---

## 3. Configurar Variables de Entorno

### Backend (.env)

```bash
nano /var/www/presupuesto/backend/.env
```

Contenido:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=presupuesto_db
CORS_ORIGINS=https://presupuesto.academiajotuns.com
JWT_SECRET_KEY=TU_CLAVE_SECRETA_MUY_SEGURA_AQUI
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
TEXTMEBOT_API_KEY=jKw8ctg8zzpy
SMTP_SERVER=smtp.office365.com
SMTP_PORT=587
SMTP_USER=informacion.general@academiajotuns.com
SMTP_PASSWORD=TU_PASSWORD_AQUI
```

**IMPORTANTE**: Cambia `JWT_SECRET_KEY` por una clave segura y única.

### Frontend (.env)

```bash
nano /var/www/presupuesto/frontend/.env
```

Contenido:
```env
REACT_APP_BACKEND_URL=https://presupuesto.academiajotuns.com
```

---

## 4. Crear docker-compose.yml

```bash
nano /var/www/presupuesto/docker-compose.yml
```

Contenido:
```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: presupuesto-backend
    restart: always
    ports:
      - "8001:8001"
    environment:
      - MONGO_URL=${MONGO_URL}
      - DB_NAME=${DB_NAME}
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
    env_file:
      - ./backend/.env
    networks:
      - presupuesto-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: presupuesto-frontend
    restart: always
    ports:
      - "3001:80"
    depends_on:
      - backend
    networks:
      - presupuesto-network

networks:
  presupuesto-network:
    driver: bridge
```

---

## 5. Crear Dockerfile para Backend

```bash
nano /var/www/presupuesto/backend/Dockerfile
```

Contenido:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8001

# Run the application
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

---

## 6. Crear Dockerfile para Frontend

```bash
nano /var/www/presupuesto/frontend/Dockerfile
```

Contenido:
```dockerfile
# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN yarn build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

---

## 7. Crear Nginx Config para Frontend Container

```bash
nano /var/www/presupuesto/frontend/nginx.conf
```

Contenido:
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Handle React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://backend:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
```

---

## 8. Configurar Nginx del Host (Reverse Proxy)

```bash
sudo nano /etc/nginx/sites-available/presupuesto.academiajotuns.com
```

Contenido:
```nginx
server {
    listen 80;
    server_name presupuesto.academiajotuns.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name presupuesto.academiajotuns.com;

    # SSL (se configura con Certbot)
    ssl_certificate /etc/letsencrypt/live/presupuesto.academiajotuns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/presupuesto.academiajotuns.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout para operaciones largas (PDF generation, etc.)
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
```

---

## 9. Habilitar el Sitio y Obtener SSL

```bash
# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/presupuesto.academiajotuns.com /etc/nginx/sites-enabled/

# Verificar configuración de Nginx
sudo nginx -t

# Obtener certificado SSL (primero sin SSL)
# Comentar temporalmente las líneas SSL en el archivo de configuración
# y luego ejecutar:
sudo certbot --nginx -d presupuesto.academiajotuns.com

# Reiniciar Nginx
sudo systemctl reload nginx
```

---

## 10. Construir y Ejecutar los Contenedores

```bash
cd /var/www/presupuesto

# Construir las imágenes
docker-compose build

# Iniciar los servicios
docker-compose up -d

# Verificar que estén corriendo
docker-compose ps

# Ver logs
docker-compose logs -f
```

---

## 11. Configurar MongoDB (si no está instalado)

Si MongoDB no está instalado en el host:

```bash
# Opción 1: Instalar MongoDB localmente
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Opción 2: Agregar MongoDB al docker-compose.yml
# Añadir este servicio:
#   mongodb:
#     image: mongo:6
#     container_name: presupuesto-mongodb
#     restart: always
#     volumes:
#       - mongodb_data:/data/db
#     networks:
#       - presupuesto-network
# Y cambiar MONGO_URL a: mongodb://mongodb:27017
```

---

## 12. Configuración DNS

En tu panel de control de dominio (donde administras academiajotuns.com):

1. Crear registro A:
   - Nombre: `presupuesto`
   - Tipo: `A`
   - Valor: `IP_DE_TU_VPS`
   - TTL: 3600 (o el mínimo permitido)

---

## 13. Primer Acceso

1. Abre `https://presupuesto.academiajotuns.com`
2. Crea la cuenta del Super Administrador (solo se permite una vez)
3. Desde la cuenta de Super Admin, crea los demás usuarios

---

## Comandos Útiles

```bash
# Ver logs del backend
docker-compose logs -f backend

# Ver logs del frontend
docker-compose logs -f frontend

# Reiniciar servicios
docker-compose restart

# Detener servicios
docker-compose down

# Actualizar y reconstruir
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Entrar al contenedor del backend
docker exec -it presupuesto-backend bash

# Backup de MongoDB
mongodump --db presupuesto_db --out /backup/$(date +%Y%m%d)
```

---

## Troubleshooting

### El frontend no carga
```bash
# Verificar que el contenedor esté corriendo
docker ps

# Ver logs
docker-compose logs frontend
```

### Error de conexión al backend
```bash
# Verificar que el backend esté corriendo
curl http://localhost:8001/api/auth/check-users

# Ver logs del backend
docker-compose logs backend
```

### Error de MongoDB
```bash
# Verificar conexión
mongo --eval "db.runCommand({ connectionStatus: 1 })"

# Ver estado del servicio
sudo systemctl status mongod
```

---

## Mantenimiento

### Actualizar el Sistema

```bash
cd /var/www/presupuesto
git pull origin main  # Si usas Git
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backup Automático (Cron)

```bash
sudo crontab -e

# Agregar línea para backup diario a las 3:00 AM
0 3 * * * /usr/bin/mongodump --db presupuesto_db --out /backup/$(date +\%Y\%m\%d)
```

---

## Soporte

Para soporte técnico, contactar al administrador del sistema.

**Sistema desarrollado para Academia Jotuns Club**
