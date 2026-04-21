import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const SUPER_ADMIN_EMAIL = 'pabitramondal2635@gmail.com';

const SUPER_ADMINS = [
    'pabitramondal2635@gmail.com',
    'sujata232005@gmail.com',
    'subhadeep0897@gmail.com'
];

const ADMIN_NAMES = {
    'pabitramondal2635@gmail.com': 'Pabitra',
    'sujata232005@gmail.com': 'Sujata',
    'subhadeep0897@gmail.com': 'Subhadeep'
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'falconix-crm';

const firebaseConfig = {
    apiKey: "AIzaSyBLhHBKVBY57_KLrT9IpQ9o7alYlEioovA",
    authDomain: "falconixdigitalbusiness.firebaseapp.com",
    projectId: "falconixdigitalbusiness",
    storageBucket: "falconixdigitalbusiness.firebasestorage.app",
    messagingSenderId: "835356453879",
    appId: "1:835356453879:web:b321312b9b9e0881b35cf2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let currentUser = null;
let isSuperAdminUser = false;
let clientsList = [];
let requestsList = [];
let unsubscribeClients = null;
let unsubscribeRequests = null;

let currentPage = 1;
const ITEMS_PER_PAGE = 15;

let revenueChartInstance = null;
let sourceChartInstance = null;

const loginWrapper = document.getElementById('login-wrapper');
const appWrapper = document.getElementById('app-wrapper');
const globalLoader = document.getElementById('global-loader');
const loggedInEmailText = document.getElementById('logged-in-email');
const googleLoginBtn = document.getElementById('google-login-btn');
const loginError = document.getElementById('login-error');

const defaultBtnHtml = googleLoginBtn.innerHTML;

async function checkIfAdmin(email) {
    const lowerEmail = email.toLowerCase();
    if (SUPER_ADMINS.includes(lowerEmail)) return true;
    try {
        const adminsRef = collection(db, 'artifacts', appId, 'public', 'data', 'admins');
        const snapshot = await getDocs(adminsRef);
        let foundAdmin = false;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.email && data.email.toLowerCase() === lowerEmail) {
                foundAdmin = true;
            }
        });
        return foundAdmin;
    } catch (error) {
        return false; 
    }
}

googleLoginBtn.addEventListener('click', async () => {
    loginError.classList.add('hidden');
    googleLoginBtn.innerHTML = '<i class="ph ph-spinner animate-spin text-lg"></i> Authenticating...';
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const isAdmin = await checkIfAdmin(user.email);
        if (!isAdmin) {
            await signOut(auth);
            loginError.innerText = "Access Denied: Email not authorized as Admin.";
            loginError.classList.remove('hidden');
        }
    } catch (error) {
        loginError.innerText = "Login process was cancelled or failed.";
        loginError.classList.remove('hidden');
    } finally {
        if (!currentUser) {
            googleLoginBtn.innerHTML = defaultBtnHtml;
        }
    }
});

window.showLogoutModal = function() {
    document.getElementById('logout-modal').classList.remove('hidden');
};

window.hideLogoutModal = function() {
    document.getElementById('logout-modal').classList.add('hidden');
};

window.confirmLogout = async function() {
    hideLogoutModal();
    await signOut(auth);
};

function getTimeBasedGreetings(name) {
    const hour = new Date().getHours();
    let timeGreeting = '';
    let emoji = '';
    if (hour >= 5 && hour < 12) {
        timeGreeting = 'Good morning';
        emoji = '🌅';
    } else if (hour >= 12 && hour < 17) {
        timeGreeting = 'Good afternoon';
        emoji = '☀️';
    } else if (hour >= 17 && hour < 21) {
        timeGreeting = 'Good evening';
        emoji = '🌇';
    } else {
        timeGreeting = 'Good night';
        emoji = '🌙';
    }
    return [
        { text: `${timeGreeting}, ${name}!`, emoji: emoji },
        { text: `Welcome back, ${name}!`, emoji: '👋' },
        { text: `Nice to see you working today!`, emoji: '💻' },
        { text: `Let's manage your clients`, emoji: '✨' },
        { text: `Have a wonderful day!`, emoji: '🌟' },
        { text: `Ready to crush your goals?`, emoji: '💪' },
        { text: `Let's grow your agency!`, emoji: '📈' },
        { text: `Hope you're having a productive day!`, emoji: '💼' },
        { text: `You're doing great!`, emoji: '🏆' },
        { text: `Have a great day ahead!`, emoji: '🚀' }
    ];
}

