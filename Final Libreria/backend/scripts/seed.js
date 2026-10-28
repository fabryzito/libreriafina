/**
 * Datos iniciales. Ejecutar: npm run seed
 * (requiere MySQL y esquema creado). Pensado para BD nueva o ejecutar una sola vez.
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'libreria',
    multipleStatements: true,
  })

  const hash = await bcrypt.hash('123456', 10)

  await conn.query(
    `INSERT IGNORE INTO users (id, name, email, password_hash, role) VALUES
     (1, 'Administrador', 'admin@libreria.com', ?, 'admin'),
     (2, 'Empleado', 'empleado@libreria.com', ?, 'empleado')`,
    [hash, hash],
  )

  await conn.query(
    `INSERT IGNORE INTO categories (id, name) VALUES
     (1, 'Cuadernos'),
     (2, 'Escritura')`,
  )

  await conn.query(
    `INSERT IGNORE INTO products
       (id, sku, name, price, cost, stock, min_stock, category_id, is_active)
     VALUES
       (1, 'CUA-A4', 'Cuaderno A4', 3.50, 2.00, 120, 20, 1, 1),
       (2, 'BOL-AZ', 'Bolígrafo azul', 1.20, 0.40, 300, 30, 2, 1)`,
  )

  await conn.query(
    `INSERT IGNORE INTO clients (id, full_name, email, phone, document_id, address) VALUES
     (1, 'Cliente General', NULL, NULL, NULL, NULL),
     (2, 'María López', 'maria@cliente.com', '809-555-1122', 'CL-001', 'Santo Domingo')`,
  )

  console.log('Seed completado. Las ventas se registran desde la app.')
  console.log('  admin@libreria.com / 123456 (admin)')
  console.log('  empleado@libreria.com / 123456 (empleado)')
  await conn.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
