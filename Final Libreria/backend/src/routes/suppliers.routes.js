import express from 'express'
import * as suppliersController from '../controllers/suppliers.controller.js'

const router = express.Router()

router.get('/', suppliersController.list)
router.post('/', suppliersController.create)
router.get('/:id/payments', suppliersController.listPayments)
router.post('/:id/payments', suppliersController.createPayment)
router.put('/:id', suppliersController.update)
router.delete('/:id', suppliersController.destroy)

export default router
