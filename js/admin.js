// ============================================
// 管理後台主邏輯
// ============================================

let currentPage = 'dashboard';

// 顯示頁面
async function showPage(page) {
    currentPage = page;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === page) {
            item.classList.add('active');
        }
    });
    
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    
    const targetPage = document.getElementById(`page_${page}`);
    if (targetPage) targetPage.classList.add('active');
    
    switch(page) {
        case 'dashboard':
            if (typeof loadDashboard === 'function') await loadDashboard();
            break;
        case 'users':
            if (typeof loadUsersPage === 'function') await loadUsersPage();
            break;
        case 'deliveries':
            if (typeof loadDeliveriesPage === 'function') await loadDeliveriesPage();
            break;
        case 'receipts':
            if (typeof loadReceiptsPage === 'function') await loadReceiptsPage();
            break;
        case 'reports':
            if (typeof loadReportsPage === 'function') await loadReportsPage();
            break;
    }
    
    const titles = { 
        dashboard: '儀表板', 
        users: '用戶管理', 
        deliveries: '每日配送', 
        receipts: '收據管理', 
        reports: '報表統計' 
    };
    document.getElementById('pageTitle').innerText = titles[page] || page;
}

// 檢查管理員登入
function checkAdminAuth() {
    const isLoggedIn = localStorage.getItem('adminLoggedIn');
    const adminEmail = localStorage.getItem('adminEmail');
    
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'admin-login.html';
        return false;
    }
    
    document.getElementById('adminEmail').innerText = adminEmail || 'Admin';
    return true;
}

// 登出
function adminLogout() {
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('adminEmail');
    window.location.href = 'admin-login.html';
}

// 初始化
async function initAdmin() {
    if (!checkAdminAuth()) return;
    
    document.getElementById('logoutBtn')?.addEventListener('click', adminLogout);
    await showPage('dashboard');
}

// 啟動
initAdmin();