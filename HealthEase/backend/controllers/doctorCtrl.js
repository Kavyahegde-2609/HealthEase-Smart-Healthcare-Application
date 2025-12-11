const Doctor = require('../models/Doctor');

async function listDoctors(req, res) {
  try {
    const doctors = await Doctor.find();
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctors', details: err.message });
  }
}

async function createDoctor(req, res) {
  try {
    const doctor = new Doctor(req.body);
    await doctor.save();
    res.status(201).json(doctor);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create doctor', details: err.message });
  }
}

async function updateDoctor(req, res) {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findByIdAndUpdate(id, req.body, { new: true });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update doctor', details: err.message });
  }
}

module.exports = { listDoctors, createDoctor, updateDoctor };