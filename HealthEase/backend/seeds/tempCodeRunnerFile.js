// seeds/seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const Ambulance = require('../models/Ambulance');
const Doctor = require('../models/Doctor');
const Medicine = require('../models/Medicine');

const MONGO_URI = process.env.MONGO_URI;
if(!MONGO_URI){ console.error('Set MONGO_URI in .env'); process.exit(1); }

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected for seeding...');
    await Ambulance.deleteMany({});
    await Doctor.deleteMany({});
    await Medicine.deleteMany({});

    await Ambulance.create([
      { name: 'Ambulance A', lat: 12.9719, lon: 77.5946, speedKmph: 40, status: 'Available' },
      { name: 'Ambulance B', lat: 12.9667, lon: 77.5995, speedKmph: 35, status: 'Available' },
      { name: 'Ambulance C', lat: 12.9750, lon: 77.5840, speedKmph: 45, status: 'Available' }
    ]);

    await Doctor.create([
      { name: 'Dr. Smith', specialization: 'Cardiologist', available: true, availabilityTimes: ['09:00-12:00','14:00-18:00'] },
      { name: 'Dr. Jane', specialization: 'Dermatologist', available: false, onLeaveUntil: new Date('2025-10-10') },
      { name: 'Dr. Mike', specialization: 'Neurologist', available: true, onCall: true }
    ]);

    await Medicine.create([
      { name: 'Paracetamol', shop: 'City Pharmacy', stock: 24, price: 2.5 },
      { name: 'Aspirin', shop: 'HealthMart', stock: 0, price: 3.0 }
    ]);

    console.log('Seeding complete');
    process.exit(0);
  })
  .catch(err => { console.error(err); process.exit(1); });
