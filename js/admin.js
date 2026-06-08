// ============================================
// 管理後台主邏輯
// ============================================

const ADMIN_EMAIL_MAIN = "admin@cherinebowl.com";
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
    
    const titles = { dashboard: 'Dashboard', users: 'User Management', deliveries: 'Daily Delivery', receipts: 'Receipts', reports: 'Reports' };
    document.getElementById('pageTitle').innerText = titles[page] || page;
}

// 檢查管理員登入
async function checkAdminAuth() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    
    if (error || !user) {
        window.location.href = 'login.html';
        return null;
    }
    
    // 只允許 admin@cherinebowl.com 登入後台
    if (user.email !== ADMIN_EMAIL_MAIN) {
        alert('You do not have admin privileges');
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
        return null;
    }
    
    document.getElementById('adminEmail').innerText = user.email;
    return user;
}

// 初始化
async function initAdmin() {
    const user = await checkAdminAuth();
    if (!user) return;
    
    // 綁定導航事件
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            if (page) showPage(page);
        });
    });
    
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    });
    
    await showPage('dashboard');
}

// 啟動
initAdmin();