let typewriterTimeout;
function startContinuousTypewriter(name) {
    const phrases = getTimeBasedGreetings(name);
    const el = document.getElementById('greeting-text');
    const emojiEl = document.getElementById('greeting-emoji');
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    const gradients = [
        "from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400",
        "from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400",
        "from-orange-600 via-amber-600 to-yellow-500 dark:from-orange-500 dark:via-amber-400 dark:to-yellow-300",
        "from-rose-600 via-pink-600 to-fuchsia-600 dark:from-rose-400 dark:via-pink-400 dark:to-fuchsia-400",
        "from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400"
    ];
    el.className = "font-bold bg-gradient-to-r text-transparent bg-clip-text " + gradients[0];
    function type() {
        const currentPhrase = phrases[phraseIndex];
        const fullText = currentPhrase.text;
        if (isDeleting) {
            el.innerText = fullText.substring(0, charIndex - 1);
            charIndex--;
            emojiEl.innerText = ''; 
        } else {
            el.innerText = fullText.substring(0, charIndex + 1);
            charIndex++;
            if (charIndex === fullText.length) {
                emojiEl.innerText = '\u00A0' + currentPhrase.emoji;
            }
        }
        let typingSpeed = isDeleting ? 30 : 70;
        if (!isDeleting && charIndex === fullText.length) {
            typingSpeed = 2500;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            typingSpeed = 500; 
            el.className = "font-bold bg-gradient-to-r text-transparent bg-clip-text " + gradients[phraseIndex % gradients.length];
        }
        typewriterTimeout = setTimeout(type, typingSpeed);
    }
    clearTimeout(typewriterTimeout);
    el.innerText = '';
    if (emojiEl) emojiEl.innerText = '';
    setTimeout(type, 300);
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const isAdmin = await checkIfAdmin(user.email);
        if (isAdmin) {
            currentUser = user;
            isSuperAdminUser = user.email.toLowerCase() === SUPER_ADMIN_EMAIL;
            loggedInEmailText.innerText = user.email;
            
            if (isSuperAdminUser) {
                document.getElementById('nav-requests').classList.remove('hidden');
                document.getElementById('nav-requests').classList.add('flex');
            } else {
                document.getElementById('nav-requests').classList.add('hidden');
                document.getElementById('nav-requests').classList.remove('flex');
            }

            loginWrapper.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                loginWrapper.classList.add('hidden');
                appWrapper.classList.remove('hidden');
                appWrapper.classList.add('flex');
                const defaultName = user.email.split('@')[0];
                const adminName = ADMIN_NAMES[user.email.toLowerCase()] || defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
                startContinuousTypewriter(adminName);
            }, 500);
            setupDatabaseListener();
        } else {
            await signOut(auth);
            loginError.innerText = "Unauthorized email detected. Session terminated.";
            loginError.classList.remove('hidden');
            googleLoginBtn.innerHTML = defaultBtnHtml;
        }
    } else {
        currentUser = null;
        isSuperAdminUser = false;
        if(unsubscribeClients) unsubscribeClients();
        if(unsubscribeRequests) unsubscribeRequests();
        appWrapper.classList.add('hidden');
        appWrapper.classList.remove('flex');
        loginWrapper.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
        googleLoginBtn.innerHTML = defaultBtnHtml;
    }
});

function setupDatabaseListener() {
    if (!currentUser) return;
    globalLoader.classList.remove('hidden');
    const clientsRef = collection(db, 'artifacts', appId, 'public', 'data', 'clients');
    unsubscribeClients = onSnapshot(clientsRef, (snapshot) => {
        clientsList = [];
        snapshot.forEach((doc) => {
            clientsList.push({ id: doc.id, ...doc.data() });
        });
        clientsList.sort((a, b) => b.createdAt - a.createdAt);
        updateDashboardStats();
        updateCharts();
        renderClientTable(true);
        globalLoader.classList.add('hidden');
    }, (error) => {
        showToast("Database sync error.", "error");
        globalLoader.classList.add('hidden');
    });

    if (isSuperAdminUser) {
        const reqsRef = collection(db, 'artifacts', appId, 'public', 'data', 'requests');
        unsubscribeRequests = onSnapshot(reqsRef, (snapshot) => {
            requestsList = [];
            snapshot.forEach(doc => {
                requestsList.push({ id: doc.id, ...doc.data() });
            });
            renderRequestsTable();
        });
    }
}

