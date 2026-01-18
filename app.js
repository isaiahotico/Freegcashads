
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTN7c", // Your Firebase API Key
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const tg = window.Telegram?.WebApp;
const telegramUserId = tg?.initDataUnsafe?.user ? String(tg.initDataUnsafe.user.id) : null;

// **IMPORTANT: THIS MUST MATCH THE ADMIN TELEGRAM ID IN YOUR FIREBASE SECURITY RULES.**
// This ID will be used to authenticate admin actions.
const adminTelegramId = "1234567890"; // <-- REPLACE THIS WITH YOUR ADMIN'S ACTUAL TELEGRAM ID

let firebaseUserId = null; // Will be set to adminTelegramId if logged in

// --- Pagination Configuration ---
const PAGE_SIZE = 10;
const pagination = {
    adminPending: { currentPage: 1, currentStartDoc: null, historyStack: [], unsubscribe: null, isEndOfList: false, lastFetchedDoc: null },
    adminHistory: { currentPage: 1, currentStartDoc: null, historyStack: [], unsubscribe: null, isEndOfList: false, lastFetchedDoc: null },
    globalStats: { unsubscribe: null }
};

function handleError(message, details = '') {
    alert("Admin operation failed: " + message + "\nDetails: " + details);
    console.error("Admin error:", message, details);
}

// --- Page Navigation for Admin App ---
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// Helper to unsubscribe all active admin listeners
function unsubscribeAllAdminListeners() {
    if (pagination.adminPending.unsubscribe) {
        pagination.adminPending.unsubscribe();
        pagination.adminPending.unsubscribe = null;
    }
    if (pagination.adminHistory.unsubscribe) {
        pagination.adminHistory.unsubscribe();
        pagination.adminHistory.unsubscribe = null;
    }
    if (pagination.globalStats.unsubscribe) {
        pagination.globalStats.unsubscribe();
        pagination.globalStats.unsubscribe = null;
    }
}

// --- Admin Login Logic ---
async function loginAdmin() {
    const passwordInput = document.getElementById("adminPasswordInput");
    const password = passwordInput.value;

    if (password === "Propetas6") { // Hardcoded password for admin access
        firebaseUserId = adminTelegramId; // Set admin's Telegram ID as firebaseUserId for operations
        localStorage.setItem('adminLoggedIn', 'true'); // Persist login state
        passwordInput.value = ""; // Clear password input
        loadAdminDashboard();
    } else {
        alert("Incorrect password!");
        passwordInput.value = "";
    }
}

function logoutAdmin() {
    localStorage.removeItem('adminLoggedIn');
    firebaseUserId = null;
    unsubscribeAllAdminListeners();
    showPage('adminLoginPage');
    window.location.reload(); // Refresh the page to clear all data
}

// --- Load Admin Dashboard Content ---
function loadAdminDashboard() {
    showPage('adminDashboardPage');
    unsubscribeAllAdminListeners(); // Clear any existing listeners

    // Listener for global stats
    pagination.globalStats.unsubscribe = db.collection("stats").doc("global").onSnapshot(d => {
        const data = d.data() || {};
        document.getElementById("statPHP").innerText = (data.paid || 0).toFixed(2);
        document.getElementById("statApprovedCount").innerText = data.approvedCount || 0;
        document.getElementById("statApprovedAmount").innerText = (data.approvedAmount || 0).toFixed(2);
    }, err => {
        console.error("Error fetching global stats:", err);
        handleError("Failed to load dashboard stats", err.message);
    });

    // Reset and load admin tables
    const resetPagination = (section) => {
        pagination[section].currentPage = 1;
        pagination[section].currentStartDoc = null;
        pagination[section].historyStack = [];
        pagination[section].lastFetchedDoc = null;
        pagination[section].isEndOfList = false;
        if (pagination[section].unsubscribe) {
            pagination[section].unsubscribe();
            pagination[section].unsubscribe = null;
        }
    };

    resetPagination('adminPending');
    resetPagination('adminHistory');

    loadAdminPendingRequests();
    loadAdminHistoryRequests();
}

// --- Pagination Helper Functions (Admin-specific) ---
function updatePaginationUI(section) {
    const pageData = pagination[section];
    const currentPageSpan = document.getElementById(`${section}CurrentPage`);
    if (currentPageSpan) currentPageSpan.innerText = pageData.currentPage;
    const prevButton = document.getElementById(`${section}Prev`);
    if (prevButton) prevButton.disabled = pageData.currentPage === 1;
    const nextButton = document.getElementById(`${section}Next`);
    if (nextButton) nextButton.disabled = pageData.isEndOfList;
}

