const Ambulance = require('../models/Ambulance');

async function listAmbulances(req, res) {
  try {
    const list = await Ambulance.find().sort({ name: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ambulances', details: err.message });
  }
}

async function createAmbulance(req, res) {
  try {
    const { name, lat, lon, speedKmph, status } = req.body;
    const amb = new Ambulance({ 
      name, 
      status: status || 'Available', 
      speedKmph: speedKmph || 40, 
      location: { 
        lat: lat || null, 
        lng: (typeof lon !== 'undefined' ? lon : null) 
      } 
    });
    await amb.save();
    res.status(201).json(amb);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ambulance', details: err.message });
  }
}

async function getAmbulance(req, res) {
  try {
    const { id } = req.params;
    const amb = await Ambulance.findById(id);
    if (!amb) return res.status(404).json({ error: 'Ambulance not found' });
    res.json(amb);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ambulance', details: err.message });
  }
}

async function updateLocation(req, res) {
  try {
    const { id } = req.params;
    const { lat, lon, status, speedKmph } = req.body;
    const update = {};
    if(typeof lat !== 'undefined' && typeof lon !== 'undefined'){
      update['location.lat'] = lat;
      update['location.lng'] = lon;
    }
    if(typeof status !== 'undefined') update.status = status;
    if(typeof speedKmph !== 'undefined') update.speedKmph = speedKmph;
    const amb = await Ambulance.findByIdAndUpdate(id, update, { new: true });
    if (!amb) return res.status(404).json({ error: 'Ambulance not found' });
    res.json(amb);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ambulance', details: err.message });
  }
}

async function removeAmbulance(req, res) {
  try {
    const { id } = req.params;
    const amb = await Ambulance.findByIdAndDelete(id);
    if (!amb) return res.status(404).json({ error: 'Ambulance not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove ambulance', details: err.message });
  }
}

module.exports = {
  listAmbulances,
  createAmbulance,
  getAmbulance,
  updateLocation,
  removeAmbulance
};