document.getElementById('client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const submitBtn = document.getElementById('form-submit-btn');
    const idField = document.getElementById('client-id').value;
    const isEditing = !!idField;
    const clientId = isEditing ? idField : crypto.randomUUID();

    submitBtn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> <span>Processing...</span>`;
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-70', 'cursor-not-allowed');

    const existingClient = isEditing ? clientsList.find(c => c.id === clientId) : null;
    const addedEmail = isEditing ? (existingClient?.addedByEmail || currentUser.email) : currentUser.email;
    const addedName = isEditing ? (existingClient?.addedByName || ADMIN_NAMES[currentUser.email.toLowerCase()] || currentUser.email.split('@')[0]) : (ADMIN_NAMES[currentUser.email.toLowerCase()] || currentUser.email.split('@')[0]);

    const clientData = {
        name: document.getElementById('form-name').value.trim(),
        business: document.getElementById('form-business').value.trim(),
        source: document.getElementById('form-source').value,
        phone: document.getElementById('form-phone').value.trim(),
        email: document.getElementById('form-email').value.trim(),
        website: document.getElementById('form-website').value,
        websiteUrl: document.getElementById('form-website-url').value.trim(),
        price: parseFloat(document.getElementById('form-price').value) || 0,
        advance: parseFloat(document.getElementById('form-advance').value) || 0,
        deadline: document.getElementById('form-deadline').value || null,
        status: document.getElementById('form-status').value,
        notes: document.getElementById('form-notes').value.trim(),
        createdAt: isEditing ? (existingClient?.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now(),
        addedByEmail: addedEmail,
        addedByName: addedName
    };

    try {
        if (isSuperAdminUser) {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', clientId);
            await setDoc(docRef, clientData);
            showToast(isEditing ? "Client updated successfully!" : "New client added successfully!", "success");
        } else {
            const reqId = crypto.randomUUID();
            const reqRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', reqId);
            await setDoc(reqRef, {
                type: isEditing ? 'UPDATE' : 'ADD',
                status: 'Pending',
                requestedByEmail: currentUser.email,
                requestedByName: ADMIN_NAMES[currentUser.email.toLowerCase()] || currentUser.email.split('@')[0],
                clientData: clientData,
                targetClientId: isEditing ? clientId : reqId,
                createdAt: Date.now()
            });
            showToast("Request sent to Super Admin for approval.", "success");
        }
        document.getElementById('client-form').reset();
        document.getElementById('client-id').value = "";
        document.getElementById('form-title').innerText = "Add New Client";
        navigate('client-list');
    } catch (error) {
        showToast("Failed to process action.", "error");
    } finally {
        submitBtn.innerHTML = isSuperAdminUser 
            ? '<i class="ph ph-floppy-disk text-lg"></i> <span>Save Client</span>' 
            : '<i class="ph ph-paper-plane-right text-lg"></i> <span>Send Request</span>';
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
});

window.exportToCSV = function() {
    if (clientsList.length === 0) {
        showToast("No clients available to export.", "error");
        return;
    }
    const headers = ["Name", "Phone", "Email", "Business Type", "Status", "Total Price", "Advance Paid", "Balance Due", "Deadline", "Source", "Website Category", "Website URL", "Notes", "Added By"];
    const escapeCSV = (val) => `"${(val || '').toString().replace(/"/g, '""')}"`;
    let csvContent = headers.join(",") + "\n";
    clientsList.forEach(c => {
        const balance = Math.max(0, (Number(c.price) || 0) - (Number(c.advance) || 0));
        const row = [
            escapeCSV(c.name),
            escapeCSV(c.phone),
            escapeCSV(c.email),
            escapeCSV(c.business),
            escapeCSV(c.status),
            c.price || 0,
            c.advance || 0,
            balance,
            escapeCSV(c.deadline),
            escapeCSV(c.source),
            escapeCSV(c.website),
            escapeCSV(c.websiteUrl),
            escapeCSV(c.notes),
            escapeCSV(c.addedByName || c.addedByEmail)
        ];
        csvContent += row.join(",") + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `falconix_clients_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV Exported successfully!", "success");
};

window.toggleMobileMenu = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
};

window.navigate = function(viewId, isEdit = false) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => {
        el.classList.remove('text-accentRed', 'bg-gray-200/80', 'dark:bg-gray-800/50');
        el.classList.add('text-gray-700', 'dark:text-gray-400');
    });
    document.getElementById(`view-${viewId}`).classList.add('active');
    const navBtn = document.getElementById(`nav-${viewId}`);
    if(navBtn) {
        navBtn.classList.remove('text-gray-700', 'dark:text-gray-400');
        navBtn.classList.add('text-accentRed', 'bg-gray-200/80', 'dark:bg-gray-800/50');
    }
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('mobile-overlay').classList.add('hidden');
    }
    if(viewId === 'add-client' && !isEdit) {
        document.getElementById('form-title').innerText = "Add New Client";
        document.getElementById('form-submit-btn').innerHTML = isSuperAdminUser 
            ? '<i class="ph ph-floppy-disk text-lg"></i> <span>Save Client</span>' 
            : '<i class="ph ph-paper-plane-right text-lg"></i> <span>Send Request</span>';
        document.getElementById('client-id').value = "";
        document.getElementById('client-form').reset();
    }
    if(viewId === 'client-list' || viewId === 'dashboard') {
        renderClientTable(true);
    }
    if(viewId === 'requests') {
        renderRequestsTable();
    }
};

window.toggleTheme = function() {
    const html = document.documentElement;
    const themeText = document.getElementById('theme-text');
    const themeIcon = document.getElementById('theme-icon');
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        themeText.innerText = 'Dark Mode';
        themeIcon.classList.replace('ph-sun', 'ph-moon');
    } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        themeText.innerText = 'Light Mode';
        themeIcon.classList.replace('ph-moon', 'ph-sun');
    }
    setTimeout(() => {
        if(clientsList.length > 0) updateCharts();
    }, 50);
};

if (localStorage.getItem('theme') === 'light') {
    document.documentElement.classList.remove('dark');
    document.getElementById('theme-text').innerText = 'Dark Mode';
    document.getElementById('theme-icon').classList.replace('ph-sun', 'ph-moon');
} else {
    document.getElementById('theme-icon').classList.replace('ph-moon', 'ph-sun');
    document.getElementById('theme-text').innerText = 'Light Mode';
}

window.editClient = function(id) {
    const client = clientsList.find(c => c.id === id);
    if(!client) return;
    closeModal();
    navigate('add-client', true);
    document.getElementById('client-id').value = client.id;
    document.getElementById('form-name').value = client.name;
    document.getElementById('form-business').value = client.business;
    document.getElementById('form-source').value = client.source || 'Referral';
    document.getElementById('form-phone').value = client.phone;
    document.getElementById('form-email').value = client.email;
    document.getElementById('form-website').value = client.website;
    document.getElementById('form-website-url').value = client.websiteUrl || '';
    document.getElementById('form-price').value = client.price || '';
    document.getElementById('form-advance').value = client.advance || '';
    document.getElementById('form-deadline').value = client.deadline || '';
    document.getElementById('form-status').value = client.status;
    document.getElementById('form-notes').value = client.notes;
    document.getElementById('form-title').innerText = "Edit Client Details";
    document.getElementById('form-submit-btn').innerHTML = isSuperAdminUser 
        ? '<i class="ph ph-floppy-disk text-lg"></i> <span>Update Client</span>'
        : '<i class="ph ph-paper-plane-right text-lg"></i> <span>Send Update Request</span>';
};

function getStatusBadge(status) {
    switch(status) {
        case 'Pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 border border-yellow-300 dark:border-yellow-800';
        case 'Active': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500 border border-blue-300 dark:border-blue-800';
        case 'Completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500 border border-green-300 dark:border-green-800';
        case 'Cancelled': return 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border border-gray-300 dark:border-gray-700';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-700';
    }
}

function updateDashboardStats() {
    document.getElementById('stat-total-clients').innerText = clientsList.length;
    document.getElementById('stat-active-projects').innerText = clientsList.filter(c => c.status === 'Active').length;
    document.getElementById('stat-completed-projects').innerText = clientsList.filter(c => c.status === 'Completed').length;
    const totalProfit = clientsList.filter(client => client.status === 'Completed').reduce((sum, client) => sum + (Number(client.price) || 0), 0);
    const totalPendingPayments = clientsList.filter(client => client.status !== 'Completed' && client.status !== 'Cancelled').reduce((sum, client) => sum + Math.max(0, (Number(client.price) || 0) - (Number(client.advance) || 0)), 0);
    const formattedProfit = '₹' + totalProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    const formattedPending = '₹' + totalPendingPayments.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    const profitEl = document.getElementById('stat-total-profit');
    profitEl.innerText = formattedProfit;
    profitEl.title = formattedProfit; 
    const pendingEl = document.getElementById('stat-pending-payments');
    pendingEl.innerText = formattedPending;
    pendingEl.title = formattedPending;
    const recentBody = document.getElementById('recent-clients-tbody');
    recentBody.innerHTML = '';
    clientsList.slice(0, 5).forEach(client => {
        const canEdit = isSuperAdminUser || client.addedByEmail === currentUser.email;
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-100/50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer border-b border-gray-200 dark:border-gray-800/50 last:border-0";
        tr.onclick = () => openModal(client.id);
        const balance = Math.max(0, (Number(client.price) || 0) - (Number(client.advance) || 0));
        let financeHtml = `<div>
            <p class="font-medium text-gray-900 dark:text-gray-200 text-sm md:text-base">₹${(client.price || 0).toLocaleString('en-IN')}</p>
            ${client.status === 'Completed' || balance <= 0 ? `<p class="text-[10px] md:text-xs text-green-600 dark:text-green-500 font-medium">Fully Paid</p>` : `<p class="text-[10px] md:text-xs text-accentRed font-medium">Bal: ₹${balance.toLocaleString('en-IN')}</p>`}
        </div>`;
        let editBtnHtml = canEdit ? `<button onclick="event.stopPropagation(); editClient('${client.id}')" class="text-gray-500 dark:text-gray-400 hover:text-accentRed dark:hover:text-accentRed transition-colors p-1 md:p-2"><i class="ph ph-pencil-simple text-base md:text-lg"></i></button>` : '';
        tr.innerHTML = `
            <td class="p-3 md:p-4">
                <p class="font-medium text-gray-900 dark:text-gray-200">${client.name}</p>
                <p class="text-[10px] md:text-xs text-gray-600 dark:text-gray-500">${client.phone}</p>
            </td>
            <td class="p-3 md:p-4 text-xs md:text-sm text-gray-700 dark:text-gray-300">${client.business || '-'}</td>
            <td class="p-3 md:p-4">${financeHtml}</td>
            <td class="p-3 md:p-4">
                <span class="px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium ${getStatusBadge(client.status)}">${client.status}</span>
            </td>
            <td class="p-3 md:p-4 text-right">
                ${editBtnHtml}
            </td>
        `;
        recentBody.appendChild(tr);
    });
    const deadlinesContainer = document.getElementById('upcoming-deadlines-list');
    deadlinesContainer.innerHTML = '';
    const nowTime = new Date().setHours(0,0,0,0);
    const upcoming = clientsList.filter(c => (c.status === 'Pending' || c.status === 'Active') && c.deadline).sort((a,b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 5);
    if(upcoming.length === 0) {
        deadlinesContainer.innerHTML = '<div class="flex-1 flex flex-col items-center justify-center text-center py-4"><i class="ph ph-check-circle text-3xl text-green-500 mb-2"></i><p class="text-sm text-gray-600 dark:text-gray-400">No active deadlines!<br>You are all caught up.</p></div>';
    } else {
        upcoming.forEach(client => {
            const d = new Date(client.deadline);
            const diffDays = Math.ceil((d - nowTime) / (1000 * 60 * 60 * 24));
            let colorClass = 'text-gray-600 dark:text-gray-400';
            let iconClass = 'text-gray-500 dark:text-gray-400';
            if(diffDays < 0) { 
                colorClass = 'text-red-600 dark:text-red-500 font-bold'; 
                iconClass = 'text-red-600 dark:text-red-500'; 
            } else if(diffDays <= 3) { 
                colorClass = 'text-orange-600 dark:text-orange-500 font-bold'; 
                iconClass = 'text-orange-600 dark:text-orange-500'; 
            }
            deadlinesContainer.innerHTML += `
                <div class="bg-white/60 dark:bg-gray-800/50 p-3 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-300 dark:border-gray-800/50" onclick="openModal('${client.id}')">
                    <div class="flex justify-between items-start mb-1">
                        <p class="font-semibold text-sm text-gray-900 dark:text-gray-200 truncate pr-2">${client.name}</p>
                        <div class="flex items-center gap-1 text-[11px] md:text-xs shrink-0 ${colorClass}">
                            <i class="ph ph-clock ${iconClass}"></i>
                            <span>${d.toLocaleDateString('en-IN', {day:'numeric', month:'short'})}</span>
                        </div>
                    </div>
                    <p class="text-xs text-gray-600 dark:text-gray-500 truncate">${client.business || 'N/A'}</p>
                </div>
            `;
        });
    }
}

function updateCharts() {
    if (!document.getElementById('revenueChart')) return;
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#9ca3af' : '#4b5563';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)';
    const last6Months = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        let d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push({
            label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
            month: d.getMonth(),
            year: d.getFullYear(),
            revenue: 0
        });
    }
    const sourcesMap = {};
    clientsList.forEach(client => {
        const src = client.source || 'Referral';
        sourcesMap[src] = (sourcesMap[src] || 0) + 1;
        if (client.status === 'Completed' && client.createdAt) {
            const d = new Date(client.createdAt);
            const m = d.getMonth();
            const y = d.getFullYear();
            const monthObj = last6Months.find(lm => lm.month === m && lm.year === y);
            if (monthObj) {
                monthObj.revenue += (Number(client.price) || 0);
            }
        }
    });
    const ctxRev = document.getElementById('revenueChart').getContext('2d');
    if (revenueChartInstance) revenueChartInstance.destroy();
    revenueChartInstance = new Chart(ctxRev, {
        type: 'bar',
        data: {
            labels: last6Months.map(m => m.label),
            datasets: [{
                label: 'Revenue (₹)',
                data: last6Months.map(m => m.revenue),
                backgroundColor: '#ff1a1a',
                borderRadius: 6,
                hoverBackgroundColor: '#cc0000',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '₹' + context.parsed.y.toLocaleString('en-IN');
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: gridColor }, 
                    ticks: { 
                        color: textColor,
                        callback: function(value) { return '₹' + value.toLocaleString('en-IN'); }
                    },
                    border: { display: false }
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: textColor },
                    border: { display: false }
                }
            }
        }
    });
    const ctxSrc = document.getElementById('sourceChart').getContext('2d');
    if (sourceChartInstance) sourceChartInstance.destroy();
    const srcLabels = Object.keys(sourcesMap);
    const srcData = Object.values(sourcesMap);
    sourceChartInstance = new Chart(ctxSrc, {
        type: 'doughnut',
        data: {
            labels: srcLabels,
            datasets: [{
                data: srcData,
                backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b', '#ef4444'],
                borderWidth: isDark ? 2 : 0,
                borderColor: isDark ? '#111111' : '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: window.innerWidth < 768 ? 'bottom' : 'right', 
                    labels: { color: textColor, padding: 20, usePointStyle: true } 
                }
            },
            cutout: '70%'
        }
    });
}

window.loadMoreClients = function() {
    currentPage++;
    renderClientTable(false); 
};

function renderClientTable(resetPage = false) {
    if (resetPage) currentPage = 1;
    const tbody = document.getElementById('clients-tbody');
    const emptyState = document.getElementById('empty-state');
    const loadMoreBtnContainer = document.getElementById('load-more-container');
    const searchQ = document.getElementById('search-input').value.toLowerCase();
    const statusQ = document.getElementById('filter-status').value;
    const filtered = clientsList.filter(client => {
        const matchSearch = client.name.toLowerCase().includes(searchQ) || client.phone.includes(searchQ);
        const matchStatus = statusQ === 'All' || client.status === statusQ;
        return matchSearch && matchStatus;
    });
    const paginated = filtered.slice(0, currentPage * ITEMS_PER_PAGE);
    tbody.innerHTML = '';
    if (paginated.length === 0) {
        tbody.parentElement.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
    } else {
        tbody.parentElement.classList.remove('hidden');
        emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');
        paginated.forEach(client => {
            const canEdit = isSuperAdminUser || client.addedByEmail === currentUser.email;
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-100/50 dark:hover:bg-gray-800/30 transition-colors border-b border-gray-200 dark:border-gray-800/50 last:border-0";
            const balance = Math.max(0, (Number(client.price) || 0) - (Number(client.advance) || 0));
            let financeHtml = `<div>
                <p class="font-medium text-gray-900 dark:text-gray-200 text-sm md:text-base">₹${(client.price || 0).toLocaleString('en-IN')}</p>
                ${client.status === 'Completed' || balance <= 0 ? `<p class="text-[10px] md:text-xs text-green-600 dark:text-green-500 font-medium">Fully Paid</p>` : `<p class="text-[10px] md:text-xs text-accentRed font-medium">Bal: ₹${balance.toLocaleString('en-IN')}</p>`}
            </div>`;
            const d = new Date(client.deadline);
            const diffDays = client.deadline ? Math.ceil((d - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24)) : null;
            let deadlineHtml = '-';
            if(client.deadline) {
                let colorClass = 'text-gray-600 dark:text-gray-400';
                if(client.status !== 'Completed' && client.status !== 'Cancelled') {
                    if(diffDays < 0) colorClass = 'text-red-600 dark:text-red-500 font-medium';
                    else if(diffDays <= 3) colorClass = 'text-orange-600 dark:text-orange-500 font-medium';
                }
                deadlineHtml = `<p class="text-xs md:text-sm ${colorClass}"><i class="ph ph-clock"></i> ${d.toLocaleDateString('en-IN', {day:'numeric', month:'short'})}</p>`;
            }
            let actionsHtml = `
                <div class="flex items-center justify-end gap-2">
                    <a href="https://wa.me/${client.phone.replace(/[^0-9]/g, '')}" target="_blank" class="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition-colors" title="WhatsApp">
                        <i class="ph ph-whatsapp-logo text-base md:text-lg"></i>
                    </a>
                    ${canEdit ? `<button onclick="editClient('${client.id}')" class="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-400 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors" title="Edit">
                        <i class="ph ph-pencil-simple text-base md:text-lg"></i>
                    </button>` : ''}
                </div>
            `;
            tr.innerHTML = `
                <td class="p-3 md:p-4 cursor-pointer" onclick="openModal('${client.id}')">
                    <div class="flex items-center gap-2 md:gap-3">
                        <div class="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-400 font-bold text-sm md:text-base shrink-0 border border-gray-300 dark:border-transparent">
                            ${client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p class="font-semibold text-gray-900 dark:text-gray-200 text-sm md:text-base">${client.name}</p>
                            <p class="text-[10px] md:text-xs text-gray-600 dark:text-gray-500 flex items-center gap-1"><i class="ph ph-phone"></i> ${client.phone}</p>
                        </div>
                    </div>
                </td>
                <td class="p-3 md:p-4 cursor-pointer text-xs md:text-sm text-gray-700 dark:text-gray-300" onclick="openModal('${client.id}')">
                    <p class="font-medium">${client.business || 'N/A'}</p>
                    <p class="text-[10px] md:text-xs text-gray-500">${client.website}</p>
                </td>
                <td class="p-3 md:p-4 cursor-pointer" onclick="openModal('${client.id}')">
                    ${financeHtml}
                </td>
                <td class="p-3 md:p-4 cursor-pointer" onclick="openModal('${client.id}')">
                    <span class="px-2 py-1 md:px-3 rounded-full text-[10px] md:text-xs font-medium block w-max mb-1 ${getStatusBadge(client.status)}">${client.status}</span>
                    ${deadlineHtml}
                </td>
                <td class="p-3 md:p-4 text-right">
                    ${actionsHtml}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    if (filtered.length > currentPage * ITEMS_PER_PAGE) {
        loadMoreBtnContainer.classList.remove('hidden');
    } else {
        loadMoreBtnContainer.classList.add('hidden');
    }
}

document.getElementById('search-input').addEventListener('input', () => renderClientTable(true));
document.getElementById('filter-status').addEventListener('change', () => renderClientTable(true));

const modal = document.getElementById('client-modal');
window.openModal = function(id) {
    const client = clientsList.find(c => c.id === id);
    if(!client) return;
    document.getElementById('modal-name').innerText = client.name;
    document.getElementById('modal-business').innerText = client.business || 'N/A';
    document.getElementById('modal-phone').innerText = client.phone;
    document.getElementById('modal-email').innerText = client.email || 'N/A';
    document.getElementById('modal-website').innerText = client.website;
    document.getElementById('modal-source').innerText = client.source || 'N/A';
    const urlEl = document.getElementById('modal-website-url');
    if (client.websiteUrl) {
        urlEl.innerText = client.websiteUrl;
        urlEl.href = client.websiteUrl.startsWith('http') ? client.websiteUrl : `https://${client.websiteUrl}`;
        urlEl.classList.add('text-blue-600', 'dark:text-blue-500', 'hover:text-blue-700', 'underline');
        urlEl.classList.remove('text-gray-900', 'dark:text-gray-200');
    } else {
        urlEl.innerText = 'Not provided';
        urlEl.removeAttribute('href');
        urlEl.classList.remove('text-blue-600', 'dark:text-blue-500', 'hover:text-blue-700', 'underline');
        urlEl.classList.add('text-gray-900', 'dark:text-gray-200');
    }
    const isCompleted = client.status === 'Completed';
    const displayAdvance = isCompleted ? (client.price || 0) : (client.advance || 0);
    const balance = Math.max(0, (Number(client.price) || 0) - Number(displayAdvance));
    document.getElementById('modal-price').innerText = `₹${(client.price || 0).toLocaleString('en-IN')}`;
    document.getElementById('modal-advance').innerText = `₹${displayAdvance.toLocaleString('en-IN')}`;
    const balanceEl = document.getElementById('modal-balance');
    if (isCompleted || balance <= 0) {
        balanceEl.innerText = 'Fully Paid';
        balanceEl.className = 'font-bold text-xl text-green-600 dark:text-green-500';
    } else {
        balanceEl.innerText = `₹${balance.toLocaleString('en-IN')}`;
        balanceEl.className = 'font-bold text-xl text-accentRed';
    }
    document.getElementById('modal-deadline').innerHTML = client.deadline ? `<i class="ph ph-calendar"></i> ${new Date(client.deadline).toLocaleDateString('en-IN', {year:'numeric', month:'short', day:'numeric'})}` : 'Not Set';
    document.getElementById('modal-notes').innerText = client.notes || 'No notes or tasks provided.';
    const statusEl = document.getElementById('modal-status');
    statusEl.innerText = client.status;
    statusEl.className = `inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(client.status)}`;
    const addedByEl = document.getElementById('modal-added-by');
    if (client.addedByName || client.addedByEmail) {
        addedByEl.innerText = `Added by: ${client.addedByName || client.addedByEmail}`;
        addedByEl.classList.remove('hidden');
    } else {
        addedByEl.classList.add('hidden');
    }
    const cleanPhone = client.phone.replace(/[^0-9]/g, '');
    document.getElementById('modal-whatsapp').href = `https://wa.me/${cleanPhone}`;
    const canEdit = isSuperAdminUser || client.addedByEmail === currentUser.email;
    const editBtn = document.getElementById('modal-edit-btn');
    if (canEdit) {
        editBtn.classList.remove('hidden');
        editBtn.onclick = () => editClient(id);
    } else {
        editBtn.classList.add('hidden');
    }
    modal.classList.remove('hidden');
};

window.closeModal = function() {
    modal.classList.add('hidden');
};

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

const logoutModal = document.getElementById('logout-modal');
logoutModal.addEventListener('click', (e) => {
    if (e.target === logoutModal) hideLogoutModal();
});

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    let bgClass = 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900';
    let icon = 'ph-info';
    if (type === 'success') {
        bgClass = 'bg-green-500 text-white';
        icon = 'ph-check-circle';
    } else if (type === 'error') {
        bgClass = 'bg-red-500 text-white';
        icon = 'ph-warning-circle';
    }
    toast.className = `toast-enter flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl ${bgClass} w-full md:w-auto md:min-w-[250px] pointer-events-auto`;
    toast.innerHTML = `<i class="ph ${icon} text-xl"></i><span class="font-medium text-sm">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function renderRequestsTable() {
    const tbody = document.getElementById('requests-tbody');
    const emptyState = document.getElementById('requests-empty-state');
    tbody.innerHTML = '';
    const pendingReqs = requestsList.filter(r => r.status === 'Pending').sort((a,b) => b.createdAt - a.createdAt);
    if (pendingReqs.length === 0) {
        tbody.parentElement.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
    } else {
        tbody.parentElement.classList.remove('hidden');
        emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');
        pendingReqs.forEach(req => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-100/50 dark:hover:bg-gray-800/30 transition-colors border-b border-gray-200 dark:border-gray-800/50 last:border-0";
            tr.innerHTML = `
                <td class="p-3 md:p-4">
                    <p class="font-medium text-gray-900 dark:text-gray-200">${req.requestedByName}</p>
                    <p class="text-[10px] md:text-xs text-gray-500">${req.requestedByEmail}</p>
                </td>
                <td class="p-3 md:p-4">
                    <span class="px-2 py-1 rounded-full text-[10px] md:text-xs font-medium ${req.type === 'ADD' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500'}">${req.type}</span>
                </td>
                <td class="p-3 md:p-4 text-gray-900 dark:text-gray-200 font-medium text-sm md:text-base">${req.clientData.name}</td>
                <td class="p-3 md:p-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="approveReq('${req.id}')" class="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-green-600 transition-colors">Approve</button>
                        <button onclick="rejectReq('${req.id}')" class="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-red-600 transition-colors">Reject</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

window.approveReq = async function(reqId) {
    const req = requestsList.find(r => r.id === reqId);
    if(!req) return;
    try {
        const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', req.targetClientId);
        await setDoc(clientRef, req.clientData);
        const reqRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', reqId);
        await updateDoc(reqRef, { status: 'Approved' });
        showToast("Request Approved Successfully", "success");
    } catch(e) { 
        showToast("Error approving request", "error"); 
    }
};

window.rejectReq = async function(reqId) {
    try {
        const reqRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', reqId);
        await updateDoc(reqRef, { status: 'Rejected' });
        showToast("Request Rejected", "info");
    } catch(e) { 
        showToast("Error rejecting request", "error"); 
    }
};
