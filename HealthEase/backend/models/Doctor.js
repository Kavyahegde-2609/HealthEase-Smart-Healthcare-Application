const mongoose = require('mongoose');
const DoctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialization: { type: String, default: 'General' },
  available: { type: Boolean, default: true },
  availabilityTimes: [String], // e.g. ["09:00 - 12:00", "14:00 - 18:00"]
  onLeaveUntil: { type: Date, default: null }
}, { timestamps: true });
module.exports = mongoose.model('Doctor', DoctorSchema);