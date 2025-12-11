const express = require('express');
const router = express.Router();
const { listDoctors, createDoctor, updateDoctor } = require('../controllers/doctorCtrl');

router.get('/', listDoctors);
router.post('/', createDoctor);
router.put('/:id', updateDoctor);

module.exports = router;