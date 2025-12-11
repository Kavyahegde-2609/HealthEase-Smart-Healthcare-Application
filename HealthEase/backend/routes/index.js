const mongoose = require('mongoose');
const MedicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  shop: { type: String },
  price: { type: Number, default: 0 },
  stock: { type: Number, default: 0 }
}, { timestamps: true });
module.exports = mongoose.model('Medicine', MedicineSchema);
