import express from 'express'
import { authenticate } from '../middleware/auth.js'
import * as authController from '../controllers/auth.controller.js'

const router = express.Router()

router.post('/login', authController.login)
router.post('/forgot', authController.forgot)
router.post('/reset', authController.reset)
router.get('/me', authenticate, authController.me)

export default router
