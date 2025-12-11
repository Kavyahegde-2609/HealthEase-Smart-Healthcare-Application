const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');

async function listAppointments(req, res) {
  try {
    const list = await Appointment.find().sort({ date: -1 }).populate('doctorId', 'name specialization');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointments', details: err.message });
  }
}

async function createAppointment(req, res) {
  try {
    const { patientName, date, doctorId, disease } = req.body;
    const selected = new Date(date);
    const today = new Date(); 
    today.setHours(0,0,0,0);
    
    if (selected < today) {
      return res.status(400).json({ error: 'Past dates not allowed' });
    }

    if (doctorId) {
      const doc = await Doctor.findById(doctorId);
      if (!doc) {
        return res.status(400).json({ error: 'Doctor not found' });
      }
      
      if (doc.onLeaveUntil) {
        const leaveDate = new Date(doc.onLeaveUntil);
        if (selected <= leaveDate) {
          return res.status(400).json({ 
            error: `${doc.name} is on leave until ${doc.onLeaveUntil.toString().slice(0,10)}` 
          });
        }
      }
    }

    const appt = new Appointment({ 
      patient: patientName, 
      date: selected, 
      doctorId: doctorId || undefined, 
      disease: disease || 'General',
      status: 'Booked' 
    });
    
    await appt.save();
    await appt.populate('doctorId', 'name specialization');
    
    res.status(201).json(appt);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create appointment', details: err.message });
  }
}

async function cancelAppointment(req, res) {
  try {
    const { id } = req.params;
    const appt = await Appointment.findById(id);
    
    if (!appt) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    appt.status = 'Cancelled';
    await appt.save();
    
    res.json({ ok: true, appointment: appt });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel appointment', details: err.message });
  }
}

module.exports = { listAppointments, createAppointment, cancelAppointment };