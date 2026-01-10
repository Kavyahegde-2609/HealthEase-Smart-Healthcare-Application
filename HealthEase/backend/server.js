require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const ambulancesRoutes = require('./routes/ambulances');
const doctorsRoutes = require('./routes/doctors');
const appointmentsRoutes = require('./routes/appointments');
const medicinesRoutes = require('./routes/medicines');
const telecallingRoutes = require('./routes/telecalling');

const app = express();
app.use(cors());
app.use(express.json());

// connect
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI missing in .env');
  process.exit(1);
}
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log(' Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error', err);
    process.exit(1);
  });

// routes
app.use('/api/ambulances', ambulancesRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/medicines', medicinesRoutes);
app.use('/api/telecalling', telecallingRoutes);

// health
app.get('/api/health', (req,res)=> res.json({ ok:true, now: new Date() }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=> console.log(` Server listening on port ${PORT}`));
