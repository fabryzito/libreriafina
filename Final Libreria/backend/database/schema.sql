-- Librería: creación completa de la base, de una sola vez.
-- En MySQL Workbench: abrir este archivo y ejecutarlo con el rayo.
-- Crea la base `libreria` y todas las tablas. Es para una instalación nueva.

CREATE DATABASE IF NOT EXISTS libreria
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE libreria;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'empleado') NOT NULL DEFAULT 'empleado',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  code CHAR(6) NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(40) NULL,
  barcode VARCHAR(64) NULL,
  name VARCHAR(200) NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  min_stock INT NOT NULL DEFAULT 5,
  category_id INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_products_sku (sku),
  UNIQUE KEY uq_products_barcode (barcode),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(40),
  document_id VARCHAR(60) UNIQUE,
  address VARCHAR(255),
  current_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suppliers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  contact_name VARCHAR(120) NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(40),
  document_id VARCHAR(60) UNIQUE,
  address VARCHAR(255),
  current_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cash_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  opened_by INT UNSIGNED NOT NULL,
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  opening_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status ENUM('abierta', 'cerrada') NOT NULL DEFAULT 'abierta',
  closed_by INT UNSIGNED NULL,
  closed_at TIMESTAMP NULL,
  counted_cash DECIMAL(10, 2) NULL,
  expected_cash DECIMAL(10, 2) NULL,
  cash_difference DECIMAL(10, 2) NULL,
  notes VARCHAR(500) NULL,
  CONSTRAINT fk_cash_sessions_opened_by FOREIGN KEY (opened_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_cash_sessions_closed_by FOREIGN KEY (closed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('efectivo', 'transferencia', 'tarjeta') NOT NULL DEFAULT 'efectivo',
  cash_session_id INT UNSIGNED NULL,
  payment_date DATE NOT NULL,
  notes VARCHAR(500) NULL,
  recorded_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_credit_payments_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_credit_payments_user FOREIGN KEY (recorded_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_credit_payments_session FOREIGN KEY (cash_session_id) REFERENCES cash_sessions (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NULL,
  sale_date DATE NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  discount_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_method ENUM('efectivo', 'transferencia', 'tarjeta', 'cuenta_corriente') NOT NULL DEFAULT 'efectivo',
  status ENUM('registrada', 'anulada') NOT NULL DEFAULT 'registrada',
  cash_session_id INT UNSIGNED NULL,
  cancelled_at TIMESTAMP NULL,
  cancelled_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sales_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_sales_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE SET NULL,
  CONSTRAINT fk_sales_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_sales_session FOREIGN KEY (cash_session_id) REFERENCES cash_sessions (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  returned_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  unit_price DECIMAL(10, 2) NOT NULL,
  list_unit_price DECIMAL(10, 2) NULL,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10, 2) NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_returns (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id INT UNSIGNED NOT NULL,
  cash_session_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sale_returns_sale FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE RESTRICT,
  CONSTRAINT fk_sale_returns_session FOREIGN KEY (cash_session_id) REFERENCES cash_sessions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_sale_returns_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_return_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  CONSTRAINT fk_sale_return_items_return FOREIGN KEY (return_id) REFERENCES sale_returns (id) ON DELETE CASCADE,
  CONSTRAINT fk_sale_return_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supplier_payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('efectivo', 'transferencia', 'tarjeta') NOT NULL DEFAULT 'efectivo',
  cash_session_id INT UNSIGNED NULL,
  payment_date DATE NOT NULL,
  notes VARCHAR(500) NULL,
  recorded_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_supplier_payments_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
  CONSTRAINT fk_supplier_payments_user FOREIGN KEY (recorded_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_supplier_payments_session FOREIGN KEY (cash_session_id) REFERENCES cash_sessions (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchases (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  cash_session_id INT UNSIGNED NULL,
  purchase_date DATE NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('efectivo', 'transferencia', 'tarjeta', 'cuenta_corriente') NOT NULL DEFAULT 'efectivo',
  status ENUM('registrada', 'anulada') NOT NULL DEFAULT 'registrada',
  update_cost TINYINT(1) NOT NULL DEFAULT 1,
  notes VARCHAR(500) NULL,
  cancelled_at TIMESTAMP NULL,
  cancelled_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchases_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchases_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_purchases_session FOREIGN KEY (cash_session_id) REFERENCES cash_sessions (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_cost DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  previous_cost DECIMAL(10, 2) NULL,
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases (id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cash_movements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id INT UNSIGNED NOT NULL,
  direction ENUM('ingreso', 'egreso') NOT NULL,
  source ENUM(
    'apertura',
    'venta',
    'cobro_cliente',
    'pago_proveedor',
    'compra',
    'gasto',
    'ingreso_manual',
    'egreso_manual',
    'anulacion_venta',
    'devolucion_venta',
    'anulacion_compra'
  ) NOT NULL,
  payment_method ENUM('efectivo', 'transferencia', 'tarjeta') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description VARCHAR(255) NULL,
  reference_type VARCHAR(40) NULL,
  reference_id INT UNSIGNED NULL,
  user_id INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cash_movements_session FOREIGN KEY (session_id) REFERENCES cash_sessions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_cash_movements_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_movements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  movement_type ENUM('entrada', 'salida', 'ajuste', 'devolucion') NOT NULL,
  reason ENUM(
    'compra',
    'venta',
    'anulacion_compra',
    'anulacion_venta',
    'devolucion_venta',
    'conteo',
    'merma',
    'error',
    'stock_inicial'
  ) NOT NULL,
  quantity INT NOT NULL,
  stock_after INT NOT NULL,
  notes VARCHAR(500) NULL,
  reference_type VARCHAR(40) NULL,
  reference_id INT UNSIGNED NULL,
  user_id INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_movements_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
  CONSTRAINT fk_stock_movements_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_settings (
  id TINYINT UNSIGNED PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  address VARCHAR(255) NULL,
  phone VARCHAR(40) NULL,
  document_id VARCHAR(60) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO shop_settings (id, name)
SELECT 1, 'Librería'
WHERE NOT EXISTS (SELECT 1 FROM shop_settings WHERE id = 1);
