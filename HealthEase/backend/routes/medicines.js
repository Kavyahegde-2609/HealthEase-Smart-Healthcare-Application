const express = require('express');
const router = express.Router();
const Medicine = require('../models/medicine');

router.get('/', async (req, res) => {
  try {
    const list = await Medicine.find().lean().exec();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch medicines', details: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const m = new Medicine(req.body);
    await m.save();
    res.status(201).json(m);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create medicine', details: err.message });
  }
});

router.post('/:id/order', async (req, res) => {
  try {
    const { qty = 1 } = req.body;
    const med = await Medicine.findById(req.params.id);
    
    if (!med) {
      return res.status(404).json({ error: 'Medicine not found' });
    }
    
    if (med.stock < qty) {
      return res.status(400).json({ error: 'Insufficient stock available' });
    }
    
    med.stock -= qty;
    await med.save();
    
    res.json({ ok: true, medicine: med });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process order', details: err.message });
  }
});

module.exports = router;