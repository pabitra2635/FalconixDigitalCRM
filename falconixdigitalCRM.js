import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, getDocs, deleteDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const SUPER_ADMIN_EMAIL = 'pabitramondal2635@gmail.com';

const SUPER_ADMINS = [
    'pabitramondal2635@gmail.com',
    'subhadeep0897@gmail.com',
    'pabitramondal.ind@gmail.com',
    'ayanmondal21836@gmail.com'
];

const ADMIN_NAMES = {
    'pabitramondal2635@gmail.com': 'Pabitra Mondal',
    'subhadeep0897@gmail.com': 'Subhadeep Tapadar',
    'pabitramondal.ind@gmail.com': 'Pabitra (Ind)',
    'ayanmondal21836@gmail.com': 'Ayan Mondal'
};

const RESTRICTED_DASHBOARD_EMAILS = [
    'ayanmondal21836@gmail.com',
    'pabitramondal.ind@gmail.com',
    'subhadeep0897@gmail.com'
];

const RESTRICTED_CLIENTS_EMAILS = [
    'ayanmondal21836@gmail.com',
    'pabitramondal.ind@gmail.com',
    'subhadeep0897@gmail.com'
];

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

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider('6LeLDsQsAAAAANX0XGWIkpuuVEqK4pZ8ndMKcmU2'),
  isTokenAutoRefreshEnabled: true 
});

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let currentUser = null;
let isSuperAdminUser = false;
let clientsList = [];
let requestsList = [];
let notificationsList = [];
let expensesList = [];
let unsubscribeClients = null;
let unsubscribeRequests = null;
let unsubscribeNotifications = null;
let unsubscribeExpenses = null;

let currentPage = 1;
const ITEMS_PER_PAGE = 10;

let revenueChartInstance = null;
let sourceChartInstance = null;

const loginWrapper = document.getElementById('login-wrapper');
const appWrapper = document.getElementById('app-wrapper');
const globalLoader = document.getElementById('global-loader');
const loggedInEmailText = document.getElementById('logged-in-email');
const googleLoginBtn = document.getElementById('google-login-btn');
const loginError = document.getElementById('login-error');

const defaultBtnHtml = googleLoginBtn.innerHTML;

window.addInstallmentRow = function(title = '', amount = '', date = '', status = 'Pending') {
    const container = document.getElementById('installments-container');
    const row = document.createElement('div');
    row.className = 'flex flex-col md:flex-row gap-2 items-center installment-row';
    row.innerHTML = `
        <div class="w-full md:w-2/5">
            <input type="text" placeholder="Milestone (e.g. 50% Upfront)" value="${title}" class="inst-title w-full bg-white dark:bg-darkCard border border-gray-300 dark:border-gray-700 rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:border-accentRed focus:ring-1 focus:ring-accentRed transition-all">
        </div>
        <div class="w-full md:w-1/4">
            <input type="number" placeholder="Amt (₹)" value="${amount}" class="inst-amount w-full bg-white dark:bg-darkCard border border-gray-300 dark:border-gray-700 rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:border-accentRed focus:ring-1 focus:ring-accentRed transition-all">
        </div>
        <div class="w-full md:w-1/4 flex gap-2">
            <input type="date" value="${date}" class="inst-date w-full bg-white dark:bg-darkCard border border-gray-300 dark:border-gray-700 rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:border-accentRed focus:ring-1 focus:ring-accentRed transition-all appearance-none">
        </div>
        <div class="w-full md:w-auto flex items-center gap-2 shrink-0">
            <select class="inst-status bg-white dark:bg-darkCard border border-gray-300 dark:border-gray-700 rounded-lg py-1.5 px-2 text-sm focus:outline-none focus:border-accentRed focus:ring-1 focus:ring-accentRed transition-all appearance-none">
                <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Paid" ${status === 'Paid' ? 'selected' : ''}>Paid</option>
            </select>
            <button type="button" onclick="this.parentElement.parentElement.remove()" class="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"><i class="ph ph-trash text-lg"></i></button>
        </div>
    `;
    container.appendChild(row);
}

function getInstallmentsData() {
    const rows = document.querySelectorAll('.installment-row');
    const data = [];
    rows.forEach(row => {
        data.push({
            title: row.querySelector('.inst-title').value.trim(),
            amount: parseFloat(row.querySelector('.inst-amount').value) || 0,
            date: row.querySelector('.inst-date').value,
            status: row.querySelector('.inst-status').value
        });
    });
    return data;
}

function calculatePaidAmount(client) {
    let paid = 0;
    if (client.installments && client.installments.length > 0) {
        paid = client.installments.filter(i => i.status === 'Paid').reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    } else {
        paid = Number(client.advance) || 0;
    }
    
    if (client.status === 'Completed') {
        const expected = Math.max(0, (Number(client.price) || 0) - (Number(client.discount) || 0)) + (Number(client.extraCharge) || 0) + (Number(client.maintenanceCharge) || 0);
        return Math.max(paid, expected);
    }
    return paid;
}

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
            
            document.getElementById('nav-requests').classList.remove('hidden');
            document.getElementById('nav-requests').classList.add('flex');
            
            const navDashboard = document.getElementById('nav-dashboard');
            const navClientList = document.getElementById('nav-client-list');
            
            const isRestrictedFromDashboard = RESTRICTED_DASHBOARD_EMAILS.includes(user.email.toLowerCase());
            const isRestrictedFromClients = RESTRICTED_CLIENTS_EMAILS.includes(user.email.toLowerCase());

            if (navDashboard) {
                navDashboard.classList.remove('hidden');
                navDashboard.classList.add('flex');
                if (isRestrictedFromDashboard) {
                    navDashboard.classList.add('opacity-50', 'cursor-not-allowed');
                } else {
                    navDashboard.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            }

            if (navClientList) {
                if (isRestrictedFromClients) {
                    navClientList.classList.add('opacity-50', 'cursor-not-allowed');
                } else {
                    navClientList.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            }

            if (isRestrictedFromDashboard && !isRestrictedFromClients) {
                navigate('client-list'); 
            } else if (isRestrictedFromClients && !isRestrictedFromDashboard) {
                navigate('dashboard'); 
            } else if (isRestrictedFromClients && isRestrictedFromDashboard) {
                navigate('add-client'); 
            } else {
                navigate('dashboard');
            }

            const expCard = document.getElementById('stat-card-expenses');
            if (expCard) {
                expCard.classList.remove('hidden');
                expCard.classList.add('flex');
            }
            
            const netCard = document.getElementById('stat-card-net-profit');
            if (netCard) {
                netCard.classList.remove('hidden');
                netCard.classList.add('flex');
            }

            const navExp = document.getElementById('nav-expenses');
            if (navExp) {
                navExp.classList.remove('hidden');
                navExp.classList.add('flex');
            }

            const expFormContainer = document.getElementById('expense-form')?.parentElement;
            const expHistoryContainer = expFormContainer?.nextElementSibling;
            
            if (expFormContainer && expHistoryContainer) {
                if (!isSuperAdminUser) {
                    expFormContainer.classList.add('hidden');
                    expHistoryContainer.classList.remove('lg:col-span-2');
                    expHistoryContainer.classList.add('lg:col-span-3');
                } else {
                    expFormContainer.classList.remove('hidden');
                    expHistoryContainer.classList.add('lg:col-span-2');
                    expHistoryContainer.classList.remove('lg:col-span-3');
                }
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
            loginError.innerText = "Access Denied: Email not authorized as Admin.";
            loginError.classList.remove('hidden');
            googleLoginBtn.innerHTML = defaultBtnHtml;
        }
    } else {
        currentUser = null;
        isSuperAdminUser = false;
        if(unsubscribeClients) unsubscribeClients();
        if(unsubscribeRequests) unsubscribeRequests();
        if(unsubscribeNotifications) unsubscribeNotifications();
        if(unsubscribeExpenses) unsubscribeExpenses();
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
        renderLeaderboard();
        renderClientTable(true);
        globalLoader.classList.add('hidden');
    }, (error) => {
        showToast("Database sync error.", "error");
        globalLoader.classList.add('hidden');
    });

    const notifRef = collection(db, 'artifacts', appId, 'public', 'data', 'notifications');
    unsubscribeNotifications = onSnapshot(notifRef, (snapshot) => {
        notificationsList = [];
        snapshot.forEach(doc => {
            notificationsList.push({ id: doc.id, ...doc.data() });
        });
        renderNotifications();
    });

    const reqsRef = collection(db, 'artifacts', appId, 'public', 'data', 'requests');
    unsubscribeRequests = onSnapshot(reqsRef, (snapshot) => {
        requestsList = [];
        snapshot.forEach(doc => {
            requestsList.push({ id: doc.id, ...doc.data() });
        });
        renderRequestsTable();
        updateRequestsBadge();
    });

    const expRef = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');
    unsubscribeExpenses = onSnapshot(expRef, (snapshot) => {
        expensesList = [];
        snapshot.forEach(doc => {
            expensesList.push({ id: doc.id, ...doc.data() });
        });
        expensesList.sort((a,b) => new Date(b.date) - new Date(a.date));
        
        renderExpenses();
        updateDashboardStats();
    });
}