// Universal pagination navigation logic (Admin-specific)
async function navigatePagination(section, direction) {
    if (!firebaseUserId) {
        handleError("Admin not logged in", "Cannot navigate pages.");
        return;
    }

    const pageData = pagination[section];

    if (direction === 1) { // Moving to next page
        if (pageData.isEndOfList) return;
        pageData.historyStack.push(pageData.lastFetchedDoc);
        pageData.currentPage++;
        pageData.currentStartDoc = pageData.historyStack.length > 0 ? pageData.historyStack[pageData.historyStack.length - 1] : null;
    } else if (direction === -1) { // Moving to previous page
        if (pageData.currentPage === 1) return;
        pageData.historyStack.pop();
        pageData.currentPage--;
        pageData.currentStartDoc = pageData.historyStack.length > 0 ? pageData.historyStack[pageData.historyStack.length - 1] : null;
    }

    if (pageData.unsubscribe) {
        pageData.unsubscribe();
        pageData.unsubscribe = null;
    }

    if (section === 'adminPending') loadAdminPendingRequests();
    else if (section === 'adminHistory') loadAdminHistoryRequests();

    updatePaginationUI(section);
}


// --- Load Admin Pending Requests with Pagination and Real-time Sync ---
function loadAdminPendingRequests() {
    if (!firebaseUserId) return; // Must be logged in as admin

    const pageData = pagination.adminPending;
    let query = db.collection("withdrawals")
        .where("status", "==", "pending")
        .orderBy("timestamp", "asc"); // Oldest first for pending

    if (pageData.currentStartDoc) {
        query = query.startAfter(pageData.currentStartDoc);
    }
    query = query.limit(PAGE_SIZE + 1);

    if (pageData.unsubscribe) {
        pageData.unsubscribe();
        pageData.unsubscribe = null;
    }

    // Set up the real-time listener
    pageData.unsubscribe = query.onSnapshot(snap => {
        const docs = snap.docs;
        const docsToDisplay = docs.slice(0, PAGE_SIZE);
        pageData.isEndOfList = docs.length <= PAGE_SIZE;

        let h = `<table><tr><th>Date</th><th>User</th><th>Amount (PHP/USDT)</th><th>Account Info</th><th>Actions</th></tr>`;

        if (docsToDisplay.length === 0) {
            h += `<tr><td colspan="5">${pageData.currentPage > 1 ? 'No more pending requests on this page.' : 'No pending withdrawal requests.'}</td></tr>`;
        } else {
            docsToDisplay.forEach(doc => {
                const d = doc.data();
                h += `<tr>
                        <td>${d.timeStr || 'N/A'}</td>
                        <td>${d.username || 'Unknown'}</td>
                        <td>${d.amountPHP ? d.amountPHP.toFixed(3) : '0.000'} PHP (${d.amountUSDT ? d.amountUSDT.toFixed(4) : '0.0000'} USDT)</td>
                        <td>${d.method || 'N/A'}: ${d.info || 'N/A'}</td>
                        <td>
                            <button onclick="admProcess('${doc.id}','paid',${d.amountPHP}, '${d.userId}')" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--success')}; color:white; border:none; padding: 5px 10px; border-radius: 5px; cursor:pointer;">Pay</button>
                            <button onclick="admProcess('${doc.id}','denied',${d.amountPHP}, '${d.userId}')" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--danger')}; color:white; border:none; padding: 5px 10px; border-radius: 5px; cursor:pointer; margin-left:5px;">Deny</button>
                        </td>
                      </tr>`;
            });
        }
        document.getElementById("adminPending").innerHTML = h + "</table>";

        pageData.lastFetchedDoc = docsToDisplay.length > 0 ? docsToDisplay[docsToDisplay.length - 1] : null;
        updatePaginationUI('adminPending');

    }, err => {
        console.error("Sync admin pending requests:", err);
        handleError("Failed to load pending withdrawal requests", err.message);
    });
}

