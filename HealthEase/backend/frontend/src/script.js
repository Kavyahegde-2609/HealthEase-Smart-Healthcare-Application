/* script.js — HealthEase frontend (offline canvas-based map + full UI)
   Place as frontend/script.js
   Keep backend running at http://localhost:5000
   Updated: show all ambulances as icons, clear Available/Busy/Tracking badges,
   dispatch/track single ambulance (multiple can be tracked), show user location.
*/

// ---- CONFIG ----
const API_BASE = "http://localhost:5000/api"; // change if different
const AMB_ICON = "https://cdn-icons-png.flaticon.com/512/2966/2966327.png";
const DEL_ICON = "https://cdn-icons-png.flaticon.com/512/259/259538.png";

// ---- GLOBALS ----
let ambulances = [], doctors = [], appointments = [], medicines = [], telecalls = [];
const canvas = document.getElementById("mapCanvas");
const mapContainer = document.getElementById("mapContainer");
const ctx = canvas.getContext("2d");
let deviceRatio = window.devicePixelRatio || 1;
let mapState = { objects: [], bounds: null }; // objects includes ambulances, user, delivery, shops, etc.
let sessions = { ambulances: {}, delivery: null, activeOrderId: null }; // sessions.ambulances keyed by ambulance _id
let userLocation = null;
let rafId = null;

// -------------- canvas & mapping helpers --------------
function fitCanvas(){
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";
  canvas.width = Math.floor(rect.width * deviceRatio);
  canvas.height = Math.floor(rect.height * deviceRatio);
  ctx.setTransform(deviceRatio,0,0,deviceRatio,0,0);
}
window.addEventListener("resize", ()=>{ fitCanvas(); drawMap(); });

function latLngToXY(lat,lng,bounds,w,h){
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng || 1)) * w;
  const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat || 1)) * h;
  return { x, y };
}

function computeBounds(){
  const lats = [], lngs = [];
  mapState.objects.forEach(o => { if(typeof o.lat === 'number' && typeof o.lng === 'number'){ lats.push(o.lat); lngs.push(o.lng); } });
  if(userLocation){ lats.push(userLocation.lat); lngs.push(userLocation.lng); }
  if(lats.length===0) return { minLat:8, maxLat:38, minLng:68, maxLng:98 }; // fallback India
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latPad = (maxLat - minLat) * 0.12 + 0.01;
  const lngPad = (maxLng - minLng) * 0.12 + 0.01;
  return { minLat: minLat - latPad, maxLat: maxLat + latPad, minLng: minLng - lngPad, maxLng: maxLng + lngPad };
}

