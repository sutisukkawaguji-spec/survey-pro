// Global error handlers for debugging
        window.addEventListener('error', function(e) {
            alert('JS Error: ' + e.message + ' at ' + e.filename + ':' + e.lineno);
        });
        window.addEventListener('unhandledrejection', function(e) {
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

        let showPinLabels = localStorage.getItem('survey_show_labels') !== 'false';
        let cloudinaryCloudName = localStorage.getItem('survey_cloudinary_cloud_name') || '';
        let cloudinaryUploadPreset = localStorage.getItem('survey_cloudinary_upload_preset') || '';

        let maps, currentBaseMap = 'hybrid';

                async function startApp() {
            // โหลดหมวดหมู่จากความจำเดิม (ถ้ามี)
            try {
                const c = localStorage.getItem('survey_cats_v16');
                if (c) categories = JSON.parse(c);
            } catch (e) { }

            initApp();
            await checkAuthSession();
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

            navigator.geolocation.watchPosition(p => {
                const latlng = [p.coords.latitude, p.coords.longitude];
                if (!userMarker) {
                    userMarker = L.marker(latlng, {
                        icon: L.divIcon({ className: 'bg-blue-500 w-4 h-4 rounded-full border-2 border-white shadow' })
                    }).addTo(map);
                } else {
                    userMarker.setLatLng(latlng);
                }
                if (isFollowing && !isNavigating) map.setView(latlng, 18);
            }, e => { }, { enableHighAccuracy: true });

            map.on('dragstart', () => { if (isFollowing) toggleGPSFollow(false); });

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

        function updateUserInfo() {
            document.getElementById('user-display').innerText = currentUser.name;
            document.getElementById('profile-display-name').innerText = currentUser.name;
            document.getElementById('profile-email').innerText = currentUser.email || '-';
            document.getElementById('profile-user-code').innerText = currentUser.user_code || '------';
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
            const search = document.getElementById('inp-search').value.toLowerCase();
            const amphoe = document.getElementById('sel-amphoe').value;
            const tambon = document.getElementById('sel-tambon').value;
            return dbJobs.filter(j => {
                const matchCat = j.category === currentUser.category;
                const p = j.properties;
                const txt = search;
                const matchS = txt === "" || (p.name || "").toString().toLowerCase().includes(txt) || (p.note || "").toString().toLowerCase().includes(txt);
                const matchA = amphoe === "" || (p.amphoe || p.AMPH_NAME) == amphoe;
                const matchT = tambon === "" || (p.tambon || p.TUMB_NAME) == tambon;
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
                    layer = L.geoJSON(job.geometry, { style: { color: color, weight: 2, fillOpacity: fill } });
                } else {
                    let iconUrl = job.status === 'done'
                        ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png'
                        : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';
                    if (job.status === 'navigating') {
                        iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png';
                    }
                    layer = L.marker([job.lat, job.lng], {
                        icon: L.icon({ iconUrl, iconSize: [25, 41], iconAnchor: [12, 41] })
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

                    layer.on('click', () => openSheet(job));
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

        function startNav() {
            if (!userMarker) return Swal.fire('GPS ไม่พร้อม', '', 'warning');
            const job = dbJobs.find(j => j.id === selectedJobId);
            if (!job) return;

            viewMode = 'pin';
            document.getElementById('btn-view').innerHTML = '<i class="fa-solid fa-map-pin"></i>';

            isNavigating = true;
            job.prevStatus = job.status;
            job.status = 'navigating';
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
                navInterval = setInterval(() => {
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
                        stopNav();
                        document.getElementById('sheet').classList.remove('minimized');
                        document.getElementById('sheet').classList.add('active');
                        Swal.fire({ toast: true, icon: 'success', title: 'ถึงแล้ว!', text: 'กรอกข้อมูลได้เลย', timer: 2000, showConfirmButton: false });
                    }
                }, 3000);
            } catch (e) { }
        }

        function stopNav() {
            isNavigating = false;
            if (routingControl) {
                try { map.removeControl(routingControl); } catch (e) { }
            }
            routingControl = null;
            if (navInterval) clearInterval(navInterval);
            document.getElementById('btn-nav-start').classList.remove('hidden');
            document.getElementById('btn-nav-cancel').classList.add('hidden');
            const job = dbJobs.find(j => j.id === selectedJobId);
            if (job) job.status = job.prevStatus || 'done';
            renderMap();
        }

        function openSheet(job) {
            selectedJobId = job.id;
            const p = job.properties;
            document.getElementById('sheet-title').innerText = p.name || 'รายละเอียด';
            document.getElementById('sheet-meta').innerText = `${p.amphoe || p.AMPH_NAME || '-'} / ${p.tambon || p.TUMB_NAME || '-'}`;
            document.getElementById('sheet-name').value = p.name || '';
            document.getElementById('sheet-note').value = p.note || '';

            const btnSave = document.getElementById('btn-save');
            const btnEdit = document.getElementById('btn-edit');

            const isDone = job.status === 'done';
            if (isDone) {
                btnSave.classList.add('hidden');
                btnEdit.classList.remove('hidden');
                toggleInputs(false);
            } else {
                btnSave.classList.remove('hidden');
                btnEdit.classList.add('hidden');
                toggleInputs(true);
            }

            // Render images gallery
            const images = p.images || [];
            renderImageGallery(images, !isDone);

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
            const filteredJobs = getFilteredJobs().filter(j => j.status !== 'done');
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
            let html = '<div class="text-left text-xs max-h-[60vh] overflow-y-auto"><table class="w-full border-collapse">';
            const sortedKeys = Object.keys(job.properties).sort();
            sortedKeys.forEach(k => {
                if (k !== 'name' && k !== 'note' && k !== 'date') {
                    html += `<tr class="border-b"><td class="font-bold p-2 text-gray-500 bg-gray-50 w-1/3">${k}</td><td class="p-2 text-gray-800 break-words">${job.properties[k]}</td></tr>`;
                }
            });
            html += '</table></div>';
            Swal.fire({ title: 'ข้อมูลต้นฉบับ', html: html, width: '90%', confirmButtonText: 'ปิด', confirmButtonColor: '#4b5563' });
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
                        const job = {
                            id: p.REG_ID || p.name || 'IMP-' + Math.random().toString(36).substr(2, 9),
                            lat,
                            lng,
                            geometry: geom,
                            status: 'waiting',
                            category: currentUser.category,
                            properties: { ...p, name: p.REG_ID || p.name || 'นำเข้า', note: p.REMARK || p.note || '' }
                        };
                        await saveJobToSupabase(job);
                        count++;
                    }
                    Swal.fire('สำเร็จ', `นำเข้าแปลงที่ดินสำเร็จ ${count} รายการ`, 'success');
                    await syncJobsFromDB();
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
            if (job) {
                if (isNavigating) stopNav();

                showLoading(true, 'กำลังบันทึกข้อมูล...');
                try {
                    job.status = 'done';
                    job.properties.name = document.getElementById('sheet-name').value;
                    job.properties.note = document.getElementById('sheet-note').value;
                    job.properties.date = new Date().toISOString().split('T')[0];

                    await saveJobToSupabase(job);

                    renderMap();
                    closeSheet();
                    Swal.fire({ toast: true, icon: 'success', title: 'บันทึกข้อมูลเรียบร้อย', timer: 1000, showConfirmButton: false });
                } catch (e) {
                    Swal.fire('บันทึกล้มเหลว', e.message, 'error');
                } finally {
                    showLoading(false);
                }
            }
        }

        function deleteJob() {
            Swal.fire({
                title: 'ลบรายการนี้?',
                text: 'ข้อมูลพิกัดและผลการสำรวจจะหายไปถาวร',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444'
            }).then(async (r) => {
                if (r.isConfirmed) {
                    showLoading(true, 'กำลังลบแปลงสำรวจ...');
                    try {
                        await deleteJobFromSupabase(selectedJobId);
                        dbJobs = dbJobs.filter(j => j.id !== selectedJobId);
                        renderMap();
                        closeSheet();
                        Swal.fire({ toast: true, icon: 'success', title: 'ลบข้อมูลแล้ว', timer: 1000, showConfirmButton: false });
                    } catch (e) {
                        Swal.fire('ลบไม่สำเร็จ', e.message, 'error');
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
                const a = j.properties.amphoe || j.properties.AMPH_NAME;
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
            dbJobs.filter(j => j.category === currentUser.category && (j.properties.amphoe || j.properties.AMPH_NAME) === v).forEach(j => {
                const t = j.properties.tambon || j.properties.TUMB_NAME;
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
            const tabs = ['profile', 'geojson', 'cloudinary'];
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
            } else if (tab === 'cloudinary') {
                document.getElementById('config-cloudinary-cloud-name').value = cloudinaryCloudName;
                document.getElementById('config-cloudinary-upload-preset').value = cloudinaryUploadPreset;
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
                title: 'ยืนยันลบสมาชิกออก?',
                text: 'สมาชิกคนนี้จะถูกผลักออกจากทีมและจะทำงานเดี่ยวแทน',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444'
            }).then(async (r) => {
                if (r.isConfirmed) {
                    showLoading(true, 'กำลังลบสมาชิกออกจากกลุ่ม...');
                    try {
                        const { error } = await supabaseClient
                            .from('profiles')
                            .update({ team_id: id })
                            .eq('id', id);

                        if (error) throw error;

                        Swal.fire('สำเร็จ', 'นำผู้ใช้งานออกจากกลุ่มสำรวจแล้ว', 'success');
                        await loadTeamMembers();
                    } catch (err) {
                        Swal.fire('ลบสมาชิกผิดพลาด', err.message, 'error');
                    } finally {
                        showLoading(false);
                    }
                }
            });
        }

        // --- Google Drive Direct Download URL & Import GeoJSON ---
        function getGoogleDriveDirectLink(url) {
            // ตรวจหา ID จากลิงก์ปกติหรือลิงก์ที่มี id=
            const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                return `https://docs.google.com/uc?export=download&id=${match[1]}`;
            }
            return url;
        }

        async function importFromGoogleDriveLink() {
            const url = document.getElementById('set-geojson-drive-url').value.trim();
            if (!url) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาวางลิงก์แชร์ของ Google Drive', 'warning');

            const directUrl = getGoogleDriveDirectLink(url);
            showLoading(true, 'กำลังเชื่อมโยงและดาวน์โหลดข้อมูลจาก Google Drive...');
            try {
                localStorage.setItem('survey_geojson_drive_url', url);

                const response = await fetch(directUrl);
                if (!response.ok) throw new Error("ไม่สามารถดาวน์โหลดไฟล์ได้ ตรวจสอบสิทธิ์ให้เป็น 'ทุกคนที่มีลิงก์มีสิทธิ์อ่าน'");

                const json = await response.json();
                let feats = (json.type === "FeatureCollection") ? json.features : (Array.isArray(json) ? json : [json]);

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

                    const job = {
                        id: p.REG_ID || p.name || 'GD-' + Math.random().toString(36).substr(2, 9),
                        lat,
                        lng,
                        geometry: geom,
                        status: 'waiting',
                        category: currentUser.category,
                        properties: { ...p, name: p.REG_ID || p.name || 'นำเข้า', note: p.REMARK || p.note || '' }
                    };
                    await saveJobToSupabase(job);
                    imported++;
                }

                Swal.fire('นำเข้าสำเร็จ', `เชื่อมโยงและนำเข้าข้อมูลสำเร็จ ${imported} แปลงแผนที่`, 'success');
                await syncJobsFromDB();
                closeSettingsModal();
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

        async function updateConnectionSettings() {
            const url = document.getElementById('config-db-url').value.trim();
            const key = document.getElementById('config-db-key').value.trim();

            if (!url || !key) {
                return Swal.fire('กรอกข้อมูลไม่ครบ', 'กรุณาระบุข้อมูลทั้ง API URL และ Anon Key', 'warning');
            }

            localStorage.setItem('survey_supabase_url', url);
            localStorage.setItem('survey_supabase_key', key);
            supabaseUrl = url;
            supabaseKey = key;

            if (initSupabase()) {
                Swal.fire('บันทึกสำเร็จ', 'เชื่อมต่อข้อมูลเซิร์ฟเวอร์ใหม่แล้ว', 'success');
                await checkAuthSession();
            } else {
                Swal.fire('ผิดพลาด', 'ไม่สามารถเชื่อมต่อได้ ตรวจสอบความถูกต้องของคีย์', 'error');
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

        function doExport(type) {
            const data = dbJobs.filter(j => j.category === currentUser.category && j.status === 'done');
            if (data.length === 0) return Swal.fire('ไม่มีข้อมูลเสร็จงาน', 'ไม่มีงานสำรวจที่เสร็จในหมวดหมู่นี้ให้ส่งออก', 'warning');

            const f = `SURVEY_${currentUser.category}`;
            if (type === 'xlsx') {
                const r = data.map(j => ({ ID: j.id, Name: j.properties.name, Note: j.properties.note, Lat: j.lat, Lng: j.lng, Date: j.properties.date }));
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r), "Data");
                XLSX.writeFile(wb, f + '.xlsx');
            }
            if (type === 'kml') {
                const g = {
                    type: "FeatureCollection",
                    features: data.map(j => ({
                        type: "Feature",
                        properties: { name: j.properties.name, note: j.properties.note },
                        geometry: j.geometry
                    }))
                };
                download(tokml(g), f + '.kml', 'application/vnd.google-earth.kml+xml');
            }
        }

        function download(c, n, m) {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([c], { type: m }));
            a.download = n;
            a.click();
        }

        function doSearch() {
            renderMap();
            const hits = getFilteredJobs();
            const res = document.getElementById('search-results');
            res.innerHTML = '';
            if (hits.length > 0) res.classList.add('active');
            else res.classList.remove('active');

            hits.slice(0, 10).forEach(j => {
                const name = j.properties.name || '(ไม่มีชื่อ)';
                const note = j.properties.note || '';
                res.innerHTML += `
                    <div class="p-3 border-b cursor-pointer hover:bg-gray-50" onclick="openSheetFromSearch('${j.id}')">
                        <div class="text-sm font-bold text-gray-800">${name}</div>
                        ${note ? `<div class="text-xs text-gray-500 truncate">${note}</div>` : ''}
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

        function saveCloudinarySettings() {
            const cloudName = document.getElementById('config-cloudinary-cloud-name').value.trim();
            const uploadPreset = document.getElementById('config-cloudinary-upload-preset').value.trim();

            localStorage.setItem('survey_cloudinary_cloud_name', cloudName);
            localStorage.setItem('survey_cloudinary_upload_preset', uploadPreset);
            cloudinaryCloudName = cloudName;
            cloudinaryUploadPreset = uploadPreset;

            Swal.fire('บันทึกสำเร็จ', 'อัปเดตข้อมูลตั้งค่า Cloudinary แล้ว', 'success');
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
                    delBtn.className = 'absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition shadow';
                    delBtn.innerHTML = '<i class="fa-solid fa-xmark text-[10px]"></i>';
                    delBtn.onclick = (e) => {
                        e.stopPropagation();
                        deleteJobImage(idx);
                    };
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
                    Swal.fire('อัปโหลดครบกำหนด', 'สามารถอัปโหลดได้สูงสุด 6 รูปเท่านั้น รูปที่เหลือจะไม่ถูกอัปโหลด', 'warning');
                    break;
                }

                showGalleryUploadingPlaceholder();

                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', cloudinaryUploadPreset);

                try {
                    const url = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`;
                    const res = await fetch(url, {
                        method: 'POST',
                        body: formData
                    });

                    if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(errData.error?.message || 'อัปโหลดภาพล้มเหลว');
                    }

                    const data = await res.json();

                    job.properties.images.push({
                        url: data.secure_url,
                        public_id: data.public_id,
                        delete_token: data.delete_token,
                        uploadedAt: Date.now()
                    });

                    renderImageGallery(job.properties.images, true);
                } catch (err) {
                    Swal.fire('เกิดข้อผิดพลาดในการอัปโหลด', err.message, 'error');
                    renderImageGallery(job.properties.images, true);
                }
            }

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
                text: 'รูปนี้จะถูกลบออกจากข้อมูลแปลงสำรวจ',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'ลบรูป',
                cancelButtonText: 'ยกเลิก'
            }).then(async (r) => {
                if (r.isConfirmed) {
                    // Try to delete from Cloudinary if upload was within 10 minutes (and delete_token is present)
                    if (img.delete_token && img.uploadedAt && (Date.now() - img.uploadedAt < 600000)) {
                        try {
                            const url = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/delete_by_token`;
                            await fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                body: `token=${img.delete_token}`
                            });
                        } catch (e) {
                            console.error("Cloudinary token delete failed", e);
                        }
                    }

                    job.properties.images.splice(idx, 1);
                    renderImageGallery(job.properties.images, true);
                    Swal.fire({ toast: true, icon: 'success', title: 'ลบรูปถ่ายแล้ว', timer: 1500, showConfirmButton: false });
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
        window.doExport = doExport;
        window.triggerCamera = triggerCamera;
        window.handleImageUpload = handleImageUpload;
        window.saveCloudinarySettings = saveCloudinarySettings;
        window.openSheetFromSearch = openSheetFromSearch;
