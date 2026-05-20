// Global error handlers for debugging
window.addEventListener('error', function (e) {
    alert('JS Error: ' + e.message + ' at ' + e.filename + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', function (e) {
    alert('Unhandled Promise Rejection: ' + e.reason);
});

// --- Supabase Connection & Configuration ---
let supabaseClient = null;
let supabaseUrl = 'https://mrcwgnlpgirokhqpuryc.supabase.co';
let supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yY3dnbmxwZ2lyb2tocXB1cnljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTU5NzcsImV4cCI6MjA5NDgzMTk3N30.XagMxprQEYDmJrK5-nINujRIxiJxTEYdHfI8--h7c8k';

function initSupabase() {
    if (supabaseUrl && supabaseKey) {
        try {
            supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
            return true;
        } catch (e) {
            console.error("Supabase Client initialization error", e);
            return false;
        }
    }
    return false;
}

// --- Authentication & Session Handling ---
let authTab = 'login';

function showAuthOverlay(show) {
    const overlay = document.getElementById('auth-overlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

function switchAuthTab(tab) {
    try {
        authTab = tab;
        const tabLogin = document.getElementById('tab-login');
        const tabSignup = document.getElementById('tab-signup');
        const indicator = document.getElementById('auth-tab-indicator');
        const nameField = document.getElementById('name-field-container');
        const submitBtn = document.getElementById('btn-auth-submit');
        const authName = document.getElementById('auth-name');

        if (!tabLogin || !tabSignup || !nameField || !submitBtn || !authName) {
            console.error("Missing Auth UI elements in switchAuthTab");
            return;
        }

        if (tab === 'login') {
            tabLogin.classList.add('active');
            tabSignup.classList.remove('active');
            if (indicator) indicator.style.transform = 'translateX(0)';
            nameField.classList.add('hidden');
            authName.required = false;
            submitBtn.innerHTML = `<span>เข้าสู่ระบบ</span> <i class="fa-solid fa-arrow-right-to-bracket"></i>`;
        } else {
            tabLogin.classList.remove('active');
            tabSignup.classList.add('active');
            if (indicator) indicator.style.transform = 'translateX(100%)';
            nameField.classList.remove('hidden');
            authName.required = true;
            submitBtn.innerHTML = `<span>สมัครสมาชิก</span> <i class="fa-solid fa-user-plus"></i>`;
        }
    } catch (err) {
        console.error("switchAuthTab error:", err);
        alert("เกิดข้อผิดพลาดในการสลับแท็บ: " + err.message);
    }
}
window.switchAuthTab = switchAuthTab;
window._appSwitchAuthTab = switchAuthTab;

async function handleAuthSubmit(e) {
    e.preventDefault();
    if (!initSupabase()) {
        Swal.fire('ยังไม่ได้ตั้งค่าเชื่อมต่อ', 'กรุณาระบุ Anon Key ในซอร์สโค้ดเพื่อเริ่มต้นใช้งาน', 'warning');
        return;
    }

    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const display_name = document.getElementById('auth-name').value.trim();

    showLoading(true, authTab === 'login' ? 'กำลังเข้าสู่ระบบ...' : 'กำลังลงทะเบียนสมาชิก...');
    try {
        if (authTab === 'login') {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (data.user) {
                await loadUserProfileAndData(data.user);
                Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'ยินดีต้อนรับกลับเข้าสู่ระบบ', timer: 1500, showConfirmButton: false });
            }
        } else {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { display_name: display_name }
                }
            });
            if (error) throw error;
            if (data.user) {
                await loadUserProfileAndData(data.user);
                Swal.fire('ลงทะเบียนสำเร็จ', 'ยินดีต้อนรับสมาชิกใหม่ ระบบได้สร้างพื้นที่งานให้แล้ว', 'success');
            }
        }
    } catch (err) {
        Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
    } finally {
        showLoading(false);
    }
}
window.handleAuthSubmit = handleAuthSubmit;
window._appHandleAuthSubmit = handleAuthSubmit;

async function checkAuthSession() {
    if (!initSupabase()) {
        showAuthOverlay(true);
        return;
    }

    showLoading(true, 'กำลังยืนยันตัวตน...');
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            await loadUserProfileAndData(session.user);
        } else {
            showAuthOverlay(true);
        }
    } catch (e) {
        console.error("Auth session retrieval error", e);
        showAuthOverlay(true);
    } finally {
        showLoading(false);
    }
}

async function loadUserProfileAndData(authUser) {
    let profile = null;
    // ดึงข้อมูลโปรไฟล์ (และวนเช็คซ้ำเนื่องจากระบบ Database Trigger อาจจะบันทึกช้ากว่าเศษเสี้ยววินาที)
    for (let i = 0; i < 4; i++) {
        const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
        if (data) {
            profile = data;
            break;
        }
        await new Promise(r => setTimeout(r, 800));
    }

    if (profile) {
        currentUser = {
            id: authUser.id,
            email: authUser.email,
            name: profile.display_name || 'ผู้ใช้ทั่วไป',
            user_code: profile.user_code,
            team_id: profile.team_id,
            category: localStorage.getItem('survey_current_cat') || 'ทั่วไป'
        };

        // โหลดลิงก์แชร์ของ Google Drive เก่าที่กรอกไว้
        const oldUrl = localStorage.getItem('survey_geojson_drive_url') || '';
        document.getElementById('set-geojson-drive-url').value = oldUrl;

        updateUserInfo();
        showAuthOverlay(false);
        await syncJobsFromDB();
    } else {
        throw new Error("ระบบไม่สามารถสร้างโปรไฟล์ได้ในขณะนี้ กรุณาลองล็อกอินใหม่อีกครั้ง");
    }
}

async function handleLogout() {
    closeSettingsModal();
    showLoading(true, 'กำลังออกจากระบบ...');
    try {
        if (supabaseClient) await supabaseClient.auth.signOut();
    } catch (e) { }
    currentUser = { name: 'ผู้ใช้ทั่วไป', category: 'ทั่วไป' };
    dbJobs = [];
    markersGroup.clearLayers();
    updateUserInfo();
    showAuthOverlay(true);
    showLoading(false);
}

