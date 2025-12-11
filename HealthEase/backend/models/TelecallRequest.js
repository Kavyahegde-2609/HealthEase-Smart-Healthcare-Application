const mongoose = require('mongoose');

const TelecallRequestSchema = new mongoose.Schema({
  hospitalName: { 
    type: String, 
    required: true 
  },
  reason: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String, 
    default: function() {
      return '+91-' + Math.floor(Math.random() * 9000000000 + 1000000000);
    }
  },
  available: { 
    type: Boolean, 
    default: true 
  },
  requestedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.models.TelecallRequest || mongoose.model('TelecallRequest', TelecallRequestSchema);
