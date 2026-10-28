import express from 'express'
import * as salesController from '../controllers/sales.controller.js'

const router = express.Router()

router.get('/', salesController.list)
router.post('/', salesController.create)
router.post('/:id/cancel', salesController.cancel)
router.post('/:id/returns', salesController.createReturn)

export default router
