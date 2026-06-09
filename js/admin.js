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
    if (targetPage) targetPage.classList.add('active');
    
    // 根據頁面加載對應數據
    try {
        switch(page) {
            case 'dashboard':
                if (typeof loadDashboard === 'function') {
                    await loadDashboard();
                } else {
                    console.error('loadDashboard not defined');
                    document.getElementById('page_dashboard').innerHTML = '<div class="table-container"><p>加載失敗：函數未定義</p></div>';
                }
                break;
            case 'users':
                if (typeof loadUsersPage === 'function') {
                    await loadUsersPage();
                } else {
                    console.error('loadUsersPage not defined');
                    document.getElementById('page_users').innerHTML = '<div class="table-container"><p>加載失敗：函數未定義</p></div>';
                }
                break;
            case 'deliveries':
                if (typeof loadDeliveriesPage === 'function') {
                    await loadDeliveriesPage();
                } else {
                    console.error('loadDeliveriesPage not defined');
                    document.getElementById('page_deliveries').innerHTML = '<div class="table-container"><p>加載失敗：函數未定義</p></div>';
                }
                break;
case 'invitations':
    if (typeof loadInvitationsPage === 'function') {
        await loadInvitationsPage();
    } else {
        console.error('loadInvitationsPage not defined');
        document.getElementById('page_invitations').innerHTML = '<div class="table-container"><p>加載失敗：函數未定義</p></div>';
    }
    break;
            case 'receipts':
                if (typeof loadReceiptsPage === 'function') {
                    await loadReceiptsPage();
                } else {
                    console.error('loadReceiptsPage not defined');
                    document.getElementById('page_receipts').innerHTML = '<div class="table-container"><p>加載失敗：函數未定義</p></div>';
                }
                break;
            case 'reports':
                if (typeof loadReportsPage === 'function') {
                    await loadReportsPage();
                } else {
                    console.error('loadReportsPage not defined');
                    document.getElementById('page_reports').innerHTML = '<div class="table-container"><p>加載失敗：函數未定義</p></div>';
                }
                break;
            default:
                console.log('Unknown page:', page);
        }
    } catch (err) {
        console.error(`Error loading ${page}:`, err);
        const pageContainer = document.getElementById(`page_${page}`);
        if (pageContainer) {
            pageContainer.innerHTML = '<div class="table-container"><p>加載失敗，請刷新頁面</p></div>';
        }
    }
    
    // 更新標題
    const titles = { 
        dashboard: '儀表板', 
        users: '用戶管理', 
        deliveries: '每日配送', 
        invitations: '邀請記錄',
        receipts: '收據管理', 
        reports: '報表統計' 
    };
    const titleElement = document.getElementById('pageTitle');
    if (titleElement) titleElement.innerText = titles[page] || page;
}

// 檢查管理員登入
function checkAdminAuth() {
    const isLoggedIn = localStorage.getItem('adminLoggedIn');
    const adminEmail = localStorage.getItem('adminEmail');
    
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'admin-login.html';
        return false;
    }
    
    const adminNameElement = document.getElementById('adminEmail');
    if (adminNameElement) adminNameElement.innerText = adminEmail || 'Admin';
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
    
    // 綁定導航點擊事件
    const navItems = document.querySelectorAll('.nav-item');
    console.log('Found nav items:', navItems.length);
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            console.log('Nav clicked:', page);
            if (page) showPage(page);
        });
    });
    
    // 綁定登出按鈕
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', adminLogout);
    }
    
    // 加載默認頁面
    await showPage('dashboard');
}

// 等待 DOM 加載完成後初始化
document.addEventListener('DOMContentLoaded', initAdmin);