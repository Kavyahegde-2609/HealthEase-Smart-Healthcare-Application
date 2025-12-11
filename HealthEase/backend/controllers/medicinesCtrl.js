const Doctor = require('../models/Doctor');

async function listDoctors(req, res) {
  const doctors = await Doctor.find();
  res.json(doctors);
}

async function createDoctor(req, res) {
  const doctor = new Doctor(req.body);
  await doctor.save();
  res.status(201).json(doctor);
}

async function updateDoctor(req, res) {
  const { id } = req.params;
  const doctor = await Doctor.findByIdAndUpdate(id, req.body, { new: true });
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  res.json(doctor);
}

module.exports = { listDoctors, createDoctor, updateDoctor };