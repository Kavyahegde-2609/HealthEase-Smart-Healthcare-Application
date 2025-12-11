const express = require('express');
const router = express.Router();
const { 
  listAmbulances, 
  createAmbulance, 
  getAmbulance, 
  updateLocation, 
  removeAmbulance 
} = require('../controllers/ambulanceCtrl');

router.get('/', listAmbulances);
router.post('/', createAmbulance);
router.get('/:id', getAmbulance);
router.put('/:id', updateLocation);
router.delete('/:id', removeAmbulance);

module.exports = router;