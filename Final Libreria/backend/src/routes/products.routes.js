import express from 'express'
import { requireRole } from '../middleware/auth.js'
import * as productsController from '../controllers/products.controller.js'

const router = express.Router()

router.get('/', productsController.list)
router.post('/', requireRole('admin'), productsController.create)
router.get('/:id/movements', productsController.movements)
router.post('/:id/adjust', requireRole('admin'), productsController.adjust)
router.put('/:id', requireRole('admin'), productsController.update)
router.delete('/:id', requireRole('admin'), productsController.destroy)

export default router