// small geodesy
function toRad(v){ return v * Math.PI/180; }
function haversineMeters(lat1,lon1,lat2,lon2){
  const R = 6371e3;
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// -------------- backend loads --------------
async function refreshAll(){
  await Promise.all([refreshAmbulances(), loadDoctors(), loadAppointments(), loadAllMedicines(), loadTelecalling()]);
  mapState.bounds = computeBounds();
  drawMap();
}
async function refreshAmbulances(){
  try {
    const r = await fetch(`${API_BASE}/ambulances`);
    const data = await r.json();
    ambulances = Array.isArray(data) ? data.slice() : [];
    // ensure at least 6 visible ambulances for demo if backend sparse
    if(ambulances.length < 6){
      const needed = 6 - ambulances.length;
      for(let i=0;i<needed;i++){
        const demoId = `demo_${Date.now().toString(36).slice(-6)}_${i}`;
        ambulances.push({
          _id: demoId,
          name: `Ambulance ${String.fromCharCode(65 + i)}`,
          location: randomNearby(12.9716,77.5946, 1500 + i*300),
          status: (i % 3 === 0) ? 'Busy' : 'Available',
          speedKmph: 40 + i*2,
          __demo: true
        });
      }
    }
    document.getElementById("ambulanceCount").innerText = `${ambulances.length} listed`;
    // Always ensure we have map objects for every ambulance (so they appear on map even when not tracking)
    ensureAllAmbObjects();
    renderAmbulanceList();
  } catch(e){
    console.error(e);
    document.getElementById("ambulanceList").innerHTML = `<div class="small muted">Failed to load ambulances</div>`;
  }
}

function ensureAllAmbObjects(){
  // Add or update mapState objects for *every* ambulance returned by backend/demo
  ambulances.forEach(a=>{
    if(!a._id) return;
    const id = `amb_${a._id}`;
    let obj = mapState.objects.find(o=>o.id===id);
    if(!obj){
      if(a.location && a.location.lat!=null && a.location.lng!=null){
        mapState.objects.push({
          id,
          type:'ambulance',
          lat:parseFloat(a.location.lat),
          lng:parseFloat(a.location.lng),
          icon:AMB_ICON,
          name:a.name || `Amb-${a._id}`,
          trail:[{lat:parseFloat(a.location.lat),lng:parseFloat(a.location.lng)}],
          meta: a // store raw backend object for reference
        });
      } else {
        // If no location, don't create a map object but keep it in list
      }
    } else {
      // update static location only if not currently being animated (active session)
      if(!sessions.ambulances[a._id]){
        if(a.location && a.location.lat!=null && a.location.lng!=null){
          obj.lat = parseFloat(a.location.lat);
          obj.lng = parseFloat(a.location.lng);
        }
        obj.name = a.name || obj.name;
        obj.meta = a;
      }
    }
  });
  // remove map objects for ambulances no longer in backend list (but keep any active session objects)
  const allowedIds = new Set(ambulances.map(a => `amb_${a._id}`));
  mapState.objects = mapState.objects.filter(o => {
    if(o.type === 'ambulance'){
      if(sessions.ambulances[o.id.replace('amb_','')]) return true; // keep active ones
      return allowedIds.has(o.id);
    }
    return true;
  });
  mapState.bounds = computeBounds();
  drawMap();
}

// -------------- list UI --------------
function renderAmbulanceList(){
  const el = document.getElementById("ambulanceList"); el.innerHTML = "";
  if(!ambulances.length){ el.innerHTML = "<div class='small muted'>No ambulances available</div>"; return; }

  ambulances.forEach(a=>{
    const row = document.createElement("div"); row.className = "item";
    const statusRaw = (a.status || 'Available').toString();
    const statusLower = statusRaw.toLowerCase();
    let badgeClass = "badge green";
    let badgeText = "Available";
    if(/busy|unavailable|occupied/i.test(statusLower)) { badgeClass = "badge red"; badgeText = "Busy"; }
    else if(/pending|en[- ]?route|dispatched|enroute/i.test(statusLower)) { badgeClass = "badge yellow"; badgeText = "En-route"; }
    // if tracking session exists for this ambulance, show Tracking
    const isActive = !!sessions.ambulances[a._id];
    if(isActive){ badgeClass = "badge yellow"; badgeText = "Tracking"; }

    const coordsText = (a.location && typeof a.location.lat !== 'undefined') ? `${parseFloat(a.location.lat).toFixed(5)}, ${parseFloat(a.location.lng).toFixed(5)}` : 'Location unknown';
    row.innerHTML = `<div style="min-width:220px;">
        <div style="font-weight:700">${escapeHtml(a.name || "Ambulance")}</div>
        <div class="small muted">${coordsText}</div>
      </div>`;

    const right = document.createElement("div");
    const badge = document.createElement("div"); badge.className = badgeClass; badge.innerText = badgeText;
    right.appendChild(badge);
    right.appendChild(document.createElement("br"));

    // Distance remaining display (if active session)
    if(isActive){
      const s = sessions.ambulances[a._id];
      const remKm = ((s.totalKm - s.coveredKm) > 0 ? (s.totalKm - s.coveredKm).toFixed(2) : "0.00");
      const span = document.createElement("div"); span.className = "small muted"; span.style.marginTop = "6px";
      span.innerText = `Remaining: ${remKm} km`;
      right.appendChild(span);
    }

    // Dispatch / Track button
    const dBtn = document.createElement("button"); dBtn.className="btn primary"; dBtn.style.marginTop = "6px";
    dBtn.innerText = isActive ? "Track" : "Dispatch & Track";
    dBtn.onclick = ()=> dispatchAmbulance(a);
    // Cancel button
    const cBtn = document.createElement("button"); cBtn.className="btn ghost"; cBtn.style.marginLeft="6px"; cBtn.style.marginTop = "6px";
    cBtn.innerText = isActive ? "Cancel Dispatch" : "Cancel";
    cBtn.onclick = ()=> cancelAmbulance(a._id);

    // disable dispatch only if ambulance is busy/unavailable and not a demo
    if(!isActive && /busy|unavailable|occupied/i.test(statusLower) && !a.__demo){
      dBtn.disabled = true;
    }

    right.appendChild(dBtn); right.appendChild(cBtn);
    row.appendChild(right);
    el.appendChild(row);
  });
}

// -------------- dispatch / animate ambulances --------------
function parseCoordsOrFail(input){
  input = (input||"").trim();
  const m = input.match(/^\s*([+-]?\d+(\.\d+)?)\s*[, ]\s*([+-]?\d+(\.\d+)?)\s*$/);
  if(m) return { lat: parseFloat(m[1]), lng: parseFloat(m[3]) };
  throw "Enter lat,lon (e.g. 12.9716,77.5946) or click Use my location.";
}

function useMyLocation(){
  if(!navigator.geolocation) return alert("Geolocation unsupported in this browser.");
  navigator.geolocation.getCurrentPosition(pos=>{
    userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    document.getElementById("addrInput").value = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
    const existing = mapState.objects.find(o=>o.id==='user_loc');
    if(existing){ existing.lat = userLocation.lat; existing.lng = userLocation.lng; }
    else mapState.objects.push({ id:'user_loc', type:'user', lat:userLocation.lat, lng:userLocation.lng, color:'#1976d2', name:"You" });
    mapState.bounds = computeBounds();
    drawMap();
  }, e=> alert("Could not get location: " + e.message), { enableHighAccuracy:true });
}

function dispatchAmbulance(a){
  // Ensure map shows this ambulance even if it was missing
  if(a.location && a.location.lat != null && a.location.lng != null){
    const objId = `amb_${a._id}`;
    let obj = mapState.objects.find(o=>o.id===objId);
    if(!obj){
      mapState.objects.push({
        id: objId, type:'ambulance', lat: parseFloat(a.location.lat), lng: parseFloat(a.location.lng),
        icon: AMB_ICON, name: a.name || "Ambulance", trail: [{lat: parseFloat(a.location.lat), lng: parseFloat(a.location.lng)}], meta: a
      });
    }
  }

  // If already active, simply center & show info
  if(sessions.ambulances[a._id]){
    showInfo(`${a.name} already dispatched — tracking`, true);
    mapState.bounds = computeBounds();
    drawMap();
    return;
  }

  // If ambulance marked not available and not demo, disallow dispatch
  if(a.status && /busy|unavailable|occupied/i.test(String(a.status).toLowerCase()) && !a.__demo){
    return alert(`${a.name} is marked ${a.status} and cannot be dispatched.`);
  }

  // Determine target from input or user location
  const addr = document.getElementById("addrInput").value.trim();
  let target;
  try {
    if(addr) target = parseCoordsOrFail(addr);
    else if(userLocation) target = userLocation;
    else { alert("Provide address or use my location"); return; }
  } catch(e){ alert(e); return; }

  const ambId = a._id || Math.random().toString(36).slice(2,9);
  const objId = `amb_${ambId}`;
  let existing = mapState.objects.find(o=>o.id===objId);
  let start = existing ? { lat: existing.lat, lng: existing.lng } : ((a.location && a.location.lat!=null && a.location.lng!=null) ? { lat:parseFloat(a.location.lat), lng:parseFloat(a.location.lng) } : { lat: target.lat + (Math.random()*0.02+0.01), lng: target.lng + (Math.random()*0.02+0.01) });

  const totalM = haversineMeters(start.lat,start.lng,target.lat,target.lng);
  const speedKmph = a.speedKmph || 35;
  const speedMps = (speedKmph * 1000) / 3600;
  const waypoints = buildLinearWaypoints(start, target, Math.max(20, Math.ceil(totalM/150)));

  const session = {
    id: ambId, name: a.name||"Ambulance", current:{...start}, target, waypoints, wpIndex:0,
    speedMps, totalKm: (totalM/1000), coveredKm:0, canceled:false, icon:AMB_ICON
  };
  sessions.ambulances[ambId] = session;

  let obj = mapState.objects.find(o=>o.id===objId);
  if(!obj) mapState.objects.push({ id:objId, type:'ambulance', lat:start.lat, lng:start.lng, icon:AMB_ICON, name:a.name||objId, trail:[{lat:start.lat,lng:start.lng}], meta: a });
  else { obj.lat = start.lat; obj.lng = start.lng; obj.trail = [{lat:start.lat,lng:start.lng}]; }

  mapState.bounds = computeBounds();
  showInfo(`${session.name} dispatched — ${session.totalKm.toFixed(2)} km`);
  renderAmbulanceList();
  if(!rafId) runAnimationLoop();

  // (optional) update backend status (commented)
  // if(a._id && !a.__demo){
  //   fetch(`${API_BASE}/ambulances/${a._id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: 'Dispatched' }) }).catch(()=>{});
  // }
}

function buildLinearWaypoints(start,target,count){
  const arr = [];
  for(let i=0;i<=count;i++){
    const t = i/count;
    arr.push({ lat: start.lat + (target.lat - start.lat)*t, lng: start.lng + (target.lng - start.lng)*t });
  }
  return arr;
}

function cancelAmbulance(ambId){
  if(!ambId) return showInfo("Invalid ambulance id", true);
  if(sessions.ambulances[ambId]){
    sessions.ambulances[ambId].canceled = true;
    // remove session and keep the ambulance object at its last known location
    delete sessions.ambulances[ambId];
    showInfo("Ambulance dispatch cancelled");
    renderAmbulanceList();
    drawMap();
    return;
  }
  // If not active, simply show message
  showInfo("No active dispatch for this ambulance", true);
}

// animation loop (handles multiple ambulances & delivery)
function runAnimationLoop(){
  fitCanvas();
  let last = performance.now();
  function frame(now){
    const dt = (now - last)/1000; last = now;
    // move ambulances
    for(const id of Object.keys(sessions.ambulances)){
      const s = sessions.ambulances[id];
      if(s.canceled){ delete sessions.ambulances[id]; continue; }
      const cur = s.current;
      const nextWp = s.waypoints[Math.min(s.wpIndex+1, s.waypoints.length-1)];
      const remaining = haversineMeters(cur.lat,cur.lng, nextWp.lat, nextWp.lng);
      if(remaining < 6){
        s.wpIndex = Math.min(s.wpIndex+1, s.waypoints.length-1);
        if(s.wpIndex >= s.waypoints.length-1){
          s.current = {...s.target};
          const obj = mapState.objects.find(o=>o.id===`amb_${id}`);
          if(obj){ obj.lat = s.current.lat; obj.lng = s.current.lng; obj.trail.push({...s.current}); }
          showInfo(`${s.name} arrived — ${s.totalKm.toFixed(2)} km`, true);
          delete sessions.ambulances[id];
          renderAmbulanceList();
          continue;
        }
      } else {
        const move = Math.min(s.speedMps * dt, remaining);
        const frac = move / remaining;
        const newLat = cur.lat + (nextWp.lat - cur.lat)*frac;
        const newLng = cur.lng + (nextWp.lng - cur.lng)*frac;
        s.current = { lat:newLat, lng:newLng };
        s.coveredKm += (move/1000);
        const obj = mapState.objects.find(o=>o.id===`amb_${id}`);
        if(obj){ obj.lat = newLat; obj.lng = newLng; obj.trail = (obj.trail||[]).concat([{lat:newLat,lng:newLng}]).slice(-250); }
      }
    }

    // delivery session movement (if any)
    if(sessions.delivery && sessions.delivery.running){
      const d = sessions.delivery;
      const rem = haversineMeters(d.current.lat, d.current.lng, d.dest.lat, d.dest.lng);
      if(rem < 6){
        d.current = {...d.dest}; d.running = false;
        showInfo("Delivery arrived!", true);
      } else {
        const move = Math.min(d.speedMps * dt, rem);
        const frac = move / rem;
        d.current.lat += (d.dest.lat - d.current.lat)*frac;
        d.current.lng += (d.dest.lng - d.current.lng)*frac;
        let dobj = mapState.objects.find(o=>o.id===`del_${d.id}`);
        if(!dobj) mapState.objects.push({ id:`del_${d.id}`, type:'delivery', lat:d.current.lat, lng:d.current.lng, icon:DEL_ICON, name:'Delivery', trail:[{lat:d.current.lat,lng:d.current.lng}] });
        else { dobj.lat = d.current.lat; dobj.lng = d.current.lng; dobj.trail = (dobj.trail||[]).concat([{lat:d.current.lat,lng:d.current.lng}]).slice(-200); }
      }
    }

    drawMap();
    if(Object.keys(sessions.ambulances).length || (sessions.delivery && sessions.delivery.running)) rafId = requestAnimationFrame(frame);
    else rafId = null;
  }
  if(!rafId) rafId = requestAnimationFrame(frame);
}

// -------------- drawing --------------
function clearCanvas(){ ctx.clearRect(0,0,canvas.width/deviceRatio, canvas.height/deviceRatio); }
function drawMap(){
  clearCanvas();
  const w = canvas.width/deviceRatio, h = canvas.height/deviceRatio;
  mapState.bounds = mapState.bounds || computeBounds();
  const b = mapState.bounds;

  // subtle background
  ctx.fillStyle = "#f6fbff"; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle = "rgba(200,220,230,0.35)"; ctx.lineWidth = 1;
  const gx = 6, gy = 6;
  for(let i=1;i<gx;i++){ ctx.beginPath(); ctx.moveTo((w/gx)*i,0); ctx.lineTo((w/gx)*i,h); ctx.stroke(); }
  for(let j=1;j<gy;j++){ ctx.beginPath(); ctx.moveTo(0,(h/gy)*j); ctx.lineTo(w,(h/gy)*j); ctx.stroke(); }

  // trails (draw below icons)
  mapState.objects.forEach(o=>{
    if(o.trail && o.trail.length>1){
      ctx.beginPath();
      const p0 = latLngToXY(o.trail[0].lat, o.trail[0].lng, b, w, h);
      ctx.moveTo(p0.x, p0.y);
      for(let i=1;i<o.trail.length;i++){
        const p = latLngToXY(o.trail[i].lat, o.trail[i].lng, b, w, h);
        ctx.lineTo(p.x, p.y);
      }
      ctx.lineWidth = (o.type==='ambulance'? 3 : 2);
      ctx.strokeStyle = (o.type==='ambulance'? 'rgba(224,67,67,0.9)' : 'rgba(255,152,0,0.9)');
      ctx.stroke();
    }
  });

  // objects (icons & labels)
  mapState.objects.forEach(o=>{
    const p = latLngToXY(o.lat, o.lng, b, w, h);
    if(o.icon){
      if(!o._img){
        const img = new Image(); img.crossOrigin = "anonymous"; img.src = o.icon;
        img.onload = ()=>{ o._img = img; drawMap(); }; o._img = null;
      }
      if(o._img instanceof Image){
        // Ambulence/delivery icons larger to match your reference image feel
        const size = (o.type==='ambulance' || o.type==='delivery') ? 36 : 18;
        ctx.drawImage(o._img, p.x - size/2, p.y - size/2, size, size);
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI*2); ctx.fillStyle = o.color || '#1976d2'; ctx.fill();
      }
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI*2); ctx.fillStyle = o.color || '#1976d2'; ctx.fill();
    }
    ctx.font = "12px Inter, Arial"; ctx.fillStyle = "#102027";
    const label = (o.type==='user' ? "You" : (o.type==='ambulance' ? (o.name||o.id.replace('amb_','')) : (o.type==='delivery' ? 'Delivery' : (o.type==='shop'?'Shop':''))));
    ctx.fillText(label, p.x + 14, p.y + 6);
  });

  updateSessionInfo();
}

