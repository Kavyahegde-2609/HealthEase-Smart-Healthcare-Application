// backend/seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const Ambulance = require('./models/Ambulance');
const Doctor = require('./models/Doctor');
const Medicine = require('./models/Medicine');
const TelecallRequest = require('./models/TelecallRequest');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('Set MONGO_URI in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB for seeding...');

    await Ambulance.deleteMany({});
    await Doctor.deleteMany({});
    await Medicine.deleteMany({});
    await TelecallRequest.deleteMany({});

    await Ambulance.create([
      { name: 'Ambulance A', location: { lat: 12.9719, lng: 77.5946 }, status: 'Available', speedKmph: 50 },
      { name: 'Ambulance B', location: { lat: 12.9667, lng: 77.5995 }, status: 'Available', speedKmph: 45 },
      { name: 'Ambulance C', location: { lat: 12.9750, lng: 77.5840 }, status: 'Busy', speedKmph: 40 },
      { name: 'Ambulance D', location: { lat: 12.9800, lng: 77.5900 }, status: 'Unavailable', speedKmph: 40 },
      { name: 'Ambulance E', location: { lat: 12.9650, lng: 77.5820 }, status: 'Available', speedKmph: 48 },
      { name: 'Ambulance F', location: { lat: 12.9790, lng: 77.6000 }, status: 'Available', speedKmph: 42 },
      { name: 'Ambulance G', location: { lat: 12.9740, lng: 77.6100 }, status: 'Busy', speedKmph: 50 },
      { name: 'Ambulance H', location: { lat: 12.9680, lng: 77.6050 }, status: 'Available', speedKmph: 45 }
    ]);

    await Doctor.create([
      { name: 'Dr. Smith', specialization: 'Cardiologist', available: true, availabilityTimes: ['09:00-12:00','14:00-18:00'], onLeave: false },
      { name: 'Dr. Jane', specialization: 'Dermatologist', available: false, onLeave: true, onLeaveUntil: new Date('2026-10-30') },
      { name: 'Dr. Mike', specialization: 'Neurologist', available: true, availabilityTimes: ['10:00-16:00'], onLeave: false },
    ]);

    await Medicine.create([
      { name: 'Paracetamol', pharmacy: 'City Pharmacy', stock: 50, price: 2.5 },
      { name: 'Aspirin', pharmacy: 'HealthMart', stock: 20, price: 3.0 },
      { name: 'Amoxicillin', pharmacy: 'MediStore', stock: 30, price: 5.0 },
    ]);

    await TelecallRequest.create([
      { hospitalName: 'Hospital A', reason: 'Need info about cardiologist', requestedAt: new Date() },
      { hospitalName: 'Hospital B', reason: 'Appointment query', requestedAt: new Date() },
    ]);

    console.log('Seeding done.');
    process.exit(0);
  })
  .catch(err => { console.error(err); process.exit(1); });
