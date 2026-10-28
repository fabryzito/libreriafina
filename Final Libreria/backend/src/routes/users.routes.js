import express from 'express'
import * as usersController from '../controllers/users.controller.js'

const router = express.Router()

router.get('/recovery-codes', usersController.recoveryCodes)
router.get('/', usersController.list)
router.post('/', usersController.create)
router.put('/:id', usersController.update)
router.delete('/:id', usersController.destroy)

export default router
