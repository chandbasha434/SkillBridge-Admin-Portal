let editingOpportunityId = null;
let opportunitiesCache = {};
const captchas = { login:'', signup:'', forgot:'' };
function generateCaptcha(type) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    captchas[type] = code;
    document.getElementById(type + 'CaptchaText').textContent = code;
}
generateCaptcha('login'); generateCaptcha('signup'); generateCaptcha('forgot');

function showPage(pageId) {
    document.querySelectorAll('.form-page').forEach(p => p.classList.remove('active'));
    setTimeout(() => document.getElementById(pageId).classList.add('active'), 50);
    document.querySelectorAll('.error-msg').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('input').forEach(i => i.classList.remove('error'));
}
function togglePass(inputId, btn) {
    const input = document.getElementById(inputId);
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.innerHTML = isPass
        ? '<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}
function showError(id, msg) {
    const el = document.getElementById(id);
    if (msg) el.querySelector('span').textContent = msg;
    el.classList.add('show');
}
function clearAllErrors(formId) {
    document.querySelectorAll('#' + formId + ' .error-msg').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('#' + formId + ' input').forEach(i => i.classList.remove('error'));
}
function shakeForm(formId) {
    const form = document.getElementById(formId);
    form.classList.add('shake');
    setTimeout(() => form.classList.remove('shake'), 400);
}
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function showToast(msg) {
    document.getElementById('toastMsg').textContent = msg;
    document.getElementById('toast').classList.add('show');
    setTimeout(() => document.getElementById('toast').classList.remove('show'), 5000);
}
function checkStrength(val) {
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const labels = ['','Weak','Medium','Strong','Very Strong'];
    const classes = ['','weak','medium','strong','very-strong'];
    for (let i = 1; i <= 4; i++) {
        const bar = document.getElementById('str' + i);
        bar.className = 'strength-bar';
        if (i <= score) bar.classList.add(classes[score]);
    }
    document.getElementById('strengthLabel').textContent = val.length > 0 ? labels[score] : '';
}
function showDashboard(email, name) {
    document.getElementById('authWrapper').style.display = 'none';
    document.getElementById('dashboardWrapper').classList.add('active');
    document.body.style.alignItems = 'stretch';
    const displayName = name || (email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1));
    document.getElementById('dashName').textContent = displayName;
    document.getElementById('dashAvatar').textContent = displayName.substring(0, 2).toUpperCase();
    if (window.innerWidth <= 768) document.getElementById('menuToggle').style.display = 'flex';
    loadOpportunities();
}
function handleLogout() {
    fetch('/api/auth/logout', { method: 'POST' })
        .finally(() => {
            document.getElementById('dashboardWrapper').classList.remove('active');
            document.getElementById('authWrapper').style.display = 'flex';
            document.body.style.alignItems = '';
            showToast('Signed out successfully');
            showPage('loginPage');
        });
}
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', function() {
        const page = this.getAttribute('data-page');
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
        const map = { dashboard:'dashboardSection', learner:'learnerSection', verifier:'verifierSection',
            collaborator:'collaboratorSection', opportunity:'opportunitySection', reports:'reportsSection' };
        const titles = { dashboard:'Dashboard', learner:'Learner Management', verifier:'Verifier Management',
            collaborator:'Collaborator Management', opportunity:'Opportunity Management', reports:'Reports and Analytics' };
        if (map[page]) document.getElementById(map[page]).classList.add('active');
        document.getElementById('pageTitle').textContent = titles[page] || '';
    });
});
function changeChartPeriod(period) {
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase() === period) btn.classList.add('active');
    });
    const chartData = {
        daily:'M0,120 Q50,110 100,90 T200,70 T300,50 T400,40',
        weekly:'M0,110 Q50,95 100,85 T200,65 T300,45 T400,35',
        monthly:'M0,100 Q50,85 100,75 T200,55 T300,40 T400,30',
        quarterly:'M0,90 Q50,75 100,65 T200,50 T300,35 T400,25',
        yearly:'M0,80 Q50,65 100,55 T200,40 T300,30 T400,20'
    };
    const path = chartData[period];
    document.getElementById('linePath').setAttribute('d', path);
    document.getElementById('lineArea').setAttribute('d', path + ' L400,150 L0,150 Z');
}
function toggleNotifications() { document.getElementById('notificationDropdown').classList.toggle('active'); }
function markAllRead() {
    document.querySelectorAll('.notif-item.unread').forEach(item => item.classList.remove('unread'));
    showToast('All notifications marked as read');
}
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('notificationDropdown');
    const btn = document.getElementById('notifBtn');
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) dropdown.classList.remove('active');
});
function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    const icon = document.getElementById('themeIcon');
    icon.innerHTML = newTheme === 'dark'
        ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
        : '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
}
function openSearch() { document.getElementById('searchContainer').classList.add('active'); document.getElementById('searchInput').focus(); }
function closeSearch() { document.getElementById('searchContainer').classList.remove('active'); }
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeSearch(); closeCourseModal(); closeOpportunityModal(); closeOpportunityDetailsModal();
        closeCollaboratorCoursesModal(); closeQuickAddModal(); closeBulkUploadModal();
        closeQuickAddVerifierModal(); closeBulkUploadVerifierModal(); closeVerifierDetailsModal();
    }
});
document.getElementById('searchContainer').addEventListener('click', function(e) { if (e.target === this) closeSearch(); });
function openCourseDetails(courseName, stats) {
    document.getElementById('modalCourseTitle').textContent = courseName;
    document.getElementById('modalEnrolled').textContent = stats.enrolled;
    document.getElementById('modalCompleted').textContent = stats.completed;
    document.getElementById('modalInProgress').textContent = stats.inProgress;
    document.getElementById('modalHalfDone').textContent = stats.halfDone;
    document.getElementById('courseModal').classList.add('active');
}
function closeCourseModal() { document.getElementById('courseModal').classList.remove('active'); }
document.getElementById('courseModal').addEventListener('click', function(e) { if (e.target === this) closeCourseModal(); });
function openOpportunityDetails(title, details) {
    document.getElementById('opportunityDetailTitle').textContent = title;
    document.getElementById('opportunityDetailDuration').textContent = details.duration;
    document.getElementById('opportunityDetailStartDate').textContent = details.startDate;
    document.getElementById('opportunityDetailApplicants').textContent = details.applicants;
    document.getElementById('opportunityDetailDescription').textContent = details.description;
    document.getElementById('opportunityDetailFuture').textContent = details.futureOpportunities;
    document.getElementById('opportunityDetailPrereqs').textContent = details.prerequisites;
    const sc = document.getElementById('opportunityDetailSkills');
    sc.innerHTML = '';
    details.skills.forEach(skill => { const t = document.createElement('span'); t.className = 'skill-tag'; t.textContent = skill; sc.appendChild(t); });
    document.getElementById('opportunityDetailsModal').classList.add('active');
}
function closeOpportunityDetailsModal() { document.getElementById('opportunityDetailsModal').classList.remove('active'); }
function applyToOpportunity() { showToast('Application submitted successfully!'); closeOpportunityDetailsModal(); }
document.getElementById('opportunityDetailsModal').addEventListener('click', function(e) { if (e.target === this) closeOpportunityDetailsModal(); });
function openCollaboratorCourses(name, role) {
    document.getElementById('collaboratorName').textContent = name + "'s Submitted Courses";
    document.getElementById('collaboratorRole').textContent = 'Role: ' + role;
    document.getElementById('collaboratorCoursesModal').classList.add('active');
}
function closeCollaboratorCoursesModal() { document.getElementById('collaboratorCoursesModal').classList.remove('active'); }
function approveCourse(n) { showToast(n + ' has been approved!'); }
function rejectCourse(n) { showToast(n + ' has been rejected.'); }
function viewCourseDetails(n) { showToast('Viewing details for ' + n); }
document.getElementById('collaboratorCoursesModal').addEventListener('click', function(e) { if (e.target === this) closeCollaboratorCoursesModal(); });
function openOpportunityModal() {
    editingOpportunityId = null;
    document.querySelector('#opportunityModal h3').textContent = 'Add New Opportunity';
    document.getElementById('opportunityForm').reset();
    document.getElementById('opportunityModal').classList.add('active');
}
function closeOpportunityModal() { document.getElementById('opportunityModal').classList.remove('active'); }
document.getElementById('opportunityModal').addEventListener('click', function(e) { if (e.target === this) closeOpportunityModal(); });
document.getElementById('opportunityForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('oppName').value.trim();
    const duration = document.getElementById('oppDuration').value.trim();
    const start_date = document.getElementById('oppStartDate').value;
    const description = document.getElementById('oppDescription').value.trim();
    const skills = document.getElementById('oppSkills').value.trim();
    const category = document.getElementById('oppCategory').value;
    const future_opportunities = document.getElementById('oppFuture').value.trim();
    const max_applicants = document.getElementById('oppMaxApplicants').value.trim();
    if (!name || !duration || !start_date || !description || !skills || !category || !future_opportunities) {
        showToast('Please fill all required fields'); return;
    }
    const method = editingOpportunityId ? 'PUT' : 'POST';
    const url = editingOpportunityId ? '/api/opportunities/' + editingOpportunityId : '/api/opportunities';
    fetch(url, { method, headers: {'Content-Type':'application/json'},
        body: JSON.stringify({name, duration, start_date, description, skills, category, future_opportunities, max_applicants: max_applicants || null})
    })
    .then(r => r.json().then(d => ({ok: r.ok, data: d})))
    .then(({ok, data}) => {
        if (!ok) { showToast(data.error || 'Error saving opportunity'); return; }
        showToast(editingOpportunityId ? 'Opportunity updated!' : 'Opportunity created!');
        closeOpportunityModal(); this.reset(); loadOpportunities();
    })
    .catch(() => showToast('Network error. Please try again.'));
});
function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function openQuickAddModal() { document.getElementById('quickAddModal').classList.add('active'); }
function closeQuickAddModal() { document.getElementById('quickAddModal').classList.remove('active'); }
document.getElementById('quickAddModal').addEventListener('click', function(e) { if (e.target === this) closeQuickAddModal(); });
document.getElementById('quickAddForm').addEventListener('submit', function(e) {
    e.preventDefault(); showToast('Student added successfully! Email invitation sent.'); closeQuickAddModal(); this.reset();
});
function openBulkUploadModal() { document.getElementById('bulkUploadModal').classList.add('active'); }
function closeBulkUploadModal() { document.getElementById('bulkUploadModal').classList.remove('active'); }
document.getElementById('bulkUploadModal').addEventListener('click', function(e) { if (e.target === this) closeBulkUploadModal(); });
document.getElementById('bulkUploadForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (document.getElementById('csvFileInput').files.length === 0) { showToast('Please select a CSV file'); return; }
    showToast('Students uploaded successfully! Email invitations sent.'); closeBulkUploadModal(); this.reset();
    document.getElementById('fileName').textContent = '';
});
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) document.getElementById('fileName').textContent = '✓ Selected: ' + file.name;
}
function downloadSampleCSV() {
    const blob = new Blob(['First Name,Last Name,Email\nJohn,Doe,john.doe@example.com'], {type:'text/csv'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sample_students.csv'; a.click();
    window.URL.revokeObjectURL(url);
}
function openQuickAddVerifierModal() { document.getElementById('quickAddVerifierModal').classList.add('active'); }
function closeQuickAddVerifierModal() { document.getElementById('quickAddVerifierModal').classList.remove('active'); }
document.getElementById('quickAddVerifierModal').addEventListener('click', function(e) { if (e.target === this) closeQuickAddVerifierModal(); });
document.getElementById('quickAddVerifierForm').addEventListener('submit', function(e) {
    e.preventDefault(); showToast('Verifier added successfully! Email invitation sent.'); closeQuickAddVerifierModal(); this.reset();
});
function openBulkUploadVerifierModal() { document.getElementById('bulkUploadVerifierModal').classList.add('active'); }
function closeBulkUploadVerifierModal() { document.getElementById('bulkUploadVerifierModal').classList.remove('active'); }
document.getElementById('bulkUploadVerifierModal').addEventListener('click', function(e) { if (e.target === this) closeBulkUploadVerifierModal(); });
document.getElementById('bulkUploadVerifierForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (document.getElementById('csvVerifierFileInput').files.length === 0) { showToast('Please select a CSV file'); return; }
    showToast('Verifiers uploaded successfully! Email invitations sent.'); closeBulkUploadVerifierModal(); this.reset();
    document.getElementById('verifierFileName').textContent = '';
});
function handleVerifierFileSelect(event) {
    const file = event.target.files[0];
    if (file) document.getElementById('verifierFileName').textContent = '✓ Selected: ' + file.name;
}
function downloadSampleVerifierCSV() {
    const blob = new Blob(['First Name,Last Name,Email,Subject\nDr. John,Doe,john.doe@qf.edu.qa,Mathematics'], {type:'text/csv'});
    const url = window.URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'sample_verifiers.csv'; a.click(); window.URL.revokeObjectURL(url);
}
function openVerifierDetails(name, stats) {
    document.getElementById('verifierName').textContent = name;
    document.getElementById('verifierTotalStudents').textContent = stats.totalStudents;
    document.getElementById('verifierCertified').textContent = stats.certified;
    document.getElementById('verifierInProgress').textContent = stats.inProgress;
    const container = document.getElementById('subjectsContainer'); container.innerHTML = '';
    stats.subjects.forEach(subject => {
        const div = document.createElement('div'); div.className = 'subject-item';
        div.innerHTML = `<span class="subject-name">${subject.name}</span><span class="subject-students">${subject.students} students</span>`;
        container.appendChild(div);
    });
    document.getElementById('verifierDetailsModal').classList.add('active');
}
function closeVerifierDetailsModal() { document.getElementById('verifierDetailsModal').classList.remove('active'); }
document.getElementById('verifierDetailsModal').addEventListener('click', function(e) { if (e.target === this) closeVerifierDetailsModal(); });
function filterStudents() {
    const statusFilter = document.getElementById('statusFilter').value;
    document.querySelectorAll('#studentsTableBody tr').forEach(row => {
        row.style.display = (statusFilter === 'all' || row.getAttribute('data-status') === statusFilter) ? '' : 'none';
    });
}
function filterVerifiers() {
    const statusFilter = document.getElementById('verifierStatusFilter').value;
    document.querySelectorAll('#verifiersTableBody tr').forEach(row => {
        row.style.display = (statusFilter === 'all' || row.getAttribute('data-status') === statusFilter) ? '' : 'none';
    });
}
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    clearAllErrors('loginForm');
    let valid = true;
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const captchaInput = document.getElementById('loginCaptchaInput').value.trim();
    const rememberMe = document.querySelector('#loginForm .remember-me input').checked;
    if (!email || !isValidEmail(email)) { showError('loginEmailErr'); document.getElementById('loginEmail').classList.add('error'); valid = false; }
    if (!password) { showError('loginPasswordErr','Please enter your password'); document.getElementById('loginPassword').classList.add('error'); valid = false; }
    if (!captchaInput) { showError('loginCaptchaErr','Please enter the captcha code'); valid = false; }
    else if (captchaInput !== captchas.login) { showError('loginCaptchaErr','Captcha does not match. Please try again.'); valid = false; generateCaptcha('login'); }
    if (!valid) { shakeForm('loginForm'); return; }
    fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({email, password, remember_me: rememberMe}) })
    .then(r => r.json().then(d => ({ok: r.ok, data: d})))
    .then(({ok, data}) => {
        if (!ok) {
            showError('loginEmailErr', data.error || 'Invalid email or password');
            document.getElementById('loginEmail').classList.add('error');
            shakeForm('loginForm'); generateCaptcha('login'); return;
        }
        showToast('Login successful! Redirecting...');
        setTimeout(() => showDashboard(data.admin.email, data.admin.name), 1200);
        generateCaptcha('login');
    })
    .catch(() => showToast('Network error. Please try again.'));
});
document.getElementById('signupForm').addEventListener('submit', function(e) {
    e.preventDefault();
    clearAllErrors('signupForm');
    let valid = true;
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    const confirmPassword = document.getElementById('signupConfirmPassword').value.trim();
    const captchaInput = document.getElementById('signupCaptchaInput').value.trim();
    if (!name) { showError('signupNameErr'); document.getElementById('signupName').classList.add('error'); valid = false; }
    if (!email || !isValidEmail(email)) { showError('signupEmailErr'); document.getElementById('signupEmail').classList.add('error'); valid = false; }
    if (!password || password.length < 8) { showError('signupPasswordErr'); document.getElementById('signupPassword').classList.add('error'); valid = false; }
    if (!confirmPassword || password !== confirmPassword) { showError('signupConfirmPasswordErr'); document.getElementById('signupConfirmPassword').classList.add('error'); valid = false; }
    if (!captchaInput) { showError('signupCaptchaErr','Please enter the captcha code'); valid = false; }
    else if (captchaInput !== captchas.signup) { showError('signupCaptchaErr','Captcha does not match.'); valid = false; generateCaptcha('signup'); }
    if (!valid) { shakeForm('signupForm'); return; }
    fetch('/api/auth/signup', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({name, email, password, confirm_password: confirmPassword}) })
    .then(r => r.json().then(d => ({ok: r.ok, data: d})))
    .then(({ok, data}) => {
        if (!ok) {
            showError('signupEmailErr', data.error || 'Signup failed');
            document.getElementById('signupEmail').classList.add('error');
            shakeForm('signupForm'); return;
        }
        showToast('Account created successfully!');
        generateCaptcha('signup'); this.reset(); checkStrength('');
        setTimeout(() => showPage('loginPage'), 1500);
    })
    .catch(() => showToast('Network error. Please try again.'));
});
document.getElementById('forgotForm').addEventListener('submit', function(e) {
    e.preventDefault();
    clearAllErrors('forgotForm');
    let valid = true;
    const email = document.getElementById('forgotEmail').value.trim();
    const captchaInput = document.getElementById('forgotCaptchaInput').value.trim();
    if (!email || !isValidEmail(email)) { showError('forgotEmailErr'); document.getElementById('forgotEmail').classList.add('error'); valid = false; }
    if (!captchaInput) { showError('forgotCaptchaErr','Please enter the captcha code'); valid = false; }
    else if (captchaInput !== captchas.forgot) { showError('forgotCaptchaErr','Captcha does not match.'); valid = false; generateCaptcha('forgot'); }
    if (!valid) { shakeForm('forgotForm'); return; }
    fetch('/api/auth/forgot-password', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({email}) })
    .then(() => { showToast('Reset link sent to your email!'); generateCaptcha('forgot'); this.reset(); })
    .catch(() => showToast('Network error. Please try again.'));
});
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
        this.classList.remove('error');
        const err = this.closest('.form-group')?.querySelector('.error-msg');
        if (err) err.classList.remove('show');
    });
});
window.addEventListener('resize', () => {
    const toggle = document.getElementById('menuToggle');
    if (toggle) toggle.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
});
// ===== OPPORTUNITY API FUNCTIONS =====
function loadOpportunities() {
    const grid = document.querySelector('.opportunities-grid');
    if (!grid) return;
    fetch('/api/opportunities')
        .then(r => r.json().then(d => ({ok: r.ok, data: d})))
        .then(({ok, data}) => {
            if (!ok) return;
            opportunitiesCache = {};
            data.forEach(opp => { opportunitiesCache[opp.id] = opp; });
            grid.innerHTML = '';
            if (data.length === 0) {
                grid.innerHTML = '<p style="color:var(--qf-text-light);padding:32px;text-align:center;grid-column:1/-1;">No opportunities created yet. Click \'Add New Opportunity\' to get started.</p>';
                return;
            }
            data.forEach(opp => grid.appendChild(renderOpportunityCard(opp)));
        })
        .catch(() => {});
}
function renderOpportunityCard(opp) {
    const skills = Array.isArray(opp.skills) ? opp.skills : opp.skills.split(',').map(s => s.trim());
    const card = document.createElement('div');
    card.className = 'opportunity-card';
    card.dataset.id = opp.id;
    const skillTags = skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('');
    card.innerHTML = `
        <div class="opportunity-card-header">
            <h5>${escapeHtml(opp.name)}</h5>
            <div class="opportunity-meta">
                <span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${escapeHtml(opp.duration)}</span>
                <span><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${escapeHtml(opp.start_date)}</span>
            </div>
        </div>
        <p class="opportunity-description">${escapeHtml(opp.description)}</p>
        <div class="opportunity-skills">
            <div class="opportunity-skills-label">Skills You'll Gain</div>
            <div class="skills-tags">${skillTags}</div>
        </div>
        <div class="opportunity-footer">
            <span class="applicants-count">${opp.max_applicants ? opp.max_applicants + ' max applicants' : '0 applicants'}</span>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="view-course-btn" style="width:auto;padding:8px 12px;" onclick="openOpportunityDetailsById(${opp.id})">View Details</button>
                <button class="view-course-btn" style="width:auto;padding:8px 12px;background:#3b82f6;" onclick="openEditOpportunityModal(${opp.id})">Edit</button>
                <button class="view-course-btn" style="width:auto;padding:8px 12px;background:#e53e3e;" onclick="deleteOpportunity(${opp.id})">Delete</button>
            </div>
        </div>`;
    return card;
}
function openOpportunityDetailsById(id) {
    const opp = opportunitiesCache[id];
    if (!opp) return;
    openOpportunityDetails(opp.name, {
        duration: opp.duration, startDate: opp.start_date, description: opp.description,
        skills: Array.isArray(opp.skills) ? opp.skills : opp.skills.split(',').map(s => s.trim()),
        applicants: opp.max_applicants || 0, futureOpportunities: opp.future_opportunities, prerequisites: ''
    });
}
function openEditOpportunityModal(id) {
    const opp = opportunitiesCache[id];
    if (!opp) return;
    editingOpportunityId = id;
    document.querySelector('#opportunityModal h3').textContent = 'Edit Opportunity';
    document.getElementById('oppName').value = opp.name;
    document.getElementById('oppDuration').value = opp.duration;
    document.getElementById('oppStartDate').value = opp.start_date;
    document.getElementById('oppDescription').value = opp.description;
    document.getElementById('oppSkills').value = Array.isArray(opp.skills) ? opp.skills.join(', ') : opp.skills;
    document.getElementById('oppCategory').value = opp.category;
    document.getElementById('oppFuture').value = opp.future_opportunities;
    document.getElementById('oppMaxApplicants').value = opp.max_applicants || '';
    document.getElementById('opportunityModal').classList.add('active');
}
function deleteOpportunity(id) {
    if (!confirm('Delete this opportunity? This cannot be undone.')) return;
    fetch('/api/opportunities/' + id, {method: 'DELETE'})
        .then(r => r.json().then(d => ({ok: r.ok, data: d})))
        .then(({ok, data}) => {
            if (!ok) { showToast(data.error || 'Delete failed'); return; }
            delete opportunitiesCache[id];
            const card = document.querySelector('.opportunity-card[data-id="' + id + '"]');
            if (card) card.remove();
            const grid = document.querySelector('.opportunities-grid');
            if (grid && !grid.querySelector('.opportunity-card')) {
                grid.innerHTML = '<p style="color:var(--qf-text-light);padding:32px;text-align:center;grid-column:1/-1;">No opportunities created yet. Click \'Add New Opportunity\' to get started.</p>';
            }
            showToast('Opportunity deleted successfully.');
        })
        .catch(() => showToast('Network error. Please try again.'));
}
// ===== AUTO LOGIN IF SESSION ACTIVE =====
fetch('/api/auth/me')
    .then(r => r.json().then(d => ({ok: r.ok, data: d})))
    .then(({ok, data}) => { if (ok) showDashboard(data.admin.email, data.admin.name); })
    .catch(() => {});