// -------------- UI helpers & small features --------------
function showInfo(txt, transient=false){ const box = document.getElementById("infoBox"); box.style.display = "block"; box.innerText = txt; if(transient) setTimeout(()=> box.style.display = "none",4000); }
function escapeHtml(s){ if(!s) return ""; return String(s).replace(/[&<>"'`]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;",'`':'&#96;'}[c])); }
function $(id){ return document.getElementById(id); }

// -------------- Doctors (unchanged) --------------
async function loadDoctors(){
  try {
    const r = await fetch(`${API_BASE}/doctors`); doctors = await r.json();
    renderDoctors(doctors); populateDoctorSelect(doctors);
  } catch(e){ console.error(e); $("doctorsList").innerHTML = `<div class='small muted'>Doctors load failed</div>`; }
}
function renderDoctors(list){
  const el = $("doctorsList"); el.innerHTML = ""; const specs = new Set();
  if(!list || !list.length){ el.innerHTML = "<div class='small muted'>No doctors found</div>"; return; }
  list.forEach(d=>{
    specs.add(d.specialization);
    const times = (d.availabilityTimes && d.availabilityTimes.length) ? d.availabilityTimes.join(" • ") : "No schedule provided";
    const onLeave = d.onLeaveUntil ? (new Date(d.onLeaveUntil) > new Date()) : false;
    const badgeText = onLeave ? `On leave until ${d.onLeaveUntil.slice(0,10)}` : (d.available ? "Available" : "Unavailable");
    const badgeClass = onLeave ? "badge red" : (d.available ? "badge green" : "badge red");
    const row = document.createElement("div"); row.className="item";
    row.innerHTML = `<div><div style="font-weight:700">${escapeHtml(d.name)}</div>
      <div class="small">${escapeHtml(d.specialization)} • ${escapeHtml(times)}</div></div>`;
    const right = document.createElement("div");
    const badge = document.createElement("div"); badge.className = badgeClass; badge.innerText = badgeText;
    const bookBtn = document.createElement("button"); bookBtn.className = "btn primary"; bookBtn.innerText="Book";
    bookBtn.onclick = ()=> { $("apptDoctor").value = d._id; showPanel('appointments'); };
    right.appendChild(badge); right.appendChild(document.createElement("br")); right.appendChild(bookBtn);
    row.appendChild(right); el.appendChild(row);
  });
  const sel = $("specFilter"); sel.innerHTML = '<option value="">All specializations</option>';
  Array.from(specs).sort().forEach(s=>{ const o = document.createElement("option"); o.value=s; o.innerText=s; sel.appendChild(o); });
}
function filterDoctors(){
  const q = ($("docSearch").value || "").trim().toLowerCase(); const spec = $("specFilter").value;
  let list = doctors.slice();
  if(q){
    const diseaseMap = {
      "fever": ["General Physician","Internal Medicine"],
      "heart": ["Cardiologist"],
      "skin": ["Dermatologist"],
      "child": ["Pediatrician"],
      "ear": ["ENT"],
      "bone": ["Orthopedic"],
      "brain": ["Neurologist"]
    };
    if(diseaseMap[q]) {
      const specs = diseaseMap[q];
      list = list.filter(d => specs.includes(d.specialization));
    } else {
      list = list.filter(d => (d.name||"").toLowerCase().includes(q) || (d.specialization||"").toLowerCase().includes(q));
    }
  }
  if(spec) list = list.filter(d => d.specialization === spec);
  if(spec && !list.length) return alert(`No doctors found for specialization: ${spec}`);
  renderDoctors(list);
}
function populateDoctorSelect(docs){
  const sel = $("apptDoctor"); sel.innerHTML = '<option value="">-- Select doctor --</option>';
  docs.forEach(d => { const o = document.createElement("option"); o.value = d._id; o.text = `${d.name} — ${d.specialization}`; sel.appendChild(o); });
}

