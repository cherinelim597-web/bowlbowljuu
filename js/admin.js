// ============================================
// 管理後台主邏輯（無 Auth）
// ============================================

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
function initAdmin() {
    if (!checkAdminAuth()) return;
    
    // 綁定登出按鈕
    document.getElementById('logoutBtn')?.addEventListener('click', adminLogout);
    
    // 加載儀表板
    if (typeof loadDashboard === 'function') loadDashboard();
}

// 頁面加載時初始化
document.addEventListener('DOMContentLoaded', initAdmin);