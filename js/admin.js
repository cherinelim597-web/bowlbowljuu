// ============================================
// 管理後台主邏輯
// ============================================

let currentPage = 'dashboard';

// 顯示頁面
async function showPage(page) {
    currentPage = page;
    
    // 更新導航樣式
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === page) {
            item.classList.add('active');
        }
    });
    
    // 隱藏所有頁面
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    
    // 顯示目標頁面
    const targetPage = document.getElementById(`page_${page}`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // 載入頁面數據
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
    
    // 更新標題
    const titles = { dashboard: 'Dashboard', users: 'User Management', deliveries: 'Daily Delivery', receipts: 'Receipts', reports: 'Reports' };
    document.getElementById('pageTitle').innerText = titles[page] || page;
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
    
    // 載入默認頁面
    await showPage('dashboard');
}

// 啟動
initAdmin();