// --- Data Sync with Supabase ---
async function syncJobsFromDB() {
    if (!supabaseClient || !currentUser) return;
    showLoading(true, 'กำลังโหลดข้อมูลแปลงสำรวจ...');
    try {
        const { data, error } = await supabaseClient
            .from('jobs')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        dbJobs = data || [];
        updateAmphoeDropdown();
        renderMap(true);
    } catch (e) {
        console.error("Fetch jobs error", e);
        Swal.fire('โหลดจุดแผนที่ล้มเหลว', e.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function syncJobsSilently() {
    if (!supabaseClient || !currentUser || isNavigating) return;
    try {
        const { data, error } = await supabaseClient
            .from('jobs')
            .select('*')
            .order('updated_at', { ascending: false });

        if (!error && data) {
            dbJobs = data;
            renderMap(false);
            if (selectedJobId) {
                const currentOpenJob = dbJobs.find(j => j.id === selectedJobId);
                if (currentOpenJob) {
                    const nameActive = document.activeElement === document.getElementById('sheet-name');
                    const noteActive = document.activeElement === document.getElementById('sheet-note');
                    if (!nameActive && !noteActive) {
                        openSheetSilently(currentOpenJob);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Silent sync error", e);
    }
}

async function saveJobToSupabase(job) {
    if (!supabaseClient || !currentUser) return;
    const { error } = await supabaseClient
        .from('jobs')
        .upsert({
            id: job.id,
            team_id: currentUser.team_id,
            lat: job.lat,
            lng: job.lng,
            geometry: job.geometry,
            status: job.status,
            category: job.category,
            properties: job.properties,
            updated_at: new Date().toISOString()
        });

    if (error) throw error;
}

async function deleteJobFromSupabase(id) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient
        .from('jobs')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

async function clearAllSupabaseJobs() {
    if (!supabaseClient || !currentUser) return;
    const { error } = await supabaseClient
        .from('jobs')
        .delete()
        .eq('team_id', currentUser.team_id);

    if (error) throw error;
}

// --- Global State Variables ---
let map, userMarker, routingControl;
let dbJobs = [], markersGroup;
let selectedJobId = null, currentUser = { name: 'ผู้ใช้ทั่วไป', category: 'ทั่วไป' }, categories = ['ทั่วไป', 'ตรวจสอบ', 'เร่งด่วน'];
let viewMode = 'original', isNavigating = false, isFollowing = false;
let speechSynth = window.speechSynthesis;
let navInterval = null;
let markerJustClicked = false;

// Override Swal.fire to prevent overlapping/frozen alerts, especially on iOS Safari
if (window.Swal) {
    const originalSwalFire = Swal.fire.bind(Swal);
    Swal.fire = function (...args) {
        try {
            if (Swal.isVisible()) {
                Swal.close();
                // Wait for close animation to finish before opening new dialog
                return new Promise((resolve) => {
                    setTimeout(() => {
                        originalSwalFire(...args).then(resolve);
                    }, 150);
                });
            }
        } catch (e) { }
        return originalSwalFire(...args);
    };
}

let showPinLabels = localStorage.getItem('survey_show_labels') !== 'false';
const cloudinaryCloudName = 'dsi3g3dix';
const cloudinaryUploadPreset = 'survey-extrapro';
let isGpsActive = false;
let gpsWatchId = null;

let maps, currentBaseMap = 'hybrid';

async function startApp() {
    // โหลดหมวดหมู่จากความจำเดิม (ถ้ามี)
    try {
        const c = localStorage.getItem('survey_cats_v16');
        if (c) categories = JSON.parse(c);
    } catch (e) { }

    initApp();
    await checkAuthSession();

    // เริ่ม Polling ข้อมูลในทีมเงียบ ๆ ทุก 10 วินาที
    setInterval(syncJobsSilently, 10000);
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(startApp, 0);
} else {
    window.addEventListener('load', () => setTimeout(startApp, 0));
}

function showLoading(s, t) {
    document.getElementById('loading-overlay').style.display = s ? 'flex' : 'none';
    if (t) document.getElementById('loading-text').innerText = t;
}

function initApp() {
    // Initialize Leaflet objects here (safely inside a function, not at parse time)
    markersGroup = L.layerGroup();
    maps = {
        street: L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20 }),
        hybrid: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 20 })
    };

    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([13.7, 100.5], 6);
    maps.hybrid.addTo(map);
    markersGroup.addTo(map);

    startGpsTracking();

    map.on('dragstart', () => { if (isFollowing) toggleGPSFollow(false); });

    map.on('click', () => {
        if (markerJustClicked) {
            markerJustClicked = false;
            return;
        }
        const res = document.getElementById('search-results');
        if (res) res.classList.remove('active');
        if (!isNavigating && selectedJobId) {
            closeSheet();
        }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        const searchInp = document.getElementById('inp-search');
        const searchRes = document.getElementById('search-results');
        if (searchInp && searchRes && !searchInp.contains(e.target) && !searchRes.contains(e.target)) {
            searchRes.classList.remove('active');
        }
    });

    // Initialize label toggle button visual state
    const btn = document.getElementById('btn-label');
    if (btn) {
        if (showPinLabels) {
            btn.classList.add('bg-blue-50', 'text-blue-600');
        } else {
            btn.classList.remove('bg-blue-50', 'text-blue-600');
            btn.classList.add('text-gray-400');
        }
    }
}

function startGpsTracking() {
    if (gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId);

    gpsWatchId = navigator.geolocation.watchPosition(p => {
        isGpsActive = true;
        updateGpsStatus();
        const latlng = [p.coords.latitude, p.coords.longitude];
        if (!userMarker) {
            userMarker = L.marker(latlng, {
                icon: L.divIcon({ className: 'bg-blue-500 w-4 h-4 rounded-full border-2 border-white shadow' })
            }).addTo(map);
        } else {
            userMarker.setLatLng(latlng);
        }
        if (isFollowing && !isNavigating) map.setView(latlng, 18);
    }, e => {
        isGpsActive = false;
        updateGpsStatus();
        console.error("GPS Watch error", e);
    }, { enableHighAccuracy: true });
}

function updateGpsStatus() {
    const el = document.getElementById('profile-gps-status');
    if (!el) return;
    if (isGpsActive) {
        el.innerHTML = '<span class="inline-flex items-center text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full"><i class="fa-solid fa-circle text-[6px] mr-1 animate-pulse"></i> ใช้งานได้</span>';
    } else {
        el.innerHTML = '<span class="inline-flex items-center text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><i class="fa-solid fa-circle text-[6px] mr-1"></i> ไม่ได้รับอนุญาต / ปิดอยู่</span>';
    }
}

function resetGps() {
    showLoading(true, 'กำลังเปิดขอสิทธิ์ GPS อีกครั้ง...');
    navigator.geolocation.getCurrentPosition(p => {
        isGpsActive = true;
        updateGpsStatus();
        const latlng = [p.coords.latitude, p.coords.longitude];
        if (!userMarker) {
            userMarker = L.marker(latlng, {
                icon: L.divIcon({ className: 'bg-blue-500 w-4 h-4 rounded-full border-2 border-white shadow' })
            }).addTo(map);
        } else {
            userMarker.setLatLng(latlng);
        }
        map.setView(latlng, 17);
        showLoading(false);
        Swal.fire({
            icon: 'success',
            title: 'เชื่อมต่อ GPS สำเร็จ',
            text: 'ตำแหน่งของคุณอัปเดตบนแผนที่เรียบร้อยแล้ว',
            timer: 2000,
            showConfirmButton: false
        });
        startGpsTracking();
    }, err => {
        isGpsActive = false;
        updateGpsStatus();
        showLoading(false);
        let errMsg = 'กรุณาตรวจสอบว่าเปิดระบุตำแหน่งบนอุปกรณ์แล้ว';
        if (err.code === 1) {
            errMsg = 'สิทธิ์ระบุตำแหน่งถูกปฏิเสธ กรุณากดรูปแม่กุญแจ (Padlock) ที่แถบที่อยู่เว็บ (URL Bar) และเลือก "อนุญาต" ตำแหน่ง (Location) จากนั้นลองกดรีเซ็ตอีกครั้ง';
        }
        Swal.fire({
            icon: 'warning',
            title: 'เชื่อมต่อ GPS ไม่สำเร็จ',
            text: errMsg,
            confirmButtonText: 'รับทราบ',
            confirmButtonColor: '#3b82f6'
        });
    }, { enableHighAccuracy: true, timeout: 10000 });
}

function updateUserInfo() {
    document.getElementById('user-display').innerText = currentUser.name;
    document.getElementById('profile-display-name').innerText = currentUser.name;
    document.getElementById('profile-email').innerText = currentUser.email || '-';
    document.getElementById('profile-user-code').innerText = currentUser.user_code || '------';
    updateGpsStatus();
}

function updateCounter() {
    const catJobs = dbJobs.filter(j => j.category === currentUser.category);
    const doneCount = catJobs.filter(j => j.status === 'done').length;
    document.getElementById('job-counter').innerText = `${doneCount}/${catJobs.length}`;
}

function toggleGPSFollow(state) {
    isFollowing = (state !== undefined) ? state : !isFollowing;
    const btn = document.getElementById('btn-gps');
    if (isFollowing) {
        btn.classList.add('active-gps');
        if (userMarker) {
            map.setView(userMarker.getLatLng(), 18);
            Swal.fire({ toast: true, position: 'top', icon: 'info', title: 'ติดตามตำแหน่ง', timer: 1000, showConfirmButton: false });
        } else {
            Swal.fire('รอ GPS...', '', 'info');
        }
    } else {
        btn.classList.remove('active-gps');
    }
}

function getFilteredJobs() {
    const search = document.getElementById('inp-search').value.toLowerCase().trim();
    const amphoe = document.getElementById('sel-amphoe').value;
    const tambon = document.getElementById('sel-tambon').value;

    return dbJobs.filter(j => {
        const matchCat = j.category === currentUser.category;
        const p = j.properties || {};
        const txt = search;

        let matchS = txt === "";

        if (!matchS) {
            // =========================================================
            // 🎯 กำหนดจุดค้นหาตรงนี้ (ผมแยกตัวแปรมาให้ดูและแก้ง่ายๆ ครับ)
            // =========================================================

            // 1. ค้นหาจาก ไอดี / ชื่อแปลง (หมวด 0)
            const findName = (p.name || "").toString().toLowerCase().includes(txt);

            // 2. ค้นหาจาก ช่องเชื่อมโยงค้นหา (หมวด 1)
            const findSearchField = (p.search_field || "").toString().toLowerCase().includes(txt);

            // 3. ค้นหาจาก หมายเหตุ (note)
            const findNote = (p.note || "").toString().toLowerCase().includes(txt);

            // ถ้าเจอคำค้นหาในช่องใดช่องหนึ่ง ให้ถือว่าค้นหาเจอ 
            // (ถ้าคุณไม่อยากให้หาในหมายเหตุ ให้ลบ || findNote ออกได้เลยครับ)
            if (findName || findSearchField || findNote) {
                matchS = true;
            }
        }

        const valA = (p.amphoe || p.AMPH_NAME || p.AMPHOE || p.district || "").toString().trim();
        const valT = (p.tambon || p.TUMB_NAME || p.TAMBON || p.subdistrict || "").toString().trim();
        const matchA = amphoe === "" || valA === amphoe;
        const matchT = tambon === "" || valT === tambon;

        return matchCat && matchS && matchA && matchT;
    });
}

function renderMap(fitBounds = false) {
    markersGroup.clearLayers();
    const filtered = getFilteredJobs();
    const group = L.featureGroup();
    filtered.slice(0, 1500).forEach(job => {
        let layer;
        let color = job.status === 'done' ? '#10b981' : (job.status === 'navigating' ? '#f97316' : '#ef4444');
        let fill = job.status === 'done' ? 0.4 : 0.2;
        if (viewMode === 'original' && job.geometry && (job.geometry.type.includes('Polygon'))) {
            layer = L.geoJSON(job.geometry, { style: { color: color, weight: 2, fillOpacity: fill, className: job.status === 'navigating' ? 'job-navigating-pulse' : '' } });
        } else {
            let iconUrl = job.status === 'done'
                ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png'
                : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';
            let mClassName = '';
            if (job.status === 'navigating') {
                iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png';
                mClassName = 'job-navigating-pulse';
            }
            layer = L.marker([job.lat, job.lng], {
                icon: L.icon({ iconUrl, iconSize: [25, 41], iconAnchor: [12, 41], className: mClassName })
            });
        }
        if (layer) {
            layer.jobId = job.id;
            if (isNavigating && job.id !== selectedJobId) {
                layer.on('add', () => {
                    if (typeof layer.getElement === 'function') {
                        layer.getElement()?.classList.add('dimmed-layer');
                    } else if (typeof layer.setStyle === 'function') {
                        layer.setStyle({ opacity: 0.15, fillOpacity: 0.05 });
                    } else if (typeof layer.eachLayer === 'function') {
                        layer.eachLayer(sub => {
                            if (typeof sub.getElement === 'function') {
                                sub.getElement()?.classList.add('dimmed-layer');
                            } else if (typeof sub.setStyle === 'function') {
                                sub.setStyle({ opacity: 0.15, fillOpacity: 0.05 });
                            }
                        });
                    }
                });
            }

            // Bind Tooltip Label according to navigation state
            let labelClass = 'job-label';
            if (job.status === 'done') {
                labelClass += ' job-label-done';
            } else if (job.id === selectedJobId && isNavigating) {
                labelClass += ' job-label-navigating';
            } else {
                labelClass += ' job-label-pending';
            }

            if ((isNavigating && job.id === selectedJobId) || (!isNavigating && showPinLabels)) {
                layer.bindTooltip(job.properties.name || 'ไม่มีชื่อ', {
                    permanent: true,
                    direction: 'top',
                    className: labelClass,
                    offset: [0, -10]
                });
            }

            layer.on('click', () => { markerJustClicked = true; openSheet(job); });
            markersGroup.addLayer(layer);
            group.addLayer(layer);
        }
    });
    if (fitBounds && filtered.length > 0) {
        try {
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        } catch (e) { }
    }
    updateCounter();
}

function speak(text) {
    if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'th-TH';
        speechSynth.speak(u);
    }
}

async function startNav() {
    if (!userMarker) return Swal.fire('GPS ไม่พร้อม', '', 'warning');
    const job = dbJobs.find(j => j.id === selectedJobId);
    if (!job) return;

    // ตรวจสอบคิวความขัดแย้งการล๊อกเป้าหมายชนกัน (Concurrency lock check)
    if (supabaseClient && currentUser) {
        showLoading(true, 'กำลังตรวจสอบคิวการเดินทาง...');
        try {
            const { data, error } = await supabaseClient
                .from('jobs')
                .select('status, properties')
                .eq('id', job.id)
                .maybeSingle();

            if (!error && data) {
                const dbStatus = data.status;
                const dbProps = data.properties || {};
                if (dbStatus === 'navigating' && dbProps.navigator_id && dbProps.navigator_id !== currentUser.id) {
                    showLoading(false);
                    Swal.fire({
                        title: 'มีเพื่อนร่วมทีมกำลังเดินทางแล้ว',
                        text: `${dbProps.navigator_name || 'เพื่อนร่วมทีม'} ได้สิทธิ์เดินทางไปที่แปลงนี้ก่อนหน้าคุณแล้ว`,
                        icon: 'warning',
                        confirmButtonText: 'ตกลง'
                    });
                    // ปิดหน้าต่างและซิงค์ใหม่
                    closeSheet();
                    await syncJobsSilently();
                    return;
                }
            }
        } catch (err) {
            console.error("Concurrent navigation check failed", err);
        } finally {
            showLoading(false);
        }
    }

    viewMode = 'pin';
    document.getElementById('btn-view').innerHTML = '<i class="fa-solid fa-map-pin"></i>';

    isNavigating = true;
    job.prevStatus = job.status;
    job.status = 'navigating';
    if (!job.properties) job.properties = {};
    job.properties.navigator_id = currentUser.id;
    job.properties.navigator_name = currentUser.name;

    try {
        await saveJobToSupabase(job);
    } catch (e) {
        console.error("Failed to save navigation state to Supabase", e);
    }

    renderMap();
    map.fitBounds(L.latLngBounds([userMarker.getLatLng(), [job.lat, job.lng]]), { padding: [100, 100] });

    document.getElementById('btn-nav-start').classList.add('hidden');
    document.getElementById('btn-nav-cancel').classList.remove('hidden');
    document.getElementById('sheet').classList.add('minimized');

    if (routingControl) {
        try { map.removeControl(routingControl); } catch (e) { }
    }
    try {
        routingControl = L.Routing.control({
            waypoints: [userMarker.getLatLng(), L.latLng(job.lat, job.lng)],
            createMarker: () => null,
            lineOptions: { styles: [{ color: '#2563eb', weight: 6, opacity: 0.9 }] },
            show: false,
            addWaypoints: false
        }).addTo(map);
        speak("เริ่มการนำทาง");

        if (navInterval) clearInterval(navInterval);
        navInterval = setInterval(async () => {
            if (!userMarker) return;
            const d = map.distance(userMarker.getLatLng(), [job.lat, job.lng]);

            // Auto-switch to parcel boundaries (original view mode) if within 500 meters
            if (d < 500 && viewMode !== 'original') {
                viewMode = 'original';
                document.getElementById('btn-view').innerHTML = '<i class="fa-solid fa-map-pin"></i>';
                renderMap();
                speak("เข้าสู่ระยะห้าร้อยเมตร แสดงขอบเขตแปลงสำรวจอัตโนมัติ");
            }

            if (d < 100) {
                speak("ถึงที่หมายแล้ว");
                await stopNav();
                document.getElementById('sheet').classList.remove('minimized');
                document.getElementById('sheet').classList.add('active');
                Swal.fire({ toast: true, icon: 'success', title: 'ถึงแล้ว!', text: 'กรอกข้อมูลได้เลย', timer: 2000, showConfirmButton: false });
            }
        }, 3000);
    } catch (e) { }
}

async function stopNav() {
    isNavigating = false;
    if (routingControl) {
        try { map.removeControl(routingControl); } catch (e) { }
    }
    routingControl = null;
    if (navInterval) clearInterval(navInterval);
    document.getElementById('btn-nav-start').classList.remove('hidden');
    document.getElementById('btn-nav-cancel').classList.add('hidden');
    const job = dbJobs.find(j => j.id === selectedJobId);
    if (job) {
        job.status = job.prevStatus || 'waiting';
        if (!job.properties) job.properties = {};
        job.properties.navigator_id = null;
        job.properties.navigator_name = null;
        try {
            await saveJobToSupabase(job);
        } catch (e) {
            console.error("Failed to save stop navigation state to Supabase", e);
        }
    }
    renderMap();
}

function openSheet(job) {
    selectedJobId = job.id;
    const p = job.properties;
    document.getElementById('sheet-title').innerText = p.name || 'รายละเอียด';
    document.getElementById('sheet-meta').innerText = `${p.amphoe || p.AMPH_NAME || '-'} / ${p.tambon || p.TUMB_NAME || '-'}`;
    document.getElementById('sheet-name').value = p.name || '';
    document.getElementById('sheet-note').value = p.note || '';

    if (document.getElementById('sheet-area')) {
        document.getElementById('sheet-area').value = p.area || '-';
    }
    if (document.getElementById('sheet-source')) {
        document.getElementById('sheet-source').value = p.import_source || '-';
    }

    const btnSave = document.getElementById('btn-save');
    const btnEdit = document.getElementById('btn-edit');
    const btnNavStart = document.getElementById('btn-nav-start');
    const btnNavCancel = document.getElementById('btn-nav-cancel');
    const btnDelete = document.getElementById('btn-delete-job');
    const navWarning = document.getElementById('sheet-nav-warning');
    const navWarningText = document.getElementById('sheet-nav-warning-text');

    const isNavByOther = job.status === 'navigating' && p.navigator_id && p.navigator_id !== currentUser.id;
    const isDone = job.status === 'done';

    if (isNavByOther) {
        // Locked by another user
        if (navWarning && navWarningText) {
            navWarningText.innerText = `🔴 ${p.navigator_name || 'เพื่อนร่วมทีม'} กำลังนำทางไปยังแปลงนี้ (ไม่อนุญาตให้แก้ไข/เลือก)`;
            navWarning.classList.remove('hidden');
        }
        btnNavStart.classList.add('hidden');
        btnNavCancel.classList.add('hidden');
        btnSave.classList.add('hidden');
        btnEdit.classList.add('hidden');
        if (btnDelete) btnDelete.classList.add('hidden');
        toggleInputs(false);
        renderImageGallery(p.images || [], false);
    } else {
        // Not locked by others
        if (navWarning) navWarning.classList.add('hidden');

        // Hide delete button if it's not done (i.e. waiting/navigating)
        if (btnDelete) {
            if (isDone) btnDelete.classList.remove('hidden');
            else btnDelete.classList.add('hidden');
        }

        if (isDone) {
            btnSave.classList.add('hidden');
            btnEdit.classList.remove('hidden');
            btnNavStart.classList.add('hidden');
            btnNavCancel.classList.add('hidden');
            toggleInputs(false);
            renderImageGallery(p.images || [], false);
        } else {
            btnSave.classList.remove('hidden');
            btnEdit.classList.add('hidden');

            const isNavByMe = isNavigating && job.id === selectedJobId;
            if (isNavByMe) {
                btnNavStart.classList.add('hidden');
                btnNavCancel.classList.remove('hidden');
            } else {
                btnNavStart.classList.remove('hidden');
                btnNavCancel.classList.add('hidden');
            }

            toggleInputs(true);
            renderImageGallery(p.images || [], true);
        }
    }

    document.getElementById('fab-container').classList.add('sheet-open');
    document.getElementById('sheet').classList.remove('minimized');
    document.getElementById('sheet').classList.add('active');

    if (!isNavigating) map.flyTo([job.lat, job.lng], 16);
}

function toggleInputs(enabled) {
    document.getElementById('sheet-name').disabled = !enabled;
    document.getElementById('sheet-note').disabled = !enabled;

    const btnCamera = document.getElementById('btn-camera');
    if (btnCamera) btnCamera.disabled = !enabled;
}

function openSheetSilently(job) {
    const p = job.properties;
    document.getElementById('sheet-title').innerText = p.name || 'รายละเอียด';
    document.getElementById('sheet-meta').innerText = `${p.amphoe || p.AMPH_NAME || '-'} / ${p.tambon || p.TUMB_NAME || '-'}`;

    const nameEl = document.getElementById('sheet-name');
    const noteEl = document.getElementById('sheet-note');
    if (document.activeElement !== nameEl) nameEl.value = p.name || '';
    if (document.activeElement !== noteEl) noteEl.value = p.note || '';

    if (document.getElementById('sheet-area')) {
        document.getElementById('sheet-area').value = p.area || '-';
    }

    const btnSave = document.getElementById('btn-save');
    const btnEdit = document.getElementById('btn-edit');
    const btnNavStart = document.getElementById('btn-nav-start');
    const btnNavCancel = document.getElementById('btn-nav-cancel');
    const btnDelete = document.getElementById('btn-delete-job');
    const navWarning = document.getElementById('sheet-nav-warning');
    const navWarningText = document.getElementById('sheet-nav-warning-text');

    const isNavByOther = job.status === 'navigating' && p.navigator_id && p.navigator_id !== currentUser.id;
    const isDone = job.status === 'done';

    if (isNavByOther) {
        if (navWarning && navWarningText) {
            navWarningText.innerText = `🔴 ${p.navigator_name || 'เพื่อนร่วมทีม'} กำลังนำทางไปยังแปลงนี้ (ไม่อนุญาตให้แก้ไข/เลือก)`;
            navWarning.classList.remove('hidden');
        }
        btnNavStart.classList.add('hidden');
        btnNavCancel.classList.add('hidden');
        btnSave.classList.add('hidden');
        btnEdit.classList.add('hidden');
        if (btnDelete) btnDelete.classList.add('hidden');
        toggleInputs(false);
        renderImageGallery(p.images || [], false);
    } else {
        if (navWarning) navWarning.classList.add('hidden');
        if (btnDelete) btnDelete.classList.remove('hidden');

        if (isDone) {
            btnSave.classList.add('hidden');
            btnEdit.classList.remove('hidden');
            btnNavStart.classList.add('hidden');
            btnNavCancel.classList.add('hidden');
            toggleInputs(false);
            renderImageGallery(p.images || [], false);
        } else {
            btnSave.classList.remove('hidden');
            btnEdit.classList.add('hidden');

            const isNavByMe = isNavigating && job.id === selectedJobId;
            if (isNavByMe) {
                btnNavStart.classList.add('hidden');
                btnNavCancel.classList.remove('hidden');
            } else {
                btnNavStart.classList.remove('hidden');
                btnNavCancel.classList.add('hidden');
            }

            toggleInputs(true);
            renderImageGallery(p.images || [], true);
        }
    }
}

function enableEdit() {
    toggleInputs(true);
    document.getElementById('btn-save').classList.remove('hidden');
    document.getElementById('btn-edit').classList.add('hidden');

    const job = dbJobs.find(j => j.id === selectedJobId);
    if (job) {
        const images = job.properties.images || [];
        renderImageGallery(images, true);
    }
}

function closeSheet(e) {
    if (e) e.stopPropagation();
    document.getElementById('sheet').classList.remove('active');
    document.getElementById('sheet').classList.remove('minimized');
    document.getElementById('fab-container').classList.remove('sheet-open');
    if (isNavigating) stopNav();
    selectedJobId = null;
}

function toggleSheetSize() {
    document.getElementById('sheet').classList.toggle('minimized');
}

function findNearestNewJob() {
    if (!userMarker) return Swal.fire('รอ GPS', '', 'info');
    const filteredJobs = getFilteredJobs().filter(j => j.status !== 'done' && j.status !== 'navigating');
    if (filteredJobs.length === 0) return Swal.fire('ยอดเยี่ยม', 'ไม่มีงานค้างในพื้นที่นี้', 'success');
    let min = Infinity, near = null;
    const u = userMarker.getLatLng();
    filteredJobs.forEach(j => {
        const d = map.distance(u, [j.lat, j.lng]);
        if (d < min) { min = d; near = j; }
    });
    if (near) {
        openSheet(near);
        document.getElementById('sheet').classList.add('minimized');
        map.fitBounds(L.latLngBounds([u, [near.lat, near.lng]]), { padding: [80, 80] });
        Swal.fire({ toast: true, icon: 'success', title: 'งานถัดไป', text: Math.round(min) + ' ม.', timer: 1500, showConfirmButton: false });
    }
}

function viewJsonData() {
    const job = dbJobs.find(j => j.id === selectedJobId);
    if (!job) return;

    const sheet = document.getElementById('sheet');
    const fabContainer = document.getElementById('fab-container');
    const wasMinimized = sheet.classList.contains('minimized');
    const wasActive = sheet.classList.contains('active');

    // Slide details sheet out of view completely & lower z-index so it doesn't overlay Swal modal
    sheet.classList.remove('active');
    sheet.style.zIndex = '1000';
    if (fabContainer) fabContainer.classList.remove('sheet-open');

    let html = '<div class="text-left text-xs max-h-[60vh] overflow-y-auto"><table class="w-full border-collapse border border-gray-200 rounded-xl overflow-hidden">';
    const sortedKeys = Object.keys(job.properties).sort();
    sortedKeys.forEach(k => {
        if (k !== 'images' && k !== 'name' && k !== 'note' && k !== 'date' && k !== 'search_field' && k !== 'amphoe' && k !== 'tambon' && k !== 'area') {
            const val = typeof job.properties[k] === 'object' ? JSON.stringify(job.properties[k]) : job.properties[k];
            html += `
                        <tr class="border-b border-gray-150 hover:bg-gray-50">
                            <td class="font-bold p-2.5 text-gray-500 bg-gray-100/50 w-1/3 border-r border-gray-150">${k}</td>
                            <td class="p-2.5 text-gray-800 break-all">${val !== undefined && val !== null ? val : '-'}</td>
                        </tr>
                    `;
        }
    });
    html += '</table></div>';

    Swal.fire({
        title: 'ข้อมูลต้นฉบับ (ทั้งหมด)',
        html: html,
        width: '90%',
        confirmButtonText: 'ปิด',
        confirmButtonColor: '#4b5563',
        allowOutsideClick: false
    }).then(() => {
        // Restore sheet state and default z-index
        sheet.style.zIndex = '';
        if (wasActive) {
            sheet.classList.add('active');
            if (fabContainer) fabContainer.classList.add('sheet-open');
        }
        if (wasMinimized) {
            sheet.classList.add('minimized');
        } else {
            sheet.classList.remove('minimized');
        }
    });
}

let tempImportFeatures = [];
let onConfirmImportCallback = null;

function showFieldMapping(feats, onConfirm) {
    closeSettingsModal();
    tempImportFeatures = feats;
    onConfirmImportCallback = onConfirm;

    // Extract all keys
    const allKeys = new Set();
    feats.forEach(f => {
        const p = f.properties || f;
        Object.keys(p).forEach(k => {
            if (typeof p[k] !== 'object') allKeys.add(k);
        });
    });
    const keysArray = Array.from(allKeys).sort();

    const fields = ['id', 'search', 'amphoe', 'tambon', 'area'];
    fields.forEach(f => {
        const select = document.getElementById(`map-field-${f}`);
        if (select) {
            select.innerHTML = '<option value="">-- ไม่ระบุ (ข้าม) --</option>';
            keysArray.forEach(k => {
                select.innerHTML += `<option value="${k}">${k}</option>`;
            });
        }
    });

    // Set default selections
    const idSel = document.getElementById('map-field-id');
    const searchSel = document.getElementById('map-field-search');
    const amphoeSel = document.getElementById('map-field-amphoe');
    const tambonSel = document.getElementById('map-field-tambon');
    const areaSel = document.getElementById('map-field-area');

    // Reset values first
    if (idSel) idSel.value = "";
    if (searchSel) searchSel.value = "";
    if (amphoeSel) amphoeSel.value = "";
    if (tambonSel) tambonSel.value = "";
    if (areaSel) areaSel.value = "";

    // Auto-detect best match
    keysArray.forEach(k => {
        const lower = k.toLowerCase();
        if (idSel && !idSel.value && (lower.includes('id') || lower.includes('reg') || lower.includes('name') || lower.includes('ทะเบียน'))) {
            idSel.value = k;
        }
        if (searchSel && !searchSel.value && (lower.includes('name') || lower.includes('desc') || lower.includes('remark') || lower.includes('ชื่อ') || lower.includes('หมายเหตุ'))) {
            searchSel.value = k;
        }
        if (amphoeSel && !amphoeSel.value && (lower.includes('amphoe') || lower.includes('amp') || lower.includes('อ.') || lower.includes('อำเภอ'))) {
            amphoeSel.value = k;
        }
        if (tambonSel && !tambonSel.value && (lower.includes('tambon') || lower.includes('tum') || lower.includes('ต.') || lower.includes('ตำบล'))) {
            tambonSel.value = k;
        }
        if (areaSel && !areaSel.value && (lower.includes('area') || lower.includes('size') || lower.includes('rai') || lower.includes('เนื้อที่'))) {
            areaSel.value = k;
        }
    });

    // Show modal
    document.getElementById('import-mapping-modal').classList.remove('hidden');
}

function closeImportMappingModal() {
    document.getElementById('import-mapping-modal').classList.add('hidden');
    tempImportFeatures = [];
    onConfirmImportCallback = null;
}

// Set up Event Listener for Confirm Import
if (document.getElementById('btn-confirm-import')) {
    document.getElementById('btn-confirm-import').onclick = async () => {
        const mappedId = document.getElementById('map-field-id').value;
        const mappedSearch = document.getElementById('map-field-search').value;
        const mappedAmphoe = document.getElementById('map-field-amphoe').value;
        const mappedTambon = document.getElementById('map-field-tambon').value;
        const mappedArea = document.getElementById('map-field-area').value;

        document.getElementById('import-mapping-modal').classList.add('hidden');

        if (onConfirmImportCallback) {
            await onConfirmImportCallback({
                idKey: mappedId,
                searchKey: mappedSearch,
                amphoeKey: mappedAmphoe,
                tambonKey: mappedTambon,
                areaKey: mappedArea
            });
        }
    };
}

async function importData(input) {
    const f = input.files[0];
    if (!f) return;
    showLoading(true, 'กำลังอ่านไฟล์และนำเข้า...');
    const r = new FileReader();
    r.onload = async (e) => {
        try {
            let raw = e.target.result.trim();
            if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
            const json = JSON.parse(raw);
            let feats = (json.type === "FeatureCollection") ? json.features : (Array.isArray(json) ? json : [json]);

            showLoading(false);
            showFieldMapping(feats, async (mapping) => {
                showLoading(true, `กำลังเขียน ${feats.length} รายการลงคลาวด์ Supabase...`);
                let count = 0;
                for (let f of feats) {
                    const p = f.properties || f;
                    let geom = f.geometry;
                    if (!geom && (f.lat || p.lat)) geom = { type: 'Point', coordinates: [parseFloat(f.lng || p.lng), parseFloat(f.lat || p.lat)] };
                    if (!geom) continue;
                    let lat, lng;
                    if (geom.type === 'Point') {
                        lng = geom.coordinates[0];
                        lat = geom.coordinates[1];
                    } else {
                        try {
                            const l = L.geoJSON(geom);
                            const c = l.getBounds().getCenter();
                            lat = c.lat;
                            lng = c.lng;
                        } catch (err) {
                            continue;
                        }
                    }

                    const idRaw = mapping.idKey && p[mapping.idKey] !== undefined && p[mapping.idKey] !== null ? p[mapping.idKey] : '';
                    const idValue = idRaw.toString().trim();
                    const nameVal = idValue || 'นำเข้า';
                    const searchVal = mapping.searchKey && p[mapping.searchKey] !== undefined && p[mapping.searchKey] !== null ? p[mapping.searchKey].toString().trim() : '';
                    const amphoeVal = mapping.amphoeKey && p[mapping.amphoeKey] !== undefined && p[mapping.amphoeKey] !== null ? p[mapping.amphoeKey].toString().trim() : '';
                    const tambonVal = mapping.tambonKey && p[mapping.tambonKey] !== undefined && p[mapping.tambonKey] !== null ? p[mapping.tambonKey].toString().trim() : '';
                    const areaVal = mapping.areaKey && p[mapping.areaKey] !== undefined && p[mapping.areaKey] !== null ? p[mapping.areaKey].toString().trim() : '';

                    // Check duplicate first to keep status/notes/photos if already exists
                    const finalId = idValue || 'IMP-' + Math.random().toString(36).substr(2, 9);
                    const existing = dbJobs.find(x => x.id === finalId);
                    const job = {
                        id: finalId,
                        lat,
                        lng,
                        geometry: geom,
                        status: existing ? existing.status : 'waiting',
                        category: currentUser.category,
                        properties: {
                            ...p,
                            name: nameVal,
                            import_source: f.name || 'อัปโหลดไฟล์',
                            note: existing ? existing.properties.note : (p.REMARK || p.note || ''),
                            images: existing ? existing.properties.images : [],
                            search_field: searchVal,
                            amphoe: amphoeVal,
                            tambon: tambonVal,
                            area: areaVal
                        }
                    };
                    await saveJobToSupabase(job);
                    count++;
                }
                Swal.fire('สำเร็จ', `นำเข้าแปลงที่ดินสำเร็จ ${count} รายการ`, 'success');
                await syncJobsFromDB();
            });
        } catch (err) {
            Swal.fire('เกิดข้อผิดพลาดในการโหลดไฟล์', err.message, 'error');
        } finally {
            showLoading(false);
        }
    };
    r.readAsText(f);
    input.value = '';
}

async function saveData() {
    const job = dbJobs.find(j => j.id === selectedJobId);
    if (!job) return;

    if (isNavigating) await stopNav();

    showLoading(true, 'กำลังอัปโหลดรูปภาพและบันทึกข้อมูล...');
    try {
        // --- ส่วนที่ 1: ตรวจสอบและอัปโหลดรูปภาพใหม่ (ที่มีสถานะ isTemp) ---
        if (job.properties.images && job.properties.images.length > 0) {
            for (let i = 0; i < job.properties.images.length; i++) {
                let img = job.properties.images[i];

                if (img.isTemp && img.file) {
                    const formData = new FormData();
                    formData.append('file', img.file);
                    formData.append('upload_preset', cloudinaryUploadPreset);

                    const url = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`;
                    const res = await fetch(url, { method: 'POST', body: formData });

                    if (!res.ok) throw new Error('อัปโหลดภาพไปยังคลาวด์ล้มเหลว');

                    const data = await res.json();

                    // เปลี่ยนจากรูปชั่วคราว ให้เป็นรูปจริงที่มีลิงก์จาก Cloudinary
                    job.properties.images[i] = {
                        url: data.secure_url,
                        public_id: data.public_id,
                        delete_token: data.delete_token,
                        uploadedAt: Date.now()
                    };
                }
            }
        }

        // --- ส่วนที่ 2: บันทึกข้อมูลข้อความลงฐานข้อมูล Supabase ---
        job.status = 'done';
        job.properties.name = document.getElementById('sheet-name').value;
        job.properties.note = document.getElementById('sheet-note').value;
        job.properties.date = new Date().toISOString().split('T')[0];
        job.properties.navigator_id = null;
        job.properties.navigator_name = null;

        await saveJobToSupabase(job);

        renderMap();
        closeSheet();
        Swal.fire({ toast: true, icon: 'success', title: 'บันทึกข้อมูลเรียบร้อย', timer: 1500, showConfirmButton: false });
    } catch (e) {
        console.error("Save Data Error:", e);
        Swal.fire('บันทึกล้มเหลว', e.message, 'error');
    } finally {
        showLoading(false);
    }
}

function deleteJob() {
    const job = dbJobs.find(x => x.id === selectedJobId);
    if (!job) return;

    const hasImages = job.properties && job.properties.images && job.properties.images.length > 0;

    let htmlContent = `
                <div class="text-sm text-gray-600 text-left space-y-2">
                    <p>ระบบจะลบผลการสำรวจ (หมายเหตุ, รูปถ่าย, วันที่) และคืนค่าสถานะแปลงนี้ให้เป็น <b>"รอการตรวจสอบ"</b></p>
                    <p class="text-red-500 font-bold">* แปลงที่ดินจะยังคงแสดงอยู่บนแผนที่ตามปกติ</p>
            `;

    if (hasImages) {
        htmlContent += `
                    <div class="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2">
                        <input type="checkbox" id="swal-delete-cloud-images" class="w-4 h-4 rounded text-red-650 focus:ring-red-500 cursor-pointer">
                        <label for="swal-delete-cloud-images" class="text-xs font-bold text-gray-700 cursor-pointer select-none">
                            ลบรูปภาพทั้งหมด (${job.properties.images.length} รูป) ออกจาก Cloudinary ด้วย
                        </label>
                    </div>
                `;
    }

    htmlContent += `</div>`;

    Swal.fire({
        title: 'ลบข้อมูลการสำรวจ?',
        html: htmlContent,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ยืนยันการลบข้อมูลสำรวจ',
        cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
            const chk = document.getElementById('swal-delete-cloud-images');
            return {
                deleteFromCloud: chk ? chk.checked : false
            };
        }
    }).then(async (r) => {
        if (r.isConfirmed) {
            const deleteFromCloud = r.value.deleteFromCloud;
            showLoading(true, 'กำลังลบผลการสำรวจ...');
            try {
                // 1. If checked, delete images from Cloudinary
                if (deleteFromCloud && hasImages) {
                    const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxYmkufBM6TGiY0TwSqI-Eq6RrTZBevQZqaBbs9IPZsAyBypBFXfvsXojkeVKcaoskb/exec";
                    for (const img of job.properties.images) {
                        if (img.public_id) {
                            try {
                                await fetch(GAS_WEBAPP_URL, {
                                    method: 'POST',
                                    body: JSON.stringify({ publicId: img.public_id })
                                });
                            } catch (err) {
                                console.error("GAS Cloudinary loop delete failed", err);
                            }
                        }
                    }
                }

                // 2. Clear survey properties and reset status to 'waiting'
                job.status = 'waiting';
                job.properties.note = '';
                job.properties.date = '';
                job.properties.images = [];

                // 3. Save to Supabase
                await saveJobToSupabase(job);

                renderMap();
                closeSheet();
                Swal.fire({ toast: true, icon: 'success', title: 'ลบผลการสำรวจและคืนค่าสถานะแล้ว', timer: 1500, showConfirmButton: false });
            } catch (e) {
                Swal.fire('ทำรายการไม่สำเร็จ', e.message, 'error');
            } finally {
                showLoading(false);
            }
        }
    });
}

function navGoogle() {
    const j = dbJobs.find(x => x.id === selectedJobId);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${j.lat},${j.lng}`, '_blank');
}

function updateAmphoeDropdown() {
    const s = new Set();
    dbJobs.filter(j => j.category === currentUser.category).forEach(j => {
        const p = j.properties || {};
        const a = (p.amphoe || p.AMPH_NAME || p.AMPHOE || p.district || "").toString().trim();
        if (a) s.add(a);
    });
    const el = document.getElementById('sel-amphoe');
    el.innerHTML = '<option value="">อ.ทั้งหมด</option>';
    Array.from(s).sort().forEach(a => el.innerHTML += `<option value="${a}">${a}</option>`);
    document.getElementById('sel-tambon').innerHTML = '<option value="">ต.ทั้งหมด</option>';
}

function onAmphoeChange() {
    const v = document.getElementById('sel-amphoe').value;
    const s = new Set();
    dbJobs.filter(j => {
        const p = j.properties || {};
        const a = (p.amphoe || p.AMPH_NAME || p.AMPHOE || p.district || "").toString().trim();
        return j.category === currentUser.category && a === v;
    }).forEach(j => {
        const p = j.properties || {};
        const t = (p.tambon || p.TUMB_NAME || p.TAMBON || p.subdistrict || "").toString().trim();
        if (t) s.add(t);
    });
    const el = document.getElementById('sel-tambon');
    el.innerHTML = '<option value="">ต.ทั้งหมด</option>';
    Array.from(s).sort().forEach(t => el.innerHTML += `<option value="${t}">${t}</option>`);
    renderMap(true);
}

function filterMap() { renderMap(true); }

function toggleViewMode() {
    viewMode = viewMode === 'original' ? 'pin' : 'original';
    document.getElementById('btn-view').innerHTML = viewMode === 'pin'
        ? '<i class="fa-solid fa-map-pin"></i>'
        : '<i class="fa-solid fa-draw-polygon"></i>';
    renderMap();
}

function toggleBaseMap() {
    map.removeLayer(maps[currentBaseMap]);
    currentBaseMap = currentBaseMap === 'hybrid' ? 'street' : 'hybrid';
    map.addLayer(maps[currentBaseMap]);
}

// --- Premium Settings Modal Logic ---
function openToolsMenu() {
    const modal = document.getElementById('custom-settings-modal');
    modal.classList.add('active');

    switchSettingsTab('profile');
}

function closeSettingsModal(e) {
    const modal = document.getElementById('custom-settings-modal');
    modal.classList.remove('active');
}

let activeSettingsTab = 'profile';
function switchSettingsTab(tab) {
    activeSettingsTab = tab;
    const tabs = ['profile', 'geojson'];
    tabs.forEach(t => {
        const btn = document.getElementById(`stab-${t}`);
        const content = document.getElementById(`scontent-${t}`);
        if (t === tab) {
            btn.classList.add('active');
            content.classList.remove('hidden');
        } else {
            btn.classList.remove('active');
            content.classList.add('hidden');
        }
    });

    if (tab === 'profile') {
        loadTeamMembers();
    }
}

function copyUserCode() {
    const code = document.getElementById('profile-user-code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'คัดลอกรหัสเข้าคลิปบอร์ดแล้ว', timer: 1500, showConfirmButton: false });
    });
}

// --- Team Collaboration Logic ---
async function loadTeamMembers() {
    if (!supabaseClient || !currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id, email, display_name, user_code')
            .eq('team_id', currentUser.team_id);

        if (error) throw error;

        const listEl = document.getElementById('team-members-list');
        listEl.innerHTML = '';

        data.forEach(m => {
            const isSelf = m.id === currentUser.id;
            const isOwner = currentUser.team_id === currentUser.id;

            let actionBtn = '';
            if (isSelf) {
                actionBtn = `<span class="text-[9px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">คุณ (หัวหน้า)</span>`;
                if (currentUser.team_id !== currentUser.id) {
                    actionBtn = `<span class="text-[9px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold">คุณ</span>`;
                }
            } else if (isOwner) {
                actionBtn = `<button onclick="removeTeamMember('${m.id}')" class="text-[10px] text-red-500 hover:text-red-700 font-bold"><i class="fa-solid fa-user-minus"></i> ลบ</button>`;
            }

            listEl.innerHTML += `
                        <div class="flex items-center justify-between p-2 border border-gray-100 rounded-xl bg-gray-50/50">
                            <div>
                                <div class="text-xs font-bold text-gray-850">${m.display_name || 'ผู้ใช้ร่วมกัน'}</div>
                                <div class="text-[10px] text-gray-400">${m.email} (${m.user_code})</div>
                            </div>
                            <div class="flex items-center gap-1">${actionBtn}</div>
                        </div>`;
        });

        if (data.length <= 1) {
            listEl.innerHTML += `<div class="text-[11px] text-gray-400 text-center py-3">ยังไม่มีสมาชิกอื่นในทีมสำรวจนี้</div>`;
        }
    } catch (e) {
        console.error("Load team members error", e);
    }
}

async function addTeamMemberByCode() {
    const code = document.getElementById('inp-add-member-code').value.trim();
    if (!code) return Swal.fire('กรุณาระบุรหัส', 'ใส่รหัสของสมาชิกที่ต้องการร่วมสำรวจด้วยกัน', 'warning');
    if (code === currentUser.user_code) return Swal.fire('ผิดพลาด', 'คุณไม่สามารถเพิ่มตัวคุณเองได้', 'warning');

    showLoading(true, 'กำลังหาข้อมูลสมาชิก...');
    try {
        // ค้นหาผู้ใช้อื่นที่มี user_code นี้
        const { data: member, error: findErr } = await supabaseClient
            .from('profiles')
            .select('id, display_name')
            .eq('user_code', code)
            .single();

        if (findErr || !member) {
            throw new Error('ไม่พบข้อมูลรหัสสมาชิกนี้ กรุณาตรวจสอบรหัสของเพื่อนคุณอีกครั้ง');
        }

        // อัปเดต team_id ของเขาให้มาเป็นทีมเรา
        const { error: updErr } = await supabaseClient
            .from('profiles')
            .update({ team_id: currentUser.team_id })
            .eq('id', member.id);

        if (updErr) throw updErr;

        document.getElementById('inp-add-member-code').value = '';
        Swal.fire('สำเร็จ', `เพิ่มคุณ ${member.display_name} เข้าทีมสำรวจร่วมกันแล้ว`, 'success');
        await loadTeamMembers();
    } catch (e) {
        Swal.fire('ล้มเหลว', e.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function leaveTeam() {
    if (currentUser.team_id === currentUser.id) {
        return Swal.fire('แจ้งเตือน', 'คุณกำลังทำงานคนเดียว (เป็นหัวหน้าทีมของตัวเอง)', 'info');
    }

    Swal.fire({
        title: 'ออกจากทีมสำรวจ?',
        text: 'คุณจะไม่เห็นจุดบนแผนที่ของทีมนี้ และระบบจะรีเซ็ตห้องทำงานส่วนตัวให้คุณใหม่',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444'
    }).then(async (r) => {
        if (r.isConfirmed) {
            showLoading(true, 'กำลังดึงข้อมูลออกจากทีม...');
            try {
                const { error } = await supabaseClient
                    .from('profiles')
                    .update({ team_id: currentUser.id })
                    .eq('id', currentUser.id);

                if (error) throw error;

                currentUser.team_id = currentUser.id;
                Swal.fire('สำเร็จ', 'ออกจากทีมและสร้างห้องทำงานคนเดียวแล้ว', 'success');
                await loadTeamMembers();
                await syncJobsFromDB();
            } catch (err) {
                Swal.fire('ออกจากทีมล้มเหลว', err.message, 'error');
            } finally {
                showLoading(false);
            }
        }
    });
}

async function removeTeamMember(id) {
    Swal.fire({
        title: 'ยืนยันความปลอดภัย',
        text: 'กรุณากรอกรหัสผ่านบัญชีของคุณเพื่อยืนยันการลบสมาชิกออกจากทีม',
        input: 'password',
        inputPlaceholder: 'รหัสผ่านของคุณ',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ยืนยันรหัสผ่านเพื่อลบ',
        cancelButtonText: 'ยกเลิก',
        inputAttributes: {
            autocapitalize: 'off',
            autocorrect: 'off'
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const password = result.value;
            if (!password) {
                return Swal.fire('ผิดพลาด', 'กรุณากรอกรหัสผ่านเพื่อดำเนินการต่อ', 'error');
            }

            showLoading(true, 'กำลังตรวจสอบความถูกต้อง...');
            try {
                const currentEmail = currentUser.email;
                if (!currentEmail) throw new Error("ไม่พบอีเมลผู้ใช้งานปัจจุบัน");

                const { error: authError } = await supabaseClient.auth.signInWithPassword({
                    email: currentEmail,
                    password: password
                });

                if (authError) throw new Error("รหัสผ่านไม่ถูกต้อง");

                showLoading(true, 'กำลังลบสมาชิกออกจากกลุ่ม...');
                const { error } = await supabaseClient
                    .from('profiles')
                    .update({ team_id: id })
                    .eq('id', id);

                if (error) throw error;

                Swal.fire('สำเร็จ', 'นำผู้ใช้งานออกจากกลุ่มสำรวจแล้ว', 'success');
                await loadTeamMembers();
            } catch (err) {
                Swal.fire('การลบสมาชิกล้มเหลว', err.message, 'error');
            } finally {
                showLoading(false);
            }
        }
    });
}

// --- Dropbox Direct Download URL & Import GeoJSON ---
function getDropboxDirectLink(url) {
    // Check for Dropbox link and convert to raw download link
    if (url.includes('dropbox.com')) {
        return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
    }
    return url;
}

async function importFromCloudLink() {
    const url = document.getElementById('set-geojson-drive-url').value.trim();
    if (!url) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาวางลิงก์แชร์ของ Dropbox', 'warning');

    const directUrl = getDropboxDirectLink(url);
    showLoading(true, 'กำลังเชื่อมโยงและดาวน์โหลดข้อมูลจาก Dropbox...');
    try {
        localStorage.setItem('survey_geojson_drive_url', url);

        const response = await fetch(directUrl);
        if (!response.ok) throw new Error("ไม่สามารถดาวน์โหลดไฟล์ได้ ตรวจสอบสิทธิ์ให้เป็น 'ทุกคนที่มีลิงก์มีสิทธิ์อ่าน'");

        const json = await response.json();
        let feats = (json.type === "FeatureCollection") ? json.features : (Array.isArray(json) ? json : [json]);

        showLoading(false);
        showFieldMapping(feats, async (mapping) => {
            showLoading(true, `กำลังเขียน ${feats.length} รายการลงคลาวด์ Supabase...`);
            let imported = 0;

            for (let f of feats) {
                const p = f.properties || f;
                let geom = f.geometry;
                if (!geom && (f.lat || p.lat)) geom = { type: 'Point', coordinates: [parseFloat(f.lng || p.lng), parseFloat(f.lat || p.lat)] };
                if (!geom) continue;

                let lat, lng;
                if (geom.type === 'Point') {
                    lng = geom.coordinates[0];
                    lat = geom.coordinates[1];
                } else {
                    try {
                        const l = L.geoJSON(geom);
                        const c = l.getBounds().getCenter();
                        lat = c.lat;
                        lng = c.lng;
                    } catch (err) {
                        continue;
                    }
                }

                const idRaw = mapping.idKey && p[mapping.idKey] !== undefined && p[mapping.idKey] !== null ? p[mapping.idKey] : '';
                const idValue = idRaw.toString().trim();
                const nameVal = idValue || 'นำเข้า';
                const searchVal = mapping.searchKey && p[mapping.searchKey] !== undefined && p[mapping.searchKey] !== null ? p[mapping.searchKey].toString().trim() : '';
                const amphoeVal = mapping.amphoeKey && p[mapping.amphoeKey] !== undefined && p[mapping.amphoeKey] !== null ? p[mapping.amphoeKey].toString().trim() : '';
                const tambonVal = mapping.tambonKey && p[mapping.tambonKey] !== undefined && p[mapping.tambonKey] !== null ? p[mapping.tambonKey].toString().trim() : '';
                const areaVal = mapping.areaKey && p[mapping.areaKey] !== undefined && p[mapping.areaKey] !== null ? p[mapping.areaKey].toString().trim() : '';

                // Check duplicate first
                const finalId = idValue || 'GD-' + Math.random().toString(36).substr(2, 9);
                const existing = dbJobs.find(x => x.id === finalId);
                const job = {
                    id: finalId,
                    lat,
                    lng,
                    geometry: geom,
                    status: existing ? existing.status : 'waiting',
                    category: currentUser.category,
                    properties: {
                        ...p,
                        name: nameVal,
                        import_source: url,
                        note: existing ? existing.properties.note : (p.REMARK || p.note || ''),
                        images: existing ? existing.properties.images : [],
                        search_field: searchVal,
                        amphoe: amphoeVal,
                        tambon: tambonVal,
                        area: areaVal
                    }
                };
                await saveJobToSupabase(job);
                imported++;
            }

            Swal.fire('นำเข้าสำเร็จ', `เชื่อมโยงและนำเข้าข้อมูลสำเร็จ ${imported} แปลงแผนที่`, 'success');
            await syncJobsFromDB();
            closeSettingsModal();
        });
    } catch (err) {
        console.error("GeoJSON Google Drive Error", err);
        Swal.fire({
            title: 'ดึงข้อมูลไม่สำเร็จ',
            html: `<div class="text-left text-xs space-y-2">
                        <p class="font-bold text-red-500">ผิดพลาด: ${err.message}</p>
                        <p class="font-bold">ขั้นตอนการแชร์ Google Drive:</p>
                        <ol class="list-decimal pl-4 space-y-1">
                            <li>คลิกขวาที่ไฟล์ .geojson ใน Google Drive -> เลือก <b>แชร์ (Share)</b></li>
                            <li>ในส่วนการเข้าถึงทั่วไป ปรับเป็น <b>ทุกคนที่มีลิงก์ (Anyone with link)</b></li>
                            <li>คัดลอกลิงก์นั้นมาวางลงในช่องนี้</li>
                        </ol>
                    </div>`,
            icon: 'error'
        });
    } finally {
        showLoading(false);
    }
}



// --- Database & Category Modifiers ---
function addCat() {
    Swal.fire({ input: 'text', title: 'เพิ่มหมวดใหม่' }).then(r => {
        if (r.value) {
            categories.push(r.value);
            localStorage.setItem('survey_cats_v16', JSON.stringify(categories));
            openToolsMenu();
        }
    });
}

function clearAll() {
    Swal.fire({
        title: 'ยืนยันล้างข้อมูลทั้งหมด?',
        text: 'จุดและข้อมูลแผนที่ในทีมของคุณจะถูกลบออกจากฐานข้อมูลคลาวด์ถาวร',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'red'
    }).then(async (r) => {
        if (r.isConfirmed) {
            showLoading(true, 'กำลังเคลียร์ข้อมูล...');
            try {
                await clearAllSupabaseJobs();
                dbJobs = [];
                renderMap();
                closeSettingsModal();
                Swal.fire('ล้างข้อมูลสำเร็จ', 'แผนที่ว่างเปล่าเรียบร้อย', 'success');
            } catch (e) {
                Swal.fire('ล้างข้อมูลไม่สำเร็จ', e.message, 'error');
            } finally {
                showLoading(false);
            }
        }
    });
}

let calCurrentDate = new Date();
let calSelectedDate = null;
let calActiveMode = 'excel'; // 'excel' or 'report'

function getDatesWithData() {
    const data = dbJobs.filter(j => j.category === currentUser.category && j.status === 'done');
    const dates = new Map();
    data.forEach(j => {
        const d = j.properties.date || (j.updated_at ? j.updated_at.split('T')[0] : '');
        if (d) {
            dates.set(d, (dates.get(d) || 0) + 1);
        }
    });
    return dates;
}

function openExportCalendarModal(mode) {
    closeSettingsModal();
    calActiveMode = mode;
    calSelectedDate = null;
    calCurrentDate = new Date(); // Reset to today's month

    const titleEl = document.getElementById('export-calendar-title');
    if (titleEl) {
        titleEl.innerHTML = mode === 'excel'
            ? '<i class="fa-solid fa-file-excel text-green-600"></i> เลือกวันในการออก Excel'
            : '<i class="fa-solid fa-file-invoice text-blue-600"></i> เลือกวันในการออกรายงาน';
    }

    const actionContainer = document.getElementById('cal-action-container');
    if (actionContainer) actionContainer.classList.add('hidden');

    renderExportCalendar();
    document.getElementById('export-calendar-modal').classList.remove('hidden');
}

function closeExportCalendarModal() {
    document.getElementById('export-calendar-modal').classList.add('hidden');
    openToolsMenu();
}

function navigateExportCalendar(direction) {
    calCurrentDate.setMonth(calCurrentDate.getMonth() + direction);
    renderExportCalendar();
}

function renderExportCalendar() {
    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();

    const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    const monthYearEl = document.getElementById('cal-month-year');
    if (monthYearEl) {
        monthYearEl.innerText = `${thaiMonths[month]} ${year + 543}`;
    }

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const grid = document.getElementById('cal-days-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const datesWithData = getDatesWithData();

    // Render empty cells for leading blank days
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div class="p-2"></div>`;
    }

    // Render days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasData = datesWithData.has(dateStr);
        const isSelected = calSelectedDate === dateStr;

        let classes = "p-2 rounded-xl text-center transition select-none ";
        let onClickAttr = "";

        if (isSelected) {
            classes += "bg-blue-600 text-white font-bold cursor-pointer shadow-md";
            onClickAttr = `onclick="selectExportDate('${dateStr}')"`;
        } else if (hasData) {
            // Highlight with data
            classes += "bg-emerald-100 text-emerald-800 font-bold hover:bg-emerald-200 cursor-pointer border border-emerald-300 shadow-sm";
            onClickAttr = `onclick="selectExportDate('${dateStr}')"`;
        } else {
            classes += "text-gray-300 pointer-events-none";
        }

        grid.innerHTML += `<div class="${classes}" ${onClickAttr}>${day}</div>`;
    }
}

function selectExportDate(dateStr) {
    calSelectedDate = dateStr;

    // Format for display
    const parts = dateStr.split('-');
    const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const count = getDatesWithData().get(dateStr) || 0;
    const displayStr = `${parseInt(parts[2])} ${thaiMonths[parseInt(parts[1]) - 1]} ${parseInt(parts[0]) + 543} (จำนวน ${count} รายการ)`;

    const displayEl = document.getElementById('cal-selected-display');
    if (displayEl) displayEl.innerText = displayStr;

    const actionContainer = document.getElementById('cal-action-container');
    if (actionContainer) actionContainer.classList.remove('hidden');

    renderExportCalendar();
}

function confirmExportCalendar(exportAll = false) {
    let data = [];
    if (exportAll) {
        data = dbJobs.filter(j => j.category === currentUser.category && j.status === 'done');
        if (data.length === 0) {
            return Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลงานเสร็จสิ้นเพื่อส่งออก', 'warning');
        }
    } else {
        if (!calSelectedDate) {
            return Swal.fire('กรุณาเลือกวัน', 'คุณยังไม่ได้เลือกวันที่ต้องการส่งออก', 'warning');
        }
        data = dbJobs.filter(j => {
            const d = j.properties.date || (j.updated_at ? j.updated_at.split('T')[0] : '');
            return j.category === currentUser.category && j.status === 'done' && d === calSelectedDate;
        });
        if (data.length === 0) {
            return Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลงานเสร็จสิ้นในวันที่เลือก', 'warning');
        }
    }

    closeExportCalendarModal();

    if (calActiveMode === 'excel') {
        const suffix = exportAll ? 'ALL' : calSelectedDate;
        const f = `SURVEY_${currentUser.category}_${suffix}`;
        const r = data.map(j => ({
            ID: j.id,
            Name: j.properties.name,
            Tambon: j.properties.tambon || j.properties.TUMB_NAME || '',
            Amphoe: j.properties.amphoe || j.properties.AMPH_NAME || '',
            Area: j.properties.area || '',
            Note: j.properties.note,
            Lat: j.lat,
            Lng: j.lng,
            Date: j.properties.date || (j.updated_at ? j.updated_at.split('T')[0] : '')
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r), "Data");
        XLSX.writeFile(wb, f + '.xlsx');
    } else {
        generateReport(data);
    }
}

function generateReport(jobs) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        return Swal.fire('ป๊อปอัปถูกบล็อก', 'กรุณาอนุญาตให้เปิดหน้าต่างป๊อปอัปสำหรับเว็บไซต์นี้', 'warning');
    }

    let html = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>รายงานการสำรวจตรวจสอบที่ราชพัสดุ</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
        body {
            font-family: 'Sarabun', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f3f4f6;
            color: #1f2937;
        }
        .page {
            background-color: #ffffff;
            width: 210mm;
            min-height: 297mm;
            padding: 20mm;
            margin: 10mm auto;
            box-sizing: border-box;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
        }
        @media print {
            body {
                background-color: #ffffff;
                margin: 0;
                padding: 0;
            }
            .page {
                width: auto;
                min-height: auto;
                margin: 0;
                padding: 10mm;
                box-shadow: none;
                border-radius: 0;
            }
        }
        .header {
            text-align: center;
            font-size: 22px;
            font-weight: bold;
            color: #1e3a8a;
            border-bottom: 3px double #3b82f6;
            padding-bottom: 12px;
            margin-bottom: 25px;
        }
        .image-gallery {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 25px;
        }
        .image-card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
            background-color: #f9fafb;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .image-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            display: block;
        }
        .no-images {
            grid-column: span 2;
            text-align: center;
            padding: 30px;
            color: #9ca3af;
            border: 2px dashed #e5e7eb;
            border-radius: 12px;
            font-size: 14px;
        }
        .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #1e3a8a;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 6px;
            margin-bottom: 15px;
            margin-top: 15px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 180px 1fr;
            row-gap: 12px;
            column-gap: 15px;
            font-size: 14px;
            line-height: 1.6;
        }
        .info-label {
            font-weight: bold;
            color: #4b5563;
        }
        .info-value {
            color: #111827;
            word-break: break-word;
        }
        .footer {
            margin-top: auto;
            text-align: right;
            font-size: 11px;
            color: #9ca3af;
            border-top: 1px solid #f3f4f6;
            padding-top: 10px;
        }
    </style>
</head>
<body>
`;

    jobs.forEach((j, index) => {
        const name = j.properties.name || '(ไม่มีชื่อแปลง)';
        const note = j.properties.note || '(ไม่มีรายละเอียดบันทึก)';
        const date = j.properties.date || (j.updated_at ? j.updated_at.split('T')[0] : '-');
        const amphoe = j.properties.amphoe || j.properties.AMPH_NAME || '-';
        const tambon = j.properties.tambon || j.properties.TUMB_NAME || '-';
        const area = j.properties.area || '-';
        const images = j.properties.images || [];

        let imagesHtml = '';
        if (images.length > 0) {
            imagesHtml = '<div class="image-gallery">';
            images.forEach(img => {
                imagesHtml += `
                            <div class="image-card">
                                <img src="${img.url}" alt="ภาพถ่ายสำรวจ">
                            </div>
                        `;
            });
            imagesHtml += '</div>';
        } else {
            imagesHtml = `
                        <div class="no-images">
                            ไม่มีภาพถ่ายประกอบ
                        </div>
                    `;
        }

        html += `
    <div class="page">
        <div class="header">รายงานการสำรวจตรวจสอบที่ราชพัสดุ</div>
        
        <div class="section-title">📷 ภาพถ่ายจากการสำรวจ</div>
        ${imagesHtml}
        
        <div class="section-title">📝 รายละเอียดการสำรวจ</div>
        <div class="info-grid">
            <div class="info-label">ชื่อแปลง / เลขทะเบียนที่ดิน:</div>
            <div class="info-value" style="font-weight: bold;">${name}</div>
            
            <div class="info-label">ตำบล:</div>
            <div class="info-value">${tambon}</div>
            
            <div class="info-label">อำเภอ:</div>
            <div class="info-value">${amphoe}</div>
            
            <div class="info-label">เนื้อที่แปลงที่ดิน:</div>
            <div class="info-value">${area}</div>
            
            <div class="info-label">พิกัดทางภูมิศาสตร์:</div>
            <div class="info-value">Latitude: ${j.lat}, Longitude: ${j.lng}</div>
            
            <div class="info-label">หมวดหมู่งาน:</div>
            <div class="info-value">${j.category}</div>
            
            <div class="info-label">วันที่ดำเนินการสำรวจ:</div>
            <div class="info-value">${date}</div>
            
            <div class="info-label">บันทึกเพิ่มเติม:</div>
            <div class="info-value">${note}</div>
        </div>
        
        <div class="footer">
            หน้า ${index + 1} จาก ${jobs.length} | สร้างโดยระบบจัดเก็บข้อมูล Smart Survey
        </div>
    </div>
                `;
    });

    html += `
    <script>
        window.onload = function() {
            window.print();
        }
    <\/script>
</body>
</html>
`;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
}

function download(c, n, m) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([c], { type: m }));
    a.download = n;
    a.click();
}

function doSearch() {
    renderMap();
    const searchVal = document.getElementById('inp-search').value.trim();
    const res = document.getElementById('search-results');
    res.innerHTML = '';

    if (searchVal === '') {
        res.classList.remove('active');
        return;
    }

    const hits = getFilteredJobs();
    if (hits.length > 0) res.classList.add('active');
    else res.classList.remove('active');

    hits.slice(0, 10).forEach(j => {
        const name = j.properties.name || '(ไม่มีชื่อแปลง)';
        const searchField = j.properties.search_field || ''; // 🎯 ดึงข้อมูลช่องเชื่อมโยงมาด้วย
        const note = j.properties.note || '';

        res.innerHTML += `
            <div class="p-3 border-b cursor-pointer hover:bg-gray-50" onclick="openSheetFromSearch('${j.id}')">
                <div class="text-sm font-bold text-gray-800">${name}</div>
                
                ${searchField ? `<div class="text-xs font-bold text-blue-600 mt-0.5"><i class="fa-solid fa-magnifying-glass text-[10px]"></i> ${searchField}</div>` : ''}
                
                ${note ? `<div class="text-[10px] text-gray-500 truncate mt-0.5">${note}</div>` : ''}
            </div>`;
    });
}

function openSheetFromSearch(id) {
    const j = dbJobs.find(x => x.id === id);
    if (j) {
        openSheet(j);
        document.getElementById('sheet').classList.add('minimized');
        document.getElementById('search-results').classList.remove('active');
        document.getElementById('inp-search').value = '';
        if (userMarker) {
            map.fitBounds(L.latLngBounds([userMarker.getLatLng(), [j.lat, j.lng]]), { padding: [80, 80] });
        }
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('PWA Ready!', reg))
            .catch(err => console.log('PWA Failed', err));
    });
}

// --- Pin Labels Toggle & Cloudinary Upload Logic ---
function togglePinLabels() {
    showPinLabels = !showPinLabels;
    localStorage.setItem('survey_show_labels', showPinLabels);

    const btn = document.getElementById('btn-label');
    if (btn) {
        if (showPinLabels) {
            btn.classList.add('bg-blue-50', 'text-blue-600');
            btn.classList.remove('text-gray-400');
        } else {
            btn.classList.remove('bg-blue-50', 'text-blue-600');
            btn.classList.add('text-gray-400');
        }
    }

    renderMap();
    Swal.fire({ toast: true, icon: 'success', title: showPinLabels ? 'เปิดแสดงป้ายชื่อ' : 'ปิดแสดงป้ายชื่อ', timer: 1500, showConfirmButton: false });
}



function renderImageGallery(images, editable) {
    const container = document.getElementById('image-gallery-container');
    if (!container) return;
    container.innerHTML = '';

    if (images.length === 0) {
        container.innerHTML = `<div class="text-xs text-gray-400 flex items-center justify-center w-full py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <i class="fa-solid fa-image mr-1"></i> ยังไม่มีรูปถ่ายแปลงสำรวจ
                </div>`;
        return;
    }

    images.forEach((img, idx) => {
        const url = typeof img === 'string' ? img : img.url;

        const card = document.createElement('div');
        card.className = 'relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm cursor-pointer group bg-gray-100';

        const imgEl = document.createElement('img');
        imgEl.src = url;
        imgEl.className = 'w-full h-full object-cover';
        imgEl.onclick = () => viewFullScreenImage(url);
        card.appendChild(imgEl);

        if (editable) {
            const delBtn = document.createElement('button');
            delBtn.className = 'absolute top-0 right-0 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition shadow-lg';
            delBtn.style.zIndex = '50';
            delBtn.style.touchAction = 'manipulation';
            delBtn.innerHTML = '<i class="fa-solid fa-xmark text-xs"></i>';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                deleteJobImage(idx);
            });
            delBtn.addEventListener('touchend', (e) => {
                e.stopPropagation();
                e.preventDefault();
                deleteJobImage(idx);
            });
            card.appendChild(delBtn);
        }

        container.appendChild(card);
    });
}

function viewFullScreenImage(url) {
    Swal.fire({
        imageUrl: url,
        imageAlt: 'รูปถ่ายแปลงสำรวจ',
        showConfirmButton: false,
        showCloseButton: true,
        background: 'rgba(0,0,0,0.9)',
        width: 'auto',
        maxWidth: '95vw',
        customClass: {
            image: 'max-h-[80vh] object-contain rounded-xl'
        }
    });
}

function triggerCamera() {
    const job = dbJobs.find(j => j.id === selectedJobId);
    if (!job) return;
    const images = job.properties.images || [];
    if (images.length >= 6) {
        return Swal.fire('อัปโหลดครบกำหนด', 'สามารถอัปโหลดได้สูงสุด 6 รูปเท่านั้น', 'warning');
    }

    if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
        return Swal.fire(
            'กรุณาตั้งค่า Cloudinary',
            'ต้องกรอกข้อมูล Cloud Name และ Upload Preset ในหน้าต่างตั้งค่าก่อนใช้งาน',
            'warning'
        );
    }

    document.getElementById('camera-file-input').click();
}

async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const job = dbJobs.find(j => j.id === selectedJobId);
    if (!job) return;
    if (!job.properties.images) job.properties.images = [];

    const originalInput = document.getElementById('camera-file-input');

    for (let file of files) {
        if (job.properties.images.length >= 6) {
            Swal.fire('ข้อจำกัด', 'สามารถอัปโหลดได้สูงสุด 6 รูปเท่านั้น', 'warning');
            break;
        }

        // 1. สร้าง URL ชั่วคราวเพื่อแสดงพรีวิวภาพบนหน้าจอทันที
        const tempUrl = URL.createObjectURL(file);

        // 2. เก็บไฟล์จริงไว้ใน Array โดยมีตัวแปร isTemp: true รอส่งไป Cloudinary
        job.properties.images.push({
            url: tempUrl,
            isTemp: true,
            file: file
        });
    }

    // อัปเดตแกลเลอรีภาพบนหน้าจอ (รูปจะโชว์ขึ้นมาทันที)
    renderImageGallery(job.properties.images, true);
    originalInput.value = '';
}

