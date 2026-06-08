// ============================================
// 共用函數
// ============================================

let currentLanguage = 'en';

// 語言切換
function setLanguage(lang) {
    currentLanguage = lang;
    document.documentElement.lang = lang;
    localStorage.setItem('adminLang', lang);
    updateUIText();
}

function updateUIText() {
    const texts = {
        en: {
            'pageTitle': { dashboard: 'Dashboard', users: 'User Management', deliveries: 'Daily Delivery', receipts: 'Receipts', reports: 'Reports' }
        },
        zh: {
            'pageTitle': { dashboard: '儀表板', users: '用戶管理', deliveries: '每日配送', receipts: '收據管理', reports: '報表統計' }
        }
    };
    
    const page = document.querySelector('.page.active')?.id?.replace('page_', '');
    if (page && texts[currentLanguage]?.pageTitle?.[page]) {
        document.getElementById('pageTitle').innerText = texts[currentLanguage].pageTitle[page];
    }
}

// 顯示通知
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#2f6b3a' : '#7a2020'};
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 格式化日期
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString();
}

// 檢查管理員登入（改用 localStorage）
function checkAdminAuth() {
    const isLoggedIn = localStorage.getItem('adminLoggedIn');
    const adminEmail = localStorage.getItem('adminEmail');
    
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'admin-login.html';
        return false;
    }
    
    const adminName = document.getElementById('adminEmail');
    if (adminName) adminName.innerText = adminEmail || 'Admin';
    return true;
}