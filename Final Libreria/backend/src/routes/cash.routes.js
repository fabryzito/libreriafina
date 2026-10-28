import express from 'express'
import * as cashController from '../controllers/cash.controller.js'

const router = express.Router()

router.get('/current', cashController.current)
router.post('/open', cashController.open)
router.post('/close', cashController.close)
router.post('/movements', cashController.createMovement)

export default router
