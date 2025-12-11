const express = require('express');
const router = express.Router();
const { listRequests, createRequest } = require('../controllers/telecallingCtrl');

router.get('/', listRequests);
router.post('/', createRequest);

module.exports = router;