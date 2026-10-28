import express from 'express'
import * as purchasesController from '../controllers/purchases.controller.js'

const router = express.Router()

router.get('/', purchasesController.list)
router.post('/', purchasesController.create)
router.post('/:id/cancel', purchasesController.cancel)

export default router
