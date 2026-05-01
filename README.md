# 🚑 HealthEase – Smart Healthcare Management System

## 📌 Overview

HealthEase is a full-stack healthcare management system designed to simulate real-world healthcare services in a single platform.
It integrates ambulance tracking, doctor management, appointment booking, medicine ordering, and telecalling features to demonstrate how modern healthcare applications can be structured.

The project focuses on combining multiple modules into one unified system with practical workflows and validations.

---

## 🚀 Features

### 🚑 Ambulance Tracking

* Real-time ambulance movement simulation using map visualization
* Dispatch & track ambulances with status updates (Available / Busy / Tracking)
* Distance calculation and route simulation

### 👨‍⚕️ Doctor Management

* Add, update, and view doctors
* Specialization-based filtering
* Doctor availability and leave handling

### 📅 Appointment Booking

* Book appointments with doctors
* Prevents past date bookings
* Handles doctor leave validation
* Appointment cancellation feature

### 💊 Medicine Ordering

* View available medicines with stock and price
* Order medicines with validation
* Simulated delivery tracking system

### 📞 Telecalling System

* Create telecall requests
* Simulated calling interface
* Basic voice interaction support

---

## 🛠️ Tech Stack

**Frontend**

* HTML, CSS, JavaScript
* Canvas API (for map simulation)

**Backend**

* Node.js
* Express.js

**Database**

* MongoDB

**Tools**

* Postman (API testing)

---
## ⚙️ Setup Instructions

### 1. Clone the repository

```
git clone https://github.com/Kavyahegde-2609/HealthEase-Smart-Healthcare-Application.git
cd HealthEase-Smart-Healthcare-Application
```
### 2. Install backend dependencies

```
cd backend
npm install
```

### 3. Run the backend server

```
npm run dev
```

Server will start at:

```
http://localhost:5000
```

---

### 4. Open frontend

Go to:

```
frontend/src/index.html
```

Open it in  browser
(or use **Live Server** in VS Code for better experience)

---



## 📌 Key Highlights

* Multi-module full-stack system
* Real-world healthcare workflow simulation
* Strong backend logic with validations
* Interactive UI with live tracking simulation

---

## ⚠️ Note

This project is built for learning and demonstration purposes.
It simulates healthcare workflows and is not intended for real medical use.

Backend requires MongoDB configuration (MONGO_URI) to run fully.
Without database setup, frontend demo features can still be explored.
---

## 📈 Future Improvements

* User authentication (JWT-based login system)
* Live GPS integration instead of simulation
* Deployment on cloud platforms
* UI/UX enhancements

---

## 👩‍💻 Author

Built by Kavya Mahabaleshwara Hegde