// -------------- Appointments (unchanged) --------------
async function loadAppointments(){
  try {
    const r = await fetch(`${API_BASE}/appointments`); appointments = await r.json();
    const el = $("appointmentsList"); el.innerHTML = "";
    if(!appointments.length) el.innerHTML = "<div class='small muted'>No appointments yet</div>";
    appointments.forEach(a=>{
      const row = document.createElement("div"); row.className="item";
      row.innerHTML = `<div><strong>${escapeHtml(a.patientName || a.patient || "Unknown")}</strong><div class="small">${escapeHtml(a.disease || "")} — ${new Date(a.date).toLocaleDateString()}</div></div>`;
      const right = document.createElement("div");
      const cancelBtn = document.createElement("button"); cancelBtn.className="btn ghost"; cancelBtn.innerText="Cancel";
      cancelBtn.onclick = async ()=>{
        try {
          const res = await fetch(`${API_BASE}/appointments/${a._id}/cancel`, { method:'POST' });
          if(res.ok){ alert("Cancelled"); loadAppointments(); } else alert("Cancel failed");
        } catch(e){ alert(e); }
      };
      right.appendChild(cancelBtn); row.appendChild(right); el.appendChild(row);
    });
  } catch(e){ console.error(e); $("appointmentsList").innerHTML = `<div class='small muted'>Load failed</div>`; }
}
async function createAppointment(){
  const name = ($("apptName").value||"").trim(); const mobile = ($("apptMobile").value||"").trim();
  const docId = $("apptDoctor").value; const date = $("apptDate").value;
  const disease = ($("apptDisease").value || "General").trim();
  if(!/^[A-Za-z ]{2,100}$/.test(name)) return alert("Enter valid name (letters & spaces only).");
  if(!/^\d{10}$/.test(mobile)) return alert("Enter 10-digit mobile.");
  if(!date) return alert("Choose appointment date.");
  const sel = new Date(date + "T00:00:00"); const today = new Date(); today.setHours(0,0,0,0);
  if(sel < today) return alert("Cannot book past dates.");
  if(docId){
    const doc = doctors.find(d => d._id === docId);
    if(doc && doc.onLeaveUntil){
      const until = new Date(doc.onLeaveUntil + "T00:00:00");
      if(sel <= until) return alert(`${doc.name} is on leave until ${doc.onLeaveUntil}.`);
    }
  }
  try {
    const payload = { patientName: name, disease, date, doctorId: docId || undefined };
    const r = await fetch(`${API_BASE}/appointments`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if(r.ok){ alert("Appointment booked!"); loadAppointments(); $("apptName").value=""; $("apptMobile").value=""; $("apptDate").value=""; $("apptDisease").value=""; }
    else { const err = await r.json(); alert("Booking failed: " + (err.error||JSON.stringify(err))); }
  } catch(e){ alert("Network error: " + e); }
}

// -------------- Medicines (unchanged) --------------
async function loadAllMedicines(){
  try {
    const r = await fetch(`${API_BASE}/medicines`); medicines = await r.json(); renderMedicineList(medicines);
  } catch(e){ console.error(e); $("medList").innerHTML = `<div class='small muted'>Medicines load failed</div>`; }
}
function renderMedicineList(list){
  const el = $("medList"); el.innerHTML = "";
  if(!list || !list.length){ el.innerHTML = "<div class='small muted'>No medicines found</div>"; return; }
  list.forEach(m=>{
    const row = document.createElement("div"); row.className="item";
    row.innerHTML = `<div><strong>${escapeHtml(m.name)}</strong><div class="small">${escapeHtml(m.pharmacy||m.shop||"Pharmacy")} • ₹${m.price ?? 'N/A'} • Stock: ${m.stock ?? 0}</div></div>`;
    const right = document.createElement("div"); const orderBtn = document.createElement("button"); orderBtn.className="btn primary"; orderBtn.innerText="Order";
    orderBtn.onclick = ()=> startOrder(m);
    right.appendChild(orderBtn); row.appendChild(right); el.appendChild(row);
  });
}
function searchMedicines(){ const q = ($("medSearch").value||"").toLowerCase(); renderMedicineList(medicines.filter(m=> (m.name||"").toLowerCase().includes(q))); }

let currentOrder = null;
function startOrder(med){
  if(!med.stock || med.stock <= 0) return alert("Medicine not available at selected pharmacy.");
  currentOrder = { med, shop: med.pharmacy || med.shop, price: med.price, qty:1 };
  $("orderSummary").innerText = `${med.name} — ${currentOrder.shop} — ₹${med.price}`;
  $("orderPanel").style.display = "block";
  $("deliveryControls").style.display = "none";
}
function cancelOrder(){ currentOrder=null; $("orderPanel").style.display = "none"; alert("Order cancelled."); }
function cancelActiveOrder(){ if(sessions.delivery){ sessions.delivery = null; sessions.activeOrderId = null; mapState.objects = mapState.objects.filter(o=> !o.id.startsWith('shop_') && !o.id.startsWith('dest_') && !o.id.startsWith('del_')); $("deliveryControls").style.display = "none"; alert("Order cancelled."); drawMap(); } else alert("No active order."); }

function parseCoordsOrFailSync(input){
  input = (input||"").trim();
  const m = input.match(/^\s*([+-]?\d+(\.\d+)?)\s*[, ]\s*([+-]?\d+(\.\d+)?)\s*$/);
  if(m) return { lat: parseFloat(m[1]), lng: parseFloat(m[3]) };
  throw "Provide lat,lon format for delivery in demo.";
}

function validateUPI(upi){ return /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi); }
function validateCard(card){ const clean = (card||"").replace(/\s+/g,""); return /^\d{12,19}$/.test(clean); }
function validateExpiry(exp){ return /^(0[1-9]|1[0-2])\/?([0-9]{2})$/.test(exp); }
function validateCVV(cvv){ return /^\d{3,4}$/.test(cvv); }

