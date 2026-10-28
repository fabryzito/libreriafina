import express from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import authRoutes from './auth.routes.js'
import usersRoutes from './users.routes.js'
import productsRoutes from './products.routes.js'
import salesRoutes from './sales.routes.js'
import clientsRoutes from './clients.routes.js'
import categoriesRoutes from './categories.routes.js'
import suppliersRoutes from './suppliers.routes.js'
import purchasesRoutes from './purchases.routes.js'
import cashRoutes from './cash.routes.js'
import reportsRoutes from './reports.routes.js'
import shopRoutes from './shop.routes.js'

const router = express.Router()

router.use('/auth', authRoutes)

router.use('/users', authenticate, requireRole('admin'), usersRoutes)
router.use('/products', authenticate, productsRoutes)
router.use('/categories', authenticate, categoriesRoutes)
router.use('/clients', authenticate, clientsRoutes)
router.use('/sales', authenticate, salesRoutes)
router.use('/suppliers', authenticate, requireRole('admin'), suppliersRoutes)
router.use('/purchases', authenticate, requireRole('admin'), purchasesRoutes)
router.use('/cash', authenticate, cashRoutes)
router.use('/reports', authenticate, reportsRoutes)
router.use('/shop', authenticate, shopRoutes)

export default router