document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isSuperAdminUser) return;
    
    const btn = document.getElementById('exp-submit-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<i class="ph ph-spinner animate-spin text-lg"></i> Logging...`;
    btn.disabled = true;

    try {
        const newExp = {
            description: document.getElementById('exp-desc').value.trim(),
            amount: parseFloat(document.getElementById('exp-amount').value),
            category: document.getElementById('exp-category').value,
            date: document.getElementById('exp-date').value,
            addedAt: Date.now()
        };
        const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'));
        await setDoc(ref, newExp);
        
        document.getElementById('expense-form').reset();
        document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
        showToast("Expense logged successfully!", "success");
    } catch (err) {
        showToast("Error logging expense.", "error");
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
});

function renderExpenses() {
    const tbody = document.getElementById('expenses-tbody');
    const empty = document.getElementById('expenses-empty');
    const totalDisplay = document.getElementById('exp-total-display');
    if (!tbody || !empty || !totalDisplay) return;
    
    tbody.innerHTML = '';
    
    const totalManual = expensesList.reduce((sum, e) => sum + (Number(e.amount)||0), 0);
    const totalAutoExtra = clientsList.filter(client => client.status === 'Completed').reduce((sum, client) => sum + (Number(client.extraCharge) || 0), 0);
    
    totalDisplay.innerHTML = `Manual: <span class="font-bold">₹${totalManual.toLocaleString('en-IN')}</span> + Auto (Extra): <span class="font-bold">₹${totalAutoExtra.toLocaleString('en-IN')}</span>`;

    if (expensesList.length === 0) {
        tbody.parentElement.classList.add('hidden');
        empty.classList.remove('hidden');
        empty.classList.add('flex');
    } else {
        tbody.parentElement.classList.remove('hidden');
        empty.classList.add('hidden');
        empty.classList.remove('flex');
        
        expensesList.forEach(exp => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50/50 dark:hover:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800/50 last:border-0 transition-colors";
            
            let catColor = "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
            if(exp.category === 'Hosting/Domain') catColor = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-500";
            if(exp.category === 'Freelancer') catColor = "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-500";
            if(exp.category === 'Marketing') catColor = "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-500";

            const deleteBtnHtml = isSuperAdminUser ? 
                `<button onclick="deleteExpense('${exp.id}')" class="text-gray-400 hover:text-red-500 transition-colors p-1"><i class="ph ph-trash text-lg"></i></button>` 
                : '';

            tr.innerHTML = `
                <td class="p-3 text-gray-600 dark:text-gray-400">${new Date(exp.date).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}</td>
                <td class="p-3 font-medium text-gray-900 dark:text-gray-200">${exp.description}</td>
                <td class="p-3">
                    <span class="px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-wide ${catColor}">${exp.category}</span>
                </td>
                <td class="p-3 text-right font-bold text-red-500">- ₹${Number(exp.amount).toLocaleString('en-IN')}</td>
                <td class="p-3 text-center">
                    ${deleteBtnHtml}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

window.deleteExpense = async function(id) {
    if (!confirm("Are you sure you want to delete this expense log?")) return;
    try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id));
        showToast("Expense removed.", "success");
    } catch(e) {
        showToast("Error deleting expense.", "error");
    }
}

document.getElementById('client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    // ==========================================
    // 1. STRICT FORM VALIDATION
    // ==========================================
    
    // --- A. Phone Number Validation (+91 Format) ---
    const phoneInputEl = document.getElementById('form-phone');
    const rawPhone = phoneInputEl.value.trim();
    const numericPhone = rawPhone.replace(/\D/g, ''); 
    
    let formattedPhone = "";
    if (numericPhone.length === 10) {
        formattedPhone = "+91 " + numericPhone;
    } else if (numericPhone.length === 12 && numericPhone.startsWith('91')) {
        formattedPhone = "+91 " + numericPhone.substring(2);
    } else {
        showToast("Please enter a valid 10-digit mobile number.", "error");
        phoneInputEl.focus();
        return; 
    }
    
    // --- B. Email Validation ---
    const emailInput = document.getElementById('form-email').value.trim();
    if (emailInput !== "") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput)) {
            showToast("Please enter a valid email address.", "error");
            document.getElementById('form-email').focus();
            return;
        }
    }

    // --- C. Financial Validation ---
    const priceInput = parseFloat(document.getElementById('form-price').value);
    const discountInput = parseFloat(document.getElementById('form-discount').value) || 0;
    const extraInput = parseFloat(document.getElementById('form-extra-charge').value) || 0;
    const maintInput = parseFloat(document.getElementById('form-maintenance-charge').value) || 0;

    if (isNaN(priceInput) || priceInput <= 0) {
        showToast("Project price must be greater than ₹0.", "error");
        document.getElementById('form-price').focus();
        return;
    }
    if (discountInput < 0 || extraInput < 0 || maintInput < 0) {
        showToast("Charges and discounts cannot be negative.", "error");
        return;
    }
    if (discountInput > priceInput) {
        showToast("Discount cannot be greater than the project price.", "error");
        document.getElementById('form-discount').focus();
        return;
    }

    // Update the input field directly so the correct string is picked up by `clientData` below
    phoneInputEl.value = formattedPhone;

    // ==========================================
    // 2. CONTINUE WITH SUBMISSION
    // ==========================================

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

    let logAction = "Client details updated";
    const statusField = document.getElementById('form-status').value;
    if (isEditing && existingClient && existingClient.status !== statusField) {
        logAction = `Status changed to ${statusField}`;
    } else if (!isEditing) {
        logAction = "Added new client";
    }

    if (!isSuperAdminUser) {
        logAction = isEditing ? "Requested client update" : "Requested client creation";
    }

    const newLogEntry = {
        action: logAction,
        performedBy: addedName,
        timestamp: Date.now()
    };

    const activityLog = isEditing && existingClient?.activityLog ? [...existingClient.activityLog] : [];
    activityLog.push(newLogEntry);

    const clientData = {
        name: document.getElementById('form-name').value.trim(),
        business: document.getElementById('form-business').value.trim(),
        source: document.getElementById('form-source').value,
        phone: document.getElementById('form-phone').value.trim(),
        email: document.getElementById('form-email').value.trim(),
        address: document.getElementById('form-address').value.trim(),
        website: document.getElementById('form-website').value,
        websiteUrl: document.getElementById('form-website-url').value.trim(),
        price: parseFloat(document.getElementById('form-price').value) || 0,
        discount: parseFloat(document.getElementById('form-discount').value) || 0,
        extraCharge: parseFloat(document.getElementById('form-extra-charge').value) || 0,
        maintenanceCharge: parseFloat(document.getElementById('form-maintenance-charge').value) || 0,
        installments: getInstallmentsData(),
        deadline: document.getElementById('form-deadline').value || null,
        status: statusField,
        notes: document.getElementById('form-notes').value.trim(),
        createdAt: isEditing ? (existingClient?.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now(),
        addedByEmail: addedEmail,
        addedByName: addedName,
        activityLog: activityLog
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

            const notifRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'));
            await setDoc(notifRef, {
                recipientEmail: 'all',
                message: `New Request: ${addedName} wants to ${isEditing ? 'update' : 'add'} client "${clientData.name}".`,
                readBy: [],
                createdAt: Date.now(),
                type: 'info'
            });

            showToast("Request sent to Super Admin for approval.", "success");
        }
        document.getElementById('client-form').reset();
        document.getElementById('client-id').value = "";
        document.getElementById('installments-container').innerHTML = '';
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
    if (viewId === 'dashboard' && currentUser && RESTRICTED_DASHBOARD_EMAILS.includes(currentUser.email.toLowerCase())) {
        showToast("You don't have access to the dashboard.", "error");
        return; 
    }
    if (viewId === 'client-list' && currentUser && RESTRICTED_CLIENTS_EMAILS.includes(currentUser.email.toLowerCase())) {
        showToast("You don't have access to the client database.", "error");
        return; 
    }
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => {
        el.classList.remove('text-accentRed', 'bg-gray-200/80', 'dark:bg-gray-800/50');
        el.classList.add('text-gray-700', 'dark:text-gray-400');
    });
    const viewEl = document.getElementById(`view-${viewId}`);
    if(viewEl) viewEl.classList.add('active');
    
    const navBtn = document.getElementById(`nav-${viewId}`);
    if(navBtn) {
        navBtn.classList.remove('text-gray-700', 'dark:text-gray-400');
        navBtn.classList.add('text-accentRed', 'bg-gray-200/80', 'dark:bg-gray-800/50');
    }
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');
        if(sidebar) sidebar.classList.add('-translate-x-full');
        if(overlay) overlay.classList.add('hidden');
    }
    if(viewId === 'add-client' && !isEdit) {
        const formTitle = document.getElementById('form-title');
        const formSubmitBtn = document.getElementById('form-submit-btn');
        if(formTitle) formTitle.innerText = "Add New Client";
        if(formSubmitBtn) {
            formSubmitBtn.innerHTML = isSuperAdminUser 
                ? '<i class="ph ph-floppy-disk text-lg"></i> <span>Save Client</span>' 
                : '<i class="ph ph-paper-plane-right text-lg"></i> <span>Send Request</span>';
        }
        const clientIdEl = document.getElementById('client-id');
        const clientForm = document.getElementById('client-form');
        const instContainer = document.getElementById('installments-container');
        if(clientIdEl) clientIdEl.value = "";
        if(clientForm) clientForm.reset();
        if(instContainer) instContainer.innerHTML = '';
    }
    if(viewId === 'client-list' || viewId === 'dashboard') {
        renderClientTable(true);
    }
    if(viewId === 'requests') {
        renderRequestsTable();
    }
    if(viewId === 'notifications') {
        renderNotifications();
    }
    if(viewId === 'expenses') {
        const expDate = document.getElementById('exp-date');
        if(expDate) expDate.value = new Date().toISOString().split('T')[0];
    }
};

window.toggleTheme = function() {
    const html = document.documentElement;
    const themeText = document.getElementById('theme-text');
    const themeIcon = document.getElementById('theme-icon');
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        if(themeText) themeText.innerText = 'Dark Mode';
        if(themeIcon) themeIcon.classList.replace('ph-sun', 'ph-moon');
    } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        if(themeText) themeText.innerText = 'Light Mode';
        if(themeIcon) themeIcon.classList.replace('ph-moon', 'ph-sun');
    }
    setTimeout(() => {
        if(clientsList.length > 0) updateCharts();
    }, 50);
};

if (localStorage.getItem('theme') === 'light') {
    document.documentElement.classList.remove('dark');
    const themeText = document.getElementById('theme-text');
    const themeIcon = document.getElementById('theme-icon');
    if(themeText) themeText.innerText = 'Dark Mode';
    if(themeIcon) themeIcon.classList.replace('ph-sun', 'ph-moon');
} else {
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    if(themeIcon) themeIcon.classList.replace('ph-moon', 'ph-sun');
    if(themeText) themeText.innerText = 'Light Mode';
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
    document.getElementById('form-address').value = client.address || '';
    document.getElementById('form-website').value = client.website;
    document.getElementById('form-website-url').value = client.websiteUrl || '';
    document.getElementById('form-price').value = client.price || '';
    document.getElementById('form-discount').value = client.discount || '';
    document.getElementById('form-extra-charge').value = client.extraCharge || '';
    document.getElementById('form-maintenance-charge').value = client.maintenanceCharge || '';
    document.getElementById('form-deadline').value = client.deadline || '';
    document.getElementById('form-status').value = client.status;
    document.getElementById('form-notes').value = client.notes;

    document.getElementById('installments-container').innerHTML = '';
    if (client.installments && client.installments.length > 0) {
        client.installments.forEach(inst => addInstallmentRow(inst.title, inst.amount, inst.date, inst.status));
    } else if (client.advance > 0) {
        addInstallmentRow('Advance', client.advance, '', 'Paid');
    }

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
    const totalClientsEl = document.getElementById('stat-total-clients');
    if(totalClientsEl) totalClientsEl.innerText = clientsList.length;
    
    const activeEl = document.getElementById('stat-active-projects');
    if(activeEl) activeEl.innerText = clientsList.filter(c => c.status === 'Active').length;
    
    const completedEl = document.getElementById('stat-completed-projects');
    if(completedEl) completedEl.innerText = clientsList.filter(c => c.status === 'Completed').length;
    
    const totalGrossRevenue = clientsList.filter(client => client.status === 'Completed').reduce((sum, client) => {
        const baseRevenue = Math.max(0, (Number(client.price) || 0) - (Number(client.discount) || 0));
        const extra = Number(client.extraCharge) || 0;
        const maintenance = Number(client.maintenanceCharge) || 0;
        return sum + baseRevenue + extra + maintenance;
    }, 0);
    
    const totalPendingPayments = clientsList.filter(client => client.status !== 'Completed' && client.status !== 'Cancelled').reduce((sum, client) => {
        const expected = Math.max(0, (Number(client.price) || 0) - (Number(client.discount) || 0)) + (Number(client.extraCharge) || 0) + (Number(client.maintenanceCharge) || 0);
        const paid = calculatePaidAmount(client);
        return sum + Math.max(0, expected - paid);
    }, 0);

    const formattedGross = '₹' + totalGrossRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    const formattedPending = '₹' + totalPendingPayments.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    
    const profitEl = document.getElementById('stat-total-profit');
    if(profitEl) {
        profitEl.innerText = formattedGross;
        profitEl.title = formattedGross; 
    }
    
    const pendingEl = document.getElementById('stat-pending-payments');
    if(pendingEl) {
        pendingEl.innerText = formattedPending;
        pendingEl.title = formattedPending;
    }

    const totalAutoExtraCharges = clientsList.filter(client => client.status === 'Completed').reduce((sum, client) => sum + (Number(client.extraCharge) || 0), 0);
    const totalManualExpenses = expensesList.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    
    const totalCombinedExpenses = totalManualExpenses + totalAutoExtraCharges;
    const trueNetProfit = totalGrossRevenue - totalCombinedExpenses;

    const expEl = document.getElementById('stat-total-expenses');
    if(expEl) expEl.innerText = '₹' + totalCombinedExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    
    const netEl = document.getElementById('stat-net-profit');
    if(netEl) netEl.innerText = '₹' + trueNetProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 });

    const recentBody = document.getElementById('recent-clients-tbody');
    if(recentBody) {
        recentBody.innerHTML = '';
        clientsList.slice(0, 5).forEach(client => {
            const canEdit = isSuperAdminUser || client.addedByEmail === currentUser.email;
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-100/50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer border-b border-gray-200 dark:border-gray-800/50 last:border-0";
            tr.onclick = () => openModal(client.id);
            
            const expected = Math.max(0, (Number(client.price) || 0) - (Number(client.discount) || 0)) + (Number(client.extraCharge) || 0) + (Number(client.maintenanceCharge) || 0);
            const paid = calculatePaidAmount(client);
            const balance = Math.max(0, expected - paid);

            let financeHtml = `<div>
                <p class="font-medium text-gray-900 dark:text-gray-200 text-sm md:text-base">₹${expected.toLocaleString('en-IN')}</p>
                ${client.status === 'Completed' || balance <= 0 ? `<p class="text-[10px] md:text-xs text-green-600 dark:text-green-500 font-medium">Fully Paid</p>` : `<p class="text-[10px] md:text-xs text-accentRed font-medium">Bal: ₹${balance.toLocaleString('en-IN')}</p>`}
            </div>`;

            let viewBtnHtml = `<button onclick="event.stopPropagation(); openModal('${client.id}')" class="text-blue-500 dark:text-blue-400 hover:text-blue-700 transition-colors p-1 md:p-2" title="View Details"><i class="ph ph-eye text-base md:text-lg"></i></button>`;
            let editBtnHtml = canEdit ? `<button onclick="event.stopPropagation(); editClient('${client.id}')" class="text-gray-500 dark:text-gray-400 hover:text-accentRed dark:hover:text-accentRed transition-colors p-1 md:p-2" title="Edit"><i class="ph ph-pencil-simple text-base md:text-lg"></i></button>` : '';
            
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
                    <div class="flex items-center justify-end gap-1">
                        ${viewBtnHtml}
                        ${editBtnHtml}
                    </div>
                </td>
            `;
            recentBody.appendChild(tr);
        });
    }

    const deadlinesContainer = document.getElementById('upcoming-deadlines-list');
    if(deadlinesContainer) {
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
                monthObj.revenue += Math.max(0, (Number(client.price) || 0) - (Number(client.discount) || 0)) + (Number(client.maintenanceCharge) || 0);
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

window.renderLeaderboard = function renderLeaderboard() {
    const filterEl = document.getElementById('leaderboard-filter');
    const customDateRangeEl = document.getElementById('custom-date-range');
    const tbody = document.getElementById('leaderboard-tbody');
    const emptyState = document.getElementById('leaderboard-empty');
    const tableContainer = document.getElementById('leaderboard-table-container');
    
    if(!filterEl || !tbody || !emptyState || !tableContainer) return;
    
    const filter = filterEl.value;

    if (filter === 'custom') {
        if(customDateRangeEl) {
            customDateRangeEl.classList.remove('hidden');
            customDateRangeEl.classList.add('flex');
        }
    } else {
        if(customDateRangeEl) {
            customDateRangeEl.classList.add('hidden');
            customDateRangeEl.classList.remove('flex');
        }
    }

    const now = new Date();
    let startDate = new Date(0);
    let endDate = new Date('9999-12-31');

    if (filter === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === 'last_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === 'this_year') {
        startDate = new Date(now.getFullYear(), 0, 1);
    } else if (filter === 'custom') {
        const customStart = document.getElementById('custom-start-date').value;
        const customEnd = document.getElementById('custom-end-date').value;

        if (customStart) {
            startDate = new Date(customStart);
            startDate.setHours(0, 0, 0, 0);
        }
        if (customEnd) {
            endDate = new Date(customEnd);
            endDate.setHours(23, 59, 59, 999);
        }
    }

    const statsMap = {};

    clientsList.forEach(client => {
        const createdAt = new Date(client.createdAt);
        if (createdAt >= startDate && createdAt <= endDate) { 
            const email = client.addedByEmail || SUPER_ADMIN_EMAIL;
            const name = client.addedByName || ADMIN_NAMES[SUPER_ADMIN_EMAIL] || 'Pabitra Mondal';

            if (!statsMap[email]) {
                statsMap[email] = { name: name, clientsCount: 0, revenue: 0, email: email };
            }

            statsMap[email].clientsCount++;
            
            if (client.status === 'Completed') {
                const baseRevenue = Math.max(0, (Number(client.price) || 0) - (Number(client.discount) || 0));
                statsMap[email].revenue += baseRevenue;
                
                const maintenance = Number(client.maintenanceCharge) || 0;
                if (maintenance > 0) {
                    if (!statsMap[SUPER_ADMIN_EMAIL]) {
                        statsMap[SUPER_ADMIN_EMAIL] = { 
                            name: ADMIN_NAMES[SUPER_ADMIN_EMAIL] || 'Pabitra Mondal', 
                            clientsCount: 0, 
                            revenue: 0, 
                            email: SUPER_ADMIN_EMAIL 
                        };
                    }
                    if (email !== SUPER_ADMIN_EMAIL) {
                       statsMap[SUPER_ADMIN_EMAIL].revenue += maintenance;
                    } else {
                       statsMap[email].revenue += maintenance; 
                    }
                }
            }
        }
    });

    const statsArray = Object.values(statsMap);
    statsArray.sort((a, b) => b.revenue - a.revenue || b.clientsCount - a.clientsCount);

    tbody.innerHTML = '';
    if (statsArray.length === 0) {
        tableContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
    } else {
        tableContainer.classList.remove('hidden');
        emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');

        statsArray.forEach((stat, index) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-100/50 dark:hover:bg-gray-800/30 transition-colors border-b border-gray-200 dark:border-gray-800/50 last:border-0";

            let rankHtml = `<span class="font-bold text-gray-500 dark:text-gray-400">#${index + 1}</span>`;
            if (index === 0) rankHtml = `<span class="text-xl">🥇</span>`;
            else if (index === 1) rankHtml = `<span class="text-xl">🥈</span>`;
            else if (index === 2) rankHtml = `<span class="text-xl">🥉</span>`;

            tr.innerHTML = `
                <td class="p-3 md:p-4 text-center">${rankHtml}</td>
                <td class="p-3 md:p-4">
                    <div class="flex items-center gap-2 md:gap-3">
                        <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-400 font-bold text-sm shrink-0 border border-gray-300 dark:border-transparent">
                            ${stat.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p class="font-medium text-gray-900 dark:text-gray-200 text-sm">${stat.name}</p>
                            <p class="text-[10px] text-gray-500">${stat.email}</p>
                        </div>
                    </div>
                </td>
                <td class="p-3 md:p-4 text-center font-medium text-gray-900 dark:text-gray-200">${stat.clientsCount}</td>
                <td class="p-3 md:p-4 text-right font-bold text-green-600 dark:text-green-500">₹${stat.revenue.toLocaleString('en-IN')}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

const leaderboardFilter = document.getElementById('leaderboard-filter');
if(leaderboardFilter) leaderboardFilter.addEventListener('change', renderLeaderboard);

window.loadMoreClients = function() {
    currentPage++;
    renderClientTable(false); 
};
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
const debouncedSearch = debounce(() => renderClientTable(true), 300);
function renderClientTable(resetPage = false) {
    if (resetPage) currentPage = 1;
    const tbody = document.getElementById('clients-tbody');
    const emptyState = document.getElementById('empty-state');
    const loadMoreBtnContainer = document.getElementById('load-more-container');
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('filter-status');
    const ownerFilter = document.getElementById('filter-owner');
    
    if(!tbody || !emptyState || !loadMoreBtnContainer) return;

    const searchQ = searchInput ? searchInput.value.toLowerCase() : '';
    const statusQ = statusFilter ? statusFilter.value : 'All';
    const ownerQ = ownerFilter ? ownerFilter.value : 'All';

    const filtered = clientsList.filter(client => {
        const matchSearch = client.name.toLowerCase().includes(searchQ) || client.phone.includes(searchQ);
        const matchStatus = statusQ === 'All' || client.status === statusQ;
        const matchOwner = ownerQ === 'All' || (ownerQ === 'Mine' && client.addedByEmail === currentUser.email);
        
        return matchSearch && matchStatus && matchOwner;
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
            
            const expected = Math.max(0, (Number(client.price) || 0) - (Number(client.discount) || 0)) + (Number(client.extraCharge) || 0) + (Number(client.maintenanceCharge) || 0);
            const paid = calculatePaidAmount(client);
            const balance = Math.max(0, expected - paid);

            let financeHtml = `<div>
                <p class="font-medium text-gray-900 dark:text-gray-200 text-sm md:text-base">₹${expected.toLocaleString('en-IN')}</p>
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
                    <button onclick="event.stopPropagation(); openModal('${client.id}')" class="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors" title="View Details">
                        <i class="ph ph-eye text-base md:text-lg"></i>
                    </button>
                    <a href="https://wa.me/${client.phone.replace(/[^0-9]/g, '')}" target="_blank" onclick="event.stopPropagation();" class="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition-colors" title="WhatsApp">
                        <i class="ph ph-whatsapp-logo text-base md:text-lg"></i>
                    </a>
                    ${canEdit ? `<button onclick="event.stopPropagation(); editClient('${client.id}')" class="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-400 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors" title="Edit">
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

const searchInputEl = document.getElementById('search-input');
if(searchInputEl) searchInputEl.addEventListener('input', debouncedSearch);

const filterStatusEl = document.getElementById('filter-status');
if(filterStatusEl) filterStatusEl.addEventListener('change', () => renderClientTable(true));

const filterOwnerEl = document.getElementById('filter-owner');
if(filterOwnerEl) filterOwnerEl.addEventListener('change', () => renderClientTable(true));

function renderActivityLog(client) {
    const logContainer = document.getElementById('modal-activity-log');
    if(!logContainer) return;
    const logArray = client.activityLog || [];
    
    if (logArray.length === 0) {
        logContainer.innerHTML = '<p class="text-xs text-gray-500 px-2 py-1">No past activity recorded for this client.</p>';
    } else {
        const sortedLog = logArray.sort((a,b) => b.timestamp - a.timestamp);
        logContainer.innerHTML = sortedLog.map(log => `
            <div class="border-l-2 border-gray-200 dark:border-gray-700 ml-1.5 pl-4 pb-4 last:pb-0 relative">
                <div class="absolute w-2.5 h-2.5 rounded-full bg-accentRed -left-[5.5px] top-1"></div>
                <p class="text-xs md:text-sm text-gray-800 dark:text-gray-200"><span class="font-semibold text-gray-900 dark:text-white">${log.performedBy}</span> ${log.action.toLowerCase()}</p>
                <p class="text-[10px] text-gray-500 mt-0.5">${new Date(log.timestamp).toLocaleString('en-IN')}</p>
            </div>
        `).join('');
    }
}

const modal = document.getElementById('client-modal');
window.openModal = function(id) {
    const client = clientsList.find(c => c.id === id);
    if(!client) return;
    
    document.getElementById('modal-name').innerText = client.name;
    document.getElementById('modal-business').innerText = client.business || 'N/A';
    document.getElementById('modal-phone').innerText = client.phone;
    document.getElementById('modal-email').innerText = client.email || 'N/A';
    document.getElementById('modal-address').innerText = client.address || 'N/A';
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
    
    const extraCharge = Number(client.extraCharge) || 0;
    const maintenanceCharge = Number(client.maintenanceCharge) || 0;
    const discount = Number(client.discount) || 0;
    const paidAmount = calculatePaidAmount(client);
    const totalExpected = Math.max(0, (Number(client.price) || 0) - discount) + extraCharge + maintenanceCharge;
    const balance = Math.max(0, totalExpected - paidAmount);

    document.getElementById('modal-price').innerText = `₹${totalExpected.toLocaleString('en-IN')}`;
    document.getElementById('modal-advance').innerText = `₹${paidAmount.toLocaleString('en-IN')}`;
    
    document.getElementById('modal-price-breakdown').innerText = `Price: ₹${Number(client.price || 0).toLocaleString('en-IN')} | Discount: ₹${discount.toLocaleString('en-IN')} | Extra: ₹${extraCharge.toLocaleString('en-IN')} | Maint: ₹${maintenanceCharge.toLocaleString('en-IN')}`;

    const balanceEl = document.getElementById('modal-balance');
    if (client.status === 'Completed' || balance <= 0) {
        balanceEl.innerText = 'Fully Paid';
        balanceEl.className = 'font-bold text-xl text-green-600 dark:text-green-500';
    } else {
        balanceEl.innerText = `₹${balance.toLocaleString('en-IN')}`;
        balanceEl.className = 'font-bold text-xl text-accentRed';
    }

    let instHtml = '';
    if (client.installments && client.installments.length > 0) {
        instHtml = client.installments.map(i => {
            const isPaid = i.status === 'Paid' || client.status === 'Completed';
            const displayStatus = client.status === 'Completed' ? 'Paid' : i.status;
            return `
            <div class="flex justify-between items-center py-2.5 border-b border-gray-200 dark:border-gray-700 last:border-0">
                <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">${i.title || 'Installment'}</p>
                    <p class="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5"><i class="ph ph-calendar-blank"></i> ${i.date ? new Date(i.date).toLocaleDateString('en-IN', {month:'short', day:'numeric', year:'numeric'}) : 'No due date'}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">₹${Number(i.amount).toLocaleString('en-IN')}</p>
                    <span class="text-[10px] font-medium px-2.5 py-0.5 rounded-full ${isPaid ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500'}">${displayStatus}</span>
                </div>
            </div>
        `}).join('');
    } else {
        instHtml = '<p class="text-xs text-gray-500 italic">No milestone data recorded for this client.</p>';
    }
    document.getElementById('modal-installments-list').innerHTML = instHtml;

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
    
    const invoiceBtn = document.getElementById('modal-invoice-btn');
    if (invoiceBtn) {
        invoiceBtn.onclick = () => openInvoiceModal(id);
    }
    
    const canEdit = isSuperAdminUser || client.addedByEmail === currentUser.email;
    const editBtn = document.getElementById('modal-edit-btn');
    if (canEdit) {
        editBtn.classList.remove('hidden');
        editBtn.onclick = () => editClient(id);
    } else {
        editBtn.classList.add('hidden');
    }
    
    const deleteBtn = document.getElementById('modal-delete-btn');
    if (isSuperAdminUser) {
        deleteBtn.classList.remove('hidden');
        deleteBtn.onclick = () => showDeleteModal(id);
    } else {
        deleteBtn.classList.add('hidden');
    }
    
    renderActivityLog(client);
    if(modal) modal.classList.remove('hidden');
};

window.closeModal = function() {
    if(modal) modal.classList.add('hidden');
};

if(modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

const logoutModal = document.getElementById('logout-modal');
if(logoutModal) {
    logoutModal.addEventListener('click', (e) => {
        if (e.target === logoutModal) hideLogoutModal();
    });
}

let clientToDelete = null;

window.showDeleteModal = function(id) {
    clientToDelete = id;
    const deleteModal = document.getElementById('delete-confirm-modal');
    if(deleteModal) deleteModal.classList.remove('hidden');
};

window.hideDeleteModal = function() {
    clientToDelete = null;
    const deleteModal = document.getElementById('delete-confirm-modal');
    if(deleteModal) deleteModal.classList.add('hidden');
};

const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
if(confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
        if (!clientToDelete || !isSuperAdminUser) return;
        
        const btn = document.getElementById('confirm-delete-btn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-spinner animate-spin text-lg"></i>';
        btn.disabled = true;
        
        try {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', clientToDelete);
            await deleteDoc(docRef);
            showToast("Client deleted successfully.", "success");
            hideDeleteModal();
            closeModal();
        } catch (error) {
            showToast("Failed to delete client.", "error");
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return;
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

const setElText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };

window.openInvoiceModal = function(clientIdentifier, isRequestData = false) {
    const client = isRequestData 
        ? clientIdentifier 
        : clientsList.find(c => c.id === clientIdentifier);

    if (!client) return;

    const createdAtStr = client.createdAt ? client.createdAt.toString() : Date.now().toString();
    const invoiceNo = `FD-${createdAtStr.slice(-6)}`;
    
    setElText('inv-no', invoiceNo);
    setElText('inv-date', new Date().toLocaleDateString('en-IN'));
    setElText('inv-due-date', client.deadline ? new Date(client.deadline).toLocaleDateString('en-IN') : 'Upon Completion');
    setElText('inv-client-name', client.name);
    setElText('inv-client-business', client.business || 'N/A');
    setElText('inv-client-address', client.address || 'Address not provided');
    setElText('inv-client-phone', client.phone);
    setElText('inv-client-email', client.email || 'N/A');

    const deliveryDaysEl = document.getElementById('inv-delivery-days');
    if (deliveryDaysEl) {
        if (client.deadline) {
            const diffTime = Math.abs(new Date(client.deadline) - new Date().setHours(0,0,0,0));
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            deliveryDaysEl.innerText = diffDays > 0 ? diffDays : 'ASAP';
        } else {
            deliveryDaysEl.innerText = '7 - 14';
        }
    }

    const tbody = document.getElementById('inv-table-body');
    if (tbody) {
        tbody.innerHTML = '';
        let subtotal = 0;

        const addRow = (desc, amount) => {
            if (amount > 0) {
                subtotal += amount;
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50';
                tr.innerHTML = `
                    <td class="py-3 px-4 text-sm text-gray-800 border-b border-gray-100 font-medium">${desc}</td>
                    <td class="py-3 px-4 text-sm text-gray-600 border-b border-gray-100 text-center">1</td>
                    <td class="py-3 px-4 text-sm text-gray-600 border-b border-gray-100 text-right">₹${amount.toLocaleString('en-IN')}</td>
                    <td class="py-3 px-4 text-sm text-brandDark font-semibold border-b border-gray-100 text-right">₹${amount.toLocaleString('en-IN')}</td>
                `;
                tbody.appendChild(tr);
            }
        };

        addRow(client.website || 'Website Design & Development', Number(client.price) || 0);
        addRow('Hosting, Domain & Server Setup', Number(client.extraCharge) || 0);
        addRow('Annual Maintenance & Support', Number(client.maintenanceCharge) || 0);

        const discount = Number(client.discount) || 0;
        const total = Math.max(0, subtotal - discount);
        const paidAmount = calculatePaidAmount(client);
        const balance = Math.max(0, total - paidAmount);

        setElText('inv-subtotal', `₹${subtotal.toLocaleString('en-IN')}`);
        setElText('inv-discount', `- ₹${discount.toLocaleString('en-IN')}`);
        setElText('inv-total', `₹${total.toLocaleString('en-IN')}`);
        setElText('inv-paid', `- ₹${paidAmount.toLocaleString('en-IN')}`);
        setElText('inv-balance', `₹${balance.toLocaleString('en-IN')}`);

        const stamp = document.getElementById('inv-paid-stamp');
        if (stamp) {
            if ((balance <= 0 && total > 0) || client.status === 'Completed') {
                stamp.classList.remove('hidden');
            } else {
                stamp.classList.add('hidden');
            }
        }
    }

    const milestonesWrapper = document.getElementById('inv-payment-milestones-wrapper');
    const milestonesList = document.getElementById('inv-milestones-list');
    
    if (milestonesWrapper && milestonesList) {
        milestonesList.innerHTML = '';
        if (client.installments && client.installments.length > 0) {
            milestonesWrapper.classList.remove('hidden');
            client.installments.forEach(inst => {
                const dateText = inst.date ? new Date(inst.date).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}) : 'N/A';
                const isPaid = inst.status === 'Paid' || client.status === 'Completed';
                const statusColor = isPaid ? 'text-green-600' : 'text-accentRed';
                
                const row = document.createElement('div');
                row.className = 'flex justify-between text-xs text-gray-600';
                row.innerHTML = `
                    <span class="w-1/2 font-medium">${inst.title || 'Milestone'}</span>
                    <span class="w-1/4">${dateText}</span>
                    <span class="w-1/4 text-right font-semibold ${statusColor}">${isPaid ? 'Paid' : 'Due'}: ₹${Number(inst.amount).toLocaleString('en-IN')}</span>
                `;
                milestonesList.appendChild(row);
            });
        } else if (client.advance > 0) {
            milestonesWrapper.classList.remove('hidden');
            const row = document.createElement('div');
            row.className = 'flex justify-between text-xs text-gray-600';
            row.innerHTML = `
                <span class="w-1/2 font-medium">Advance Payment</span>
                <span class="w-1/4">-</span>
                <span class="w-1/4 text-right font-semibold text-green-600">Paid: ₹${Number(client.advance).toLocaleString('en-IN')}</span>
            `;
            milestonesList.appendChild(row);
        } else {
            milestonesWrapper.classList.add('hidden');
        }
    }

    window.currentInvoiceFilename = `Invoice_${invoiceNo}_${client.name.replace(/\s+/g, '_')}.pdf`;

    const invModal = document.getElementById('invoice-modal');
    if (invModal) {
        invModal.classList.remove('hidden');
        invModal.classList.add('flex');
    } else {
        showToast('Invoice layout structure is missing.', 'error');
    }
};

window.closeInvoiceModal = function() {
    const invModal = document.getElementById('invoice-modal');
    if (invModal) {
        invModal.classList.add('hidden');
        invModal.classList.remove('flex');
    }
};

window.downloadInvoicePDF = function() {
    const element = document.getElementById('invoice-content');
    const btn = document.getElementById('btn-download-pdf');
    
    if (!element) {
        showToast('Cannot find invoice content.', 'error');
        return;
    }

    const opt = {
        margin:       0,
        filename:     window.currentInvoiceFilename || 'Falconix_Invoice.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="ph ph-spinner animate-spin text-xl"></i> Generating...`;
        btn.disabled = true;
    }

    try {
        html2pdf().set(opt).from(element).save().then(() => {
            if (btn) {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
            showToast('Invoice PDF Downloaded Successfully!', 'success');
        }).catch(err => {
            if (btn) {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
            showToast('Error saving PDF file.', 'error');
        });
    } catch(err) {
        showToast('PDF Library failed to load.', 'error');
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
};

function updateRequestsBadge() {
    if (!isSuperAdminUser) return;
    
    const pendingCount = requestsList.filter(r => r.status === 'Pending').length;
    const badge = document.getElementById('nav-badge-requests');
    
    if (badge) {
        badge.innerText = pendingCount > 9 ? '9+' : pendingCount;
        if (pendingCount > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

function renderRequestsTable() {
    const tbody = document.getElementById('requests-tbody');
    const emptyState = document.getElementById('requests-empty-state');
    if(!tbody || !emptyState) return;
    
    const theadTr = tbody.previousElementSibling.querySelector('tr');
    
    const titleEl = document.querySelector('#view-requests h2');
    const descEl = document.querySelector('#view-requests p');
    
    tbody.innerHTML = '';
    
    let visibleReqs = [];
    if (isSuperAdminUser) {
        if(titleEl) titleEl.innerText = "Pending Requests";
        if(descEl) descEl.innerText = "Review client additions and updates from the team.";
        visibleReqs = requestsList.filter(r => r.status === 'Pending').sort((a,b) => b.createdAt - a.createdAt);
        
        theadTr.innerHTML = `
            <th class="p-3 md:p-4 font-medium">Requested By</th>
            <th class="p-3 md:p-4 font-medium">Type</th>
            <th class="p-3 md:p-4 font-medium">Client Name</th>
            <th class="p-3 md:p-4 font-medium text-right">Actions</th>
        `;
    } else {
        if(titleEl) titleEl.innerText = "My Requests";
        if(descEl) descEl.innerText = "Track the status of your submitted clients and updates.";
        visibleReqs = requestsList.filter(r => r.requestedByEmail === currentUser.email).sort((a,b) => b.createdAt - a.createdAt);
        
        theadTr.innerHTML = `
            <th class="p-3 md:p-4 font-medium">Date</th>
            <th class="p-3 md:p-4 font-medium">Type</th>
            <th class="p-3 md:p-4 font-medium">Client Name</th>
            <th class="p-3 md:p-4 font-medium text-right">Status / View</th>
        `;
    }

    if (visibleReqs.length === 0) {
        tbody.parentElement.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
        
        if (isSuperAdminUser) {
            const h3 = emptyState.querySelector('h3');
            const p = emptyState.querySelector('p');
            if(h3) h3.innerText = "All caught up!";
            if(p) p.innerText = "There are no pending requests to review.";
        } else {
            const h3 = emptyState.querySelector('h3');
            const p = emptyState.querySelector('p');
            if(h3) h3.innerText = "No requests";
            if(p) p.innerText = "You haven't submitted any requests yet.";
        }
    } else {
        tbody.parentElement.classList.remove('hidden');
        emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');
        
        visibleReqs.forEach(req => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-100/50 dark:hover:bg-gray-800/30 transition-colors border-b border-gray-200 dark:border-gray-800/50 last:border-0";
            
            let col1Html = '';
            let col4Html = '';
            
            if (isSuperAdminUser) {
                col1Html = `
                    <p class="font-medium text-gray-900 dark:text-gray-200">${req.requestedByName}</p>
                    <p class="text-[10px] md:text-xs text-gray-500">${req.requestedByEmail}</p>
                `;
                col4Html = `
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="viewRequestDetails('${req.id}')" class="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm">View</button>
                        <button onclick="approveReq('${req.id}')" class="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-green-600 transition-colors shadow-sm">Approve</button>
                        <button onclick="rejectReq('${req.id}')" class="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-red-600 transition-colors shadow-sm">Reject</button>
                    </div>
                `;
            } else {
                const d = new Date(req.createdAt);
                col1Html = `
                    <p class="font-medium text-gray-900 dark:text-gray-200 text-sm md:text-base">${d.toLocaleDateString('en-IN', {day:'numeric', month:'short'})}</p>
                    <p class="text-[10px] md:text-xs text-gray-500">${d.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}</p>
                `;
                
                let statusColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500';
                if(req.status === 'Approved') statusColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500';
                if(req.status === 'Rejected') statusColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500';
                
                col4Html = `
                    <div class="flex items-center justify-end gap-2">
                        <span class="px-3 py-1 rounded-full text-[10px] md:text-xs font-medium ${statusColor}">${req.status}</span>
                        <button onclick="viewRequestDetails('${req.id}')" class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors" title="View Details">
                            <i class="ph ph-eye text-base md:text-lg"></i>
                        </button>
                    </div>
                `;
            }
            
            tr.innerHTML = `
                <td class="p-3 md:p-4">${col1Html}</td>
                <td class="p-3 md:p-4">
                    <span class="px-2 py-1 rounded-full text-[10px] md:text-xs font-medium ${req.type === 'ADD' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500'}">${req.type}</span>
                </td>
                <td class="p-3 md:p-4 text-gray-900 dark:text-gray-200 font-medium text-sm md:text-base">${req.clientData.name}</td>
                <td class="p-3 md:p-4 text-right">${col4Html}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

window.viewRequestDetails = function(reqId) {
    const req = requestsList.find(r => r.id === reqId);
    if(!req) return;
    
    const client = req.clientData;
    
    document.getElementById('modal-name').innerText = client.name + ` (${req.type} Request)`;
    document.getElementById('modal-business').innerText = client.business || 'N/A';
    document.getElementById('modal-phone').innerText = client.phone;
    document.getElementById('modal-email').innerText = client.email || 'N/A';
    document.getElementById('modal-address').innerText = client.address || 'N/A';
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
    
    const extraCharge = Number(client.extraCharge) || 0;
    const maintenanceCharge = Number(client.maintenanceCharge) || 0;
    const discount = Number(client.discount) || 0;
    const paidAmount = calculatePaidAmount(client);
    const totalExpected = Math.max(0, (Number(client.price) || 0) - discount) + extraCharge + maintenanceCharge;
    const balance = Math.max(0, totalExpected - paidAmount);

    document.getElementById('modal-price').innerText = `₹${totalExpected.toLocaleString('en-IN')}`;
    document.getElementById('modal-advance').innerText = `₹${paidAmount.toLocaleString('en-IN')}`;
    document.getElementById('modal-price-breakdown').innerText = `Price: ₹${Number(client.price || 0).toLocaleString('en-IN')} | Discount: ₹${discount.toLocaleString('en-IN')} | Extra: ₹${extraCharge.toLocaleString('en-IN')} | Maint: ₹${maintenanceCharge.toLocaleString('en-IN')}`;

    const balanceEl = document.getElementById('modal-balance');
    if (client.status === 'Completed' || balance <= 0) {
        balanceEl.innerText = 'Fully Paid';
        balanceEl.className = 'font-bold text-xl text-green-600 dark:text-green-500';
    } else {
        balanceEl.innerText = `₹${balance.toLocaleString('en-IN')}`;
        balanceEl.className = 'font-bold text-xl text-accentRed';
    }

    let instHtml = '';
    if (client.installments && client.installments.length > 0) {
        instHtml = client.installments.map(i => {
            const isPaid = i.status === 'Paid' || client.status === 'Completed';
            const displayStatus = client.status === 'Completed' ? 'Paid' : i.status;
            return `
            <div class="flex justify-between items-center py-2.5 border-b border-gray-200 dark:border-gray-700 last:border-0">
                <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">${i.title || 'Installment'}</p>
                    <p class="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5"><i class="ph ph-calendar-blank"></i> ${i.date ? new Date(i.date).toLocaleDateString('en-IN', {month:'short', day:'numeric', year:'numeric'}) : 'No due date'}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">₹${Number(i.amount).toLocaleString('en-IN')}</p>
                    <span class="text-[10px] font-medium px-2.5 py-0.5 rounded-full ${isPaid ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500'}">${displayStatus}</span>
                </div>
            </div>
        `}).join('');
    } else {
        instHtml = '<p class="text-xs text-gray-500 italic">No milestone data recorded.</p>';
    }
    document.getElementById('modal-installments-list').innerHTML = instHtml;

    document.getElementById('modal-deadline').innerHTML = client.deadline ? `<i class="ph ph-calendar"></i> ${new Date(client.deadline).toLocaleDateString('en-IN', {year:'numeric', month:'short', day:'numeric'})}` : 'Not Set';
    document.getElementById('modal-notes').innerText = client.notes || 'No notes or tasks provided.';
    
    const statusEl = document.getElementById('modal-status');
    statusEl.innerText = client.status;
    statusEl.className = `inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(client.status)}`;
    
    const addedByEl = document.getElementById('modal-added-by');
    if (req.requestedByName) {
        addedByEl.innerText = `Requested by: ${req.requestedByName} (${req.requestedByEmail})`;
        addedByEl.classList.remove('hidden');
    } else {
        addedByEl.classList.add('hidden');
    }
    
    const cleanPhone = client.phone.replace(/[^0-9]/g, '');
    const whatsappEl = document.getElementById('modal-whatsapp');
    if(whatsappEl) whatsappEl.href = `https://wa.me/${cleanPhone}`;
    
    const invoiceBtn = document.getElementById('modal-invoice-btn');
    if(invoiceBtn) {
        invoiceBtn.classList.remove('hidden');
        invoiceBtn.onclick = () => openInvoiceModal(client, true); 
    }
    
    const editBtn = document.getElementById('modal-edit-btn');
    if(editBtn) editBtn.classList.add('hidden');
    
    const deleteBtn = document.getElementById('modal-delete-btn');
    if(deleteBtn) deleteBtn.classList.add('hidden');
    
    renderActivityLog(client);
    if(modal) modal.classList.remove('hidden');
};

window.approveReq = async function(reqId) {
    const req = requestsList.find(r => r.id === reqId);
    if(!req) return;
    try {
        const approvedClientData = { ...req.clientData };
        approvedClientData.activityLog = approvedClientData.activityLog || [];
        approvedClientData.activityLog.push({
            action: `Approved the update request`,
            performedBy: ADMIN_NAMES[currentUser.email.toLowerCase()] || "Super Admin",
            timestamp: Date.now()
        });

        const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', req.targetClientId);
        await setDoc(clientRef, approvedClientData);
        
        const reqRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', reqId);
        await updateDoc(reqRef, { status: 'Approved' });

        const notifRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'));
        await setDoc(notifRef, {
            recipientEmail: 'all',
            message: `${req.requestedByName}'s request to ${req.type.toLowerCase()} client "${req.clientData.name}" was approved!`,
            readBy: [],
            createdAt: Date.now(),
            type: 'success'
        });

        showToast("Request Approved Successfully", "success");
    } catch(e) { 
        showToast("Error approving request", "error"); 
    }
};

window.rejectReq = async function(reqId) {
    const req = requestsList.find(r => r.id === reqId);
    if(!req) return;
    try {
        const reqRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', reqId);
        await updateDoc(reqRef, { status: 'Rejected' });

        const notifRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'));
        await setDoc(notifRef, {
            recipientEmail: 'all',
            message: `${req.requestedByName}'s request to ${req.type.toLowerCase()} client "${req.clientData.name}" was rejected.`,
            readBy: [],
            createdAt: Date.now(),
            type: 'error'
        });

        showToast("Request Rejected", "info");
    } catch(e) { 
        showToast("Error rejecting request", "error"); 
    }
};

function renderNotifications() {
    const myNotifs = notificationsList
        .sort((a,b) => b.createdAt - a.createdAt);

    const unreadCount = myNotifs.filter(n => n.readBy ? !n.readBy.includes(currentUser.email) : !n.read).length;
    const badge = document.getElementById('nav-badge-notifications');
    if (badge) {
        badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
        if (unreadCount > 0) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
    }

    const listEl = document.getElementById('notifications-list');
    const emptyEl = document.getElementById('notifications-empty-state');
    if (!listEl || !emptyEl) return;

    listEl.innerHTML = '';
    if (myNotifs.length === 0) {
        emptyEl.classList.remove('hidden');
        emptyEl.classList.add('flex');
    } else {
        emptyEl.classList.add('hidden');
        emptyEl.classList.remove('flex');
        myNotifs.forEach(n => {
            const isRead = n.readBy ? n.readBy.includes(currentUser.email) : n.read;
            const div = document.createElement('div');
            div.className = `p-3 md:p-4 rounded-xl border ${isRead ? 'bg-gray-50/50 dark:bg-gray-800/20 border-gray-200 dark:border-gray-800' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30'} flex items-start gap-3 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50`;
            div.onclick = () => markNotificationRead(n.id, isRead);
            
            const iconColor = n.type === 'success' ? 'text-green-500' : (n.type === 'error' ? 'text-red-500' : 'text-blue-500');
            const iconClass = n.type === 'success' ? 'ph-check-circle' : (n.type === 'error' ? 'ph-x-circle' : 'ph-info');

            div.innerHTML = `
                <i class="ph ${iconClass} text-xl ${iconColor} mt-0.5 shrink-0"></i>
                <div class="flex-1">
                    <p class="text-sm font-medium ${isRead ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100'}">${n.message}</p>
                    <p class="text-[10px] md:text-xs text-gray-500 mt-1">${new Date(n.createdAt).toLocaleString('en-IN')}</p>
                </div>
                ${!isRead ? '<div class="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>' : ''}
            `;
            listEl.appendChild(div);
        });
    }
}

window.markNotificationRead = async function(id, isRead) {
    if (isRead) return; 
    try {
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'notifications', id);
        await updateDoc(ref, { 
            readBy: arrayUnion(currentUser.email),
            read: true 
        });
    } catch(e) {
        console.error(e);
    }
};

window.markAllNotificationsRead = async function() {
    const unread = notificationsList.filter(n => n.readBy ? !n.readBy.includes(currentUser.email) : !n.read);
    if (unread.length === 0) return;
    try {
        const promises = unread.map(n => {
            const ref = doc(db, 'artifacts', appId, 'public', 'data', 'notifications', n.id);
            return updateDoc(ref, { 
                readBy: arrayUnion(currentUser.email),
                read: true
            });
        });
        await Promise.all(promises);
    } catch (e) {
        console.error(e);
    }
}
