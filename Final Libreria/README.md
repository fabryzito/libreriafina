# Librería

Sistema para vender, comprar, controlar stock, caja y cuentas del negocio.

## Qué necesitás instalado

- [Node.js](https://nodejs.org/) (incluye npm)
- MySQL, con MySQL Workbench

## 1. Encender MySQL

En Windows, el servidor suele quedar como un servicio.

1. Abrí **Servicios** (buscalo en el menú Inicio).
2. Buscá **MySQL** o **MySQL80**.
3. Si el estado no dice *En ejecución*, clic derecho y **Iniciar**.

También podés abrir MySQL Workbench y conectarte a la instancia local. Si la conexión entra, el servidor ya está prendido.

La configuración del proyecto espera este acceso local:

- servidor: `localhost`
- puerto: `3306`
- usuario: `root`
- contraseña: vacía
- base: `libreria`

Si tu usuario de MySQL tiene contraseña, abrí `backend/.env` y completala en `DB_PASSWORD`.

## 2. Crear la base de datos

El archivo `backend/database/schema.sql` crea la base `libreria` y todas las tablas de una sola vez. No hace falta correr ningún otro script de base de datos.

1. Abrí **MySQL Workbench** y entrá a tu conexión local.
2. Menú **File → Open SQL Script**.
3. Elegí `backend/database/schema.sql`.
4. Ejecutalo con el rayo (**Execute**).
5. En el panel de esquemas, actualizá la lista. Tiene que aparecer la base `libreria`.

Ese script es para una instalación nueva. Si la base ya existe y tiene datos, no lo vuelvas a ejecutar esperando que los borre: las tablas que ya están no se recrean.

## 3. Cargar los datos iniciales

En una terminal, parada en la carpeta `backend`:

```bash
npm install
npm run seed
```

Eso crea dos usuarios y un par de productos de ejemplo:

- `admin@libreria.com` / `123456`
- `empleado@libreria.com` / `123456`

Si esos usuarios ya existen, el seed no les cambia la contraseña.

## 4. Iniciar el backend

En la misma carpeta `backend`:

```bash
npm run dev
```

La API queda en [http://localhost:4000](http://localhost:4000). Para comprobar que responde: [http://localhost:4000/health](http://localhost:4000/health).

Dejá esa terminal abierta.

## 5. Iniciar el frontend

Abrí **otra** terminal, en la carpeta `frontend`:

```bash
npm install
npm run dev
```

La aplicación queda en [http://localhost:5173](http://localhost:5173).

Entrá con el usuario administrador, abrí **Caja** y abrila con un monto inicial antes de registrar ventas.
