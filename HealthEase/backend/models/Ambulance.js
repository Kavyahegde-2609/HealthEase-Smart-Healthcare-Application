// backend/models/Ambulance.js
const mongoose = require('mongoose');
const ambulanceSchema = new mongoose.Schema({
  name: { type: String },
  status: { type: String, default: 'Available' },
  speedKmph: { type: Number, default: 40 },
  location: {
    lat: Number,
    lng: Number
  }
});
module.exports = mongoose.model('Ambulance', ambulanceSchema);