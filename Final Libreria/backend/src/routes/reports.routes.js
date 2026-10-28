import express from 'express'
import * as reportsController from '../controllers/reports.controller.js'

const router = express.Router()

router.get('/home', reportsController.home)
router.get('/business', reportsController.business)

export default router
