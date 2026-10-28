import express from 'express'
import { requireRole } from '../middleware/auth.js'
import * as clientsController from '../controllers/clients.controller.js'

const router = express.Router()

router.get('/', clientsController.list)
router.post('/', requireRole('admin'), clientsController.create)

router.get('/:id/payments', requireRole('admin'), clientsController.listPayments)
router.post('/:id/payments', requireRole('admin'), clientsController.createPayment)

router.put('/:id', requireRole('admin'), clientsController.update)
router.delete('/:id', requireRole('admin'), clientsController.destroy)

export default router