function showGalleryUploadingPlaceholder() {
    const container = document.getElementById('image-gallery-container');
    if (!container) return;

    const card = document.createElement('div');
    card.className = 'flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm flex flex-col items-center justify-center bg-gray-50 relative';
    card.innerHTML = `
                <div class="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                <span class="text-[9px] text-gray-500 mt-1">กำลังโหลด...</span>
            `;

    // Clear any dashed border placeholder first
    const noImagesEl = container.querySelector('.border-dashed');
    if (noImagesEl) {
        container.innerHTML = '';
    }
    container.appendChild(card);
}

async function deleteJobImage(idx) {
    const job = dbJobs.find(j => j.id === selectedJobId);
    if (!job || !job.properties.images || !job.properties.images[idx]) return;

    const img = job.properties.images[idx];

    Swal.fire({
        title: 'ยืนยันลบรูปถ่าย?',
        text: 'รูปนี้จะถูกลบออก',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ลบรูป',
        cancelButtonText: 'ยกเลิก'
    }).then(async (r) => {
        if (r.isConfirmed) {
            showLoading(true, 'กำลังลบรูปภาพ...');
            try {
                // กรณีที่ 1: เป็นรูปพรีวิว (ผู้ใช้เพิ่งเลือก แต่ยังไม่ได้กดเซฟ) 
                // -> ลบจากหน้าจอได้เลย ไม่ต้องวิ่งไปกวนหลังบ้าน
                if (img.isTemp) {
                    URL.revokeObjectURL(img.url); // คืนพื้นที่หน่วยความจำให้มือถือ
                    job.properties.images.splice(idx, 1);
                    renderImageGallery(job.properties.images, true);
                    Swal.fire({ toast: true, icon: 'success', title: 'ลบรูปพรีวิวทิ้งแล้ว', timer: 1000, showConfirmButton: false });
                }
                // กรณีที่ 2: เป็นรูปที่อัปโหลดขึ้น Cloudinary ไปแล้ว (มี public_id)
                else if (img.public_id) {
                    // ⚠️ วาง URL ของ Google Apps Script ที่ช่องนี้
                    const GAS_WEBAPP_URL = "วาง_URL_ที่ได้จาก_Google_Apps_Script_ตรงนี้";

                    const response = await fetch(GAS_WEBAPP_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({ publicId: img.public_id })
                    });

                    const rawText = await response.text();
                    const data = JSON.parse(rawText);

                    if (data.success && data.result && data.result.result === "ok") {
                        job.properties.images.splice(idx, 1);
                        renderImageGallery(job.properties.images, true);
                        Swal.fire({ toast: true, icon: 'success', title: 'ลบรูปออกจากคลาวด์แล้ว', timer: 1500, showConfirmButton: false });
                    } else {
                        Swal.fire('Cloudinary ปฏิเสธการลบ', JSON.stringify(data), 'error');
                    }
                }
            } catch (e) {
                console.error("ระบบลบภาพล้มเหลว", e);
                Swal.fire('ล้มเหลว', e.message, 'error');
            } finally {
                showLoading(false);
            }
        }
    });
}