async function placeOrder(){
  if(!currentOrder) return alert("No order selected.");
  const addr = ($("deliveryAddress").value||"").trim(); const mobile = ($("deliveryMobile").value||"").trim();
  if(!addr) return alert("Enter delivery address");
  if(!/^\d{10}$/.test(mobile)) return alert("Enter 10-digit mobile");
  const pay = $("payMethod").value;

  try {
    const backendMed = medicines.find(m => m.name === currentOrder.med.name && (m.pharmacy === currentOrder.shop || m.shop === currentOrder.shop));
    if(backendMed && (!backendMed.stock || backendMed.stock <= 0)) return alert("Selected pharmacy does not have required stock. Choose another shop.");
  } catch(e){}

  if(pay === "upi"){
    const upi = prompt("Enter UPI ID (demo):");
    if(!upi) return alert("Payment cancelled.");
    if(!validateUPI(upi)) return alert("Invalid UPI format. Payment failed (demo).");
  } else if(pay === "card"){
    const number = prompt("Enter card number (demo):");
    if(!number) return alert("Payment cancelled.");
    if(!validateCard(number)) return alert("Invalid card number. Payment failed (demo).");
    const expiry = prompt("Enter expiry (MM/YY):"); if(!expiry || !validateExpiry(expiry)) return alert("Invalid expiry.");
    const cvv = prompt("Enter CVV:"); if(!cvv || !validateCVV(cvv)) return alert("Invalid CVV.");
  } else {
    if(!confirm("Confirm Cash on Delivery?")) return;
  }

  let dest;
  try { dest = parseCoordsOrFailSync(addr); } catch(e){
    dest = randomNearby(12.9716,77.5946, 2000); // fallback near Bangalore
  }

  const shopCoords = randomNearby(dest.lat,dest.lng, 3000 + Math.random()*8000);
  sessions.delivery = { id:'order_'+Date.now(), med: currentOrder.med.name, shop: shopCoords, dest, current:{...shopCoords}, speedMps: (25+Math.random()*15)*1000/3600, running:false };
  sessions.activeOrderId = sessions.delivery.id;

  mapState.objects.push({ id:`shop_${sessions.delivery.id}`, type:'shop', lat:shopCoords.lat, lng:shopCoords.lng, color:'#2e7d32', name: currentOrder.shop });
  mapState.objects.push({ id:`dest_${sessions.delivery.id}`, type:'dest', lat:dest.lat, lng:dest.lng, color:'#1976d2', name:'Delivery destination' });

  $("orderPanel").style.display = "none"; $("deliveryControls").style.display = "block";
  if(confirm("Open map to track delivery now? (OK opens map)")) showMap();
  mapState.bounds = computeBounds(); drawMap();
  alert("Order placed (demo). Click Track Delivery to animate.");
  currentOrder = null;
}

