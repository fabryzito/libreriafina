import express from 'express'
import { requireRole } from '../middleware/auth.js'
import * as shopController from '../controllers/shop.controller.js'

const router = express.Router()

router.get('/', shopController.get)
router.put('/', requireRole('admin'), shopController.update)

export default router
