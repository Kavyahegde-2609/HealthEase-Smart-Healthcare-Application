const mongoose = require('mongoose');

const MedicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  pharmacy: { type: String }, // Using 'pharmacy' to match seed data
  shop: { type: String },      // Keep 'shop' for backwards compatibility
  price: { type: Number, default: 0 },
  stock: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.models.Medicine || mongoose.model('Medicine', MedicineSchema);