function startDeliveryTracking(){ if(!sessions.delivery) return alert("No delivery"); if(sessions.delivery.running) return alert("Already tracking"); sessions.delivery.running = true; if(!rafId) runAnimationLoop(); showMap(); }
function stopDeliveryTracking(){ if(sessions.delivery) sessions.delivery.running = false; }

// -------------- Telecalling (unchanged) --------------
async function loadTelecalling(){
  try {
    const r = await fetch(`${API_BASE}/telecalling`); telecalls = await r.json();
    const el = $("teleList"); el.innerHTML = "";
    if(!telecalls.length) el.innerHTML = "<div class='small muted'>No telecalling requests</div>";
    telecalls.forEach((t, idx)=>{
      const name = t.hospitalName || t.hospital || `Hospital ${idx+1}`;
      const phone = t.phone || t.contact || t.mobile || "N/A";
      const busy = (typeof t.busy !== 'undefined') ? t.busy : (Math.random() < 0.3);
      const row = document.createElement("div"); row.className="item";
      row.innerHTML = `<div><strong>${escapeHtml(name)}</strong><div class="small">${escapeHtml(t.reason || t.issue || '')}</div><div class="small muted">Phone: ${escapeHtml(phone)} ${busy ? ' • Busy' : ''}</div></div>`;
      const btn = document.createElement("button"); btn.className="btn primary"; btn.innerText="Call";
      btn.onclick = ()=> openCallDemo(name, phone, busy);
      row.appendChild(btn); el.appendChild(row);
    });
  } catch(e){ console.error(e); $("teleList").innerHTML = `<div class='small muted'>Load failed</div>`; }
}
function openCallDemo(name, phone, busy){
  const modal = document.createElement("div"); modal.className="modal-backdrop";
  modal.innerHTML = `<div class="modal"><h3>Calling ${escapeHtml(name)}</h3><div class="small-muted">Number: ${escapeHtml(phone)}</div><div style="margin-top:12px"><button id="acceptCall" class="btn primary">Accept</button> <button id="rejectCall" class="btn ghost">Reject</button></div></div>`;
  document.getElementById("modalRoot").appendChild(modal);
  modal.querySelector("#rejectCall").onclick = ()=> { modal.remove(); alert("Call ended"); };
  modal.querySelector("#acceptCall").onclick = ()=> {
    modal.remove();
    const speak = txt => { const u = new SpeechSynthesisUtterance(txt); speechSynthesis.speak(u); };
    speak(`Hello from ${name}. This is a demo call.`);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition){
      const reply = prompt("Speech recognition not supported. Type your reply (simulated):");
      if(reply) speak(`You said: ${reply}. Thank you.`);
      else speak("No reply received. Ending demo.");
    } else {
      const rec = new SpeechRecognition(); rec.lang='en-IN'; rec.interimResults=false; rec.maxAlternatives=1;
      rec.start();
      rec.onresult = (e)=> {
        const text = e.results[0][0].transcript;
        speak(`You said: ${text}. Thank you. This is end of demo.`);
      };
      rec.onerror = (err)=> { console.warn(err); alert("Speech recognition error or denied: " + (err.error||err.message)); };
      setTimeout(()=>{ try{ rec.stop(); }catch(e){} }, 8000);
    }
  };
}

