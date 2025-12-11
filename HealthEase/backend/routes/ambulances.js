const express = require('express');
const router = express.Router();
const { listRequests, createRequest } = require('../controllers/telecallingCtrl');

// GET /api/telecalling - list all telecall requests
router.get('/', listRequests);

// POST /api/telecalling - create new telecall request
router.post('/', createRequest);

module.exports = router;