// Export handlers to window for inline HTML event listener compatibility
window.handleAuthSubmit = handleAuthSubmit;
window.togglePinLabels = togglePinLabels;
window.syncJobsFromDB = syncJobsFromDB;
window.toggleViewMode = toggleViewMode;
window.toggleBaseMap = toggleBaseMap;
window.doSearch = doSearch;
window.onAmphoeChange = onAmphoeChange;
window.filterMap = filterMap;
window.importData = importData;
window.openToolsMenu = openToolsMenu;
window.findNearestNewJob = findNearestNewJob;
window.toggleGPSFollow = toggleGPSFollow;
window.viewJsonData = viewJsonData;
window.saveData = saveData;
window.enableEdit = enableEdit;
window.deleteJob = deleteJob;
window.navGoogle = navGoogle;
window.startNav = startNav;
window.stopNav = stopNav;
window.closeSheet = closeSheet;
window.toggleSheetSize = toggleSheetSize;
window.closeSettingsModal = closeSettingsModal;
window.switchSettingsTab = switchSettingsTab;
window.copyUserCode = copyUserCode;
window.addCat = addCat;
window.clearAll = clearAll;
window.triggerCamera = triggerCamera;
window.handleImageUpload = handleImageUpload;
window.resetGps = resetGps;
window.openSheetFromSearch = openSheetFromSearch;
window.handleLogout = handleLogout;
window.openExportCalendarModal = openExportCalendarModal;
window.closeExportCalendarModal = closeExportCalendarModal;
window.navigateExportCalendar = navigateExportCalendar;
window.selectExportDate = selectExportDate;
window.confirmExportCalendar = confirmExportCalendar;
window.closeImportMappingModal = closeImportMappingModal;