// -------------- session info --------------
function updateSessionInfo(){
  const active = Object.values(sessions.ambulances);
  const el = $("infoBox");
  if(active.length===0 && (!sessions.delivery || !sessions.delivery.running)){ el.style.display = "none"; return; }
  if(!isPanelVisible('ambulance') && !(sessions.delivery && sessions.delivery.running)) { el.style.display = "none"; return; }
  const lines = [];
  active.forEach(s=>{
    lines.push(`${s.name} — Covered: ${s.coveredKm.toFixed(2)} / ${s.totalKm.toFixed(2)} km`);
  });
  if(sessions.delivery && sessions.delivery.running){
    const d = sessions.delivery;
    const rem = (haversineMeters(d.current.lat,d.current.lng,d.dest.lat,d.dest.lng)/1000).toFixed(2);
    lines.push(`Delivery (${d.med}) — Remaining: ${rem} km`);
  }
  el.style.display = "block"; el.innerText = lines.join("\n");
}

// -------------- helpers & init --------------
function randomNearby(lat,lng,meters){
  const r = meters/111300; const u=Math.random(), v=Math.random(); const w=r*Math.sqrt(u), t=2*Math.PI*v; const dx=w*Math.cos(t), dy=w*Math.sin(t);
  return { lat: lat + dy, lng: lng + dx/Math.cos(lat*Math.PI/180) };
}

