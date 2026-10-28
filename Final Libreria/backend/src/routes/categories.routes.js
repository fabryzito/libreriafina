import express from 'express'
import { requireRole } from '../middleware/auth.js'
import * as categoriesController from '../controllers/categories.controller.js'

const router = express.Router()

router.get('/', categoriesController.list)
router.post('/', requireRole('admin'), categoriesController.create)

export default router