// --- Load Admin History Requests (Approved/Denied) with Pagination and Real-time Sync ---
function loadAdminHistoryRequests() {
    if (!firebaseUserId) return; // Must be logged in as admin

    const pageData = pagination.adminHistory;
    let query = db.collection("withdrawals")
        .where("status", "!=", "pending") // Show paid or denied
        .orderBy("timestamp", "desc"); // Newest approved/denied first

    if (pageData.currentStartDoc) {
        query = query.startAfter(pageData.currentStartDoc);
    }
    query = query.limit(PAGE_SIZE + 1);

    if (pageData.unsubscribe) {
        pageData.unsubscribe();
        pageData.unsubscribe = null;
    }

    // Set up the real-time listener
    pageData.unsubscribe = query.onSnapshot(snap => {
        const docs = snap.docs;
        const docsToDisplay = docs.slice(0, PAGE_SIZE);
        pageData.isEndOfList = docs.length <= PAGE_SIZE;

        let h = `<table><tr><th>Date</th><th>User</th><th>Amount (PHP/USDT)</th><th>Account Info</th><th>Status</th></tr>`;

        if (docsToDisplay.length === 0) {
            h += `<tr><td colspan="5">${pageData.currentPage > 1 ? 'No more approved/denied history on this page.' : 'No approved or denied withdrawal history.'}</td></tr>`;
        } else {
            docsToDisplay.forEach(doc => {
                const d = doc.data();
                h += `<tr>
                        <td>${d.timeStr || 'N/A'}</td>
                        <td>${d.username || 'Unknown'}</td>
                        <td>${d.amountPHP ? d.amountPHP.toFixed(3) : '0.000'} PHP (${d.amountUSDT ? d.amountUSDT.toFixed(4) : '0.0000'} USDT)</td>
                        <td>${d.method || 'N/A'}: ${d.info || 'N/A'}</td>
                        <td class="status-${d.status}">${d.status.charAt(0).toUpperCase() + d.status.slice(1)}</td>
                      </tr>`;
            });
        }
        document.getElementById("adminHistory").innerHTML = h + "</table>";

        pageData.lastFetchedDoc = docsToDisplay.length > 0 ? docsToDisplay[docsToDisplay.length - 1] : null;
        updatePaginationUI('adminHistory');

    }, err => {
        console.error("Sync admin history:", err);
        handleError("Failed to load approved/denied withdrawal history", err.message);
    });
}

// Admin process function: handles paying or denying a withdrawal
async function admProcess(id, status, amountPHP, userId) {
    if (!firebaseUserId) {
        handleError("Admin not logged in", "Cannot process withdrawal.");
        return;
    }

    try {
        // Update the status of the withdrawal document in Firestore, including requesterId
        await db.collection("withdrawals").doc(id).set({
            status: status,
            requesterId: firebaseUserId // For security rules: identifies the admin
        }, { merge: true });

        if (status === 'paid') {
            // If paid, update global statistics, including requesterId
            await db.collection("stats").doc("global").set({
                paid: firebase.firestore.FieldValue.increment(amountPHP),
                approvedCount: firebase.firestore.FieldValue.increment(1),
                approvedAmount: firebase.firestore.FieldValue.increment(amountPHP),
                requesterId: firebaseUserId // For security rules
            }, { merge: true });
            alert(`Withdrawal for ID ${id} marked as paid.`);
        } else if (status === 'denied') {
            // If denied, return funds to the user's balance, including requesterId
            if (userId) {
                await db.collection("users").doc(userId).set({
                    balance: firebase.firestore.FieldValue.increment(amountPHP),
                    requesterId: firebaseUserId // For security rules
                }, { merge: true });
                alert(`Withdrawal for ID ${id} denied. Funds (${amountPHP.toFixed(3)} PHP) returned to user ${userId}.`);
            } else {
                 console.error("Could not return funds: User ID missing for denied request:", id);
                 alert("Withdrawal denied, but could not return funds due to missing user ID. Please check manually.");
            }
        }
    } catch (e) {
        handleError("Failed to process withdrawal", e.message);
    }
}


// --- Initial Callbacks ---
setInterval(() => { document.getElementById("clock").innerText = new Date().toLocaleString(); }, 1000);

document.addEventListener('DOMContentLoaded', () => {
    // Check if admin was previously logged in
    if (localStorage.getItem('adminLoggedIn') === 'true') {
        firebaseUserId = adminTelegramId; // Restore admin identity
        loadAdminDashboard();
    } else {
        showPage('adminLoginPage');
    }
});