window.showPanel = function(name){
  const panels = { ambulance:"panel-ambulance", doctors:"panel-doctors", appointments:"panel-appointments", medicines:"panel-medicines", telecalling:"panel-telecalling" };
  Object.values(panels).forEach(p => document.getElementById(p).classList.add("hidden"));
  document.getElementById(panels[name]||panels.ambulance).classList.remove("hidden");
  if(name === 'ambulance') { mapContainer.classList.remove("hidden"); fitCanvas(); drawMap(); }
  else if(name === 'medicines'){
    if(sessions.delivery && sessions.delivery.running) { mapContainer.classList.remove("hidden"); fitCanvas(); drawMap(); } else mapContainer.classList.add("hidden");
  } else mapContainer.classList.add("hidden");
  updateSessionInfo();
};

window.refreshAll = refreshAll;
window.refreshAmbulances = refreshAmbulances;
window.useMyLocation = useMyLocation;
window.dispatchAmbulance = dispatchAmbulance;
window.cancelAmbulance = cancelAmbulance;
window.loadDoctors = loadDoctors;
window.filterDoctors = filterDoctors;
window.createAppointment = createAppointment;
window.loadAppointments = loadAppointments;
window.loadAllMedicines = loadAllMedicines;
window.searchMedicines = searchMedicines;
window.startOrder = startOrder;
window.cancelOrder = cancelOrder;
window.placeOrder = placeOrder;
window.startDeliveryTracking = startDeliveryTracking;
window.stopDeliveryTracking = stopDeliveryTracking;
window.loadTelecalling = loadTelecalling;
window.cancelActiveOrder = cancelActiveOrder;

function showMap(){ mapContainer.classList.remove("hidden"); fitCanvas(); drawMap(); }
function hideMap(){ mapContainer.classList.add("hidden"); }

function isPanelVisible(name){
  const panels = { ambulance:"panel-ambulance", doctors:"panel-doctors", appointments:"panel-appointments", medicines:"panel-medicines", telecalling:"panel-telecalling" };
  return !document.getElementById(panels[name]||panels.ambulance).classList.contains("hidden");
}

function init(){
  fitCanvas(); refreshAll(); showPanel('ambulance');
  // refresh appointments & ambulances periodically but keep interval reasonable
  setInterval(()=>{ loadAppointments(); refreshAmbulances(); }, 20000);
}
window.onload = init;
