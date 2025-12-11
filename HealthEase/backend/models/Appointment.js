const mongoose = require('mongoose');
const AppointmentSchema = new mongoose.Schema({
  patient: { type: String, required: true },
  disease: { type: String },
  date: { type: Date, required: true },
  status: { type: String, default: 'Booked' }, // Booked, Cancelled
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null }
}, { timestamps: true });
module.exports = mongoose.model('Appointment', AppointmentSchema);