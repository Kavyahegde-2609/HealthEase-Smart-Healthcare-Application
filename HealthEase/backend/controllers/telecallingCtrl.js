const TelecallRequest = require('../models/TelecallRequest');

async function listRequests(req, res) {
  try {
    const list = await TelecallRequest.find().sort({ requestedAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch telecall requests', details: err.message });
  }
}

async function createRequest(req, res) {
  try {
    const { hospitalName, reason, phone, available } = req.body;
    
    if (!hospitalName || !reason) {
      return res.status(400).json({ error: 'hospitalName and reason required' });
    }
    
    const telecallRequest = new TelecallRequest({ 
      hospitalName, 
      reason, 
      phone,
      available: available !== undefined ? available : true,
      requestedAt: new Date() 
    });
    
    await telecallRequest.save();
    res.status(201).json(telecallRequest);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create telecall request', details: err.message });
  }
}

module.exports = { listRequests, createRequest };