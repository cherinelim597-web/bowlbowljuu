// ============================================
// 用戶管理模組 - 完整版（只優化您指定的部分）
// ============================================

// 數據緩存
let usersCache = {
    data: null,
    timestamp: 0,
    ttl: 60000,
    isValid() {
        return this.data && (Date.now() - this.timestamp) < this.ttl;
    }
};

// 方案配置
const PLAN_CONFIG = {
    single: { name: '單次', days: 1, price: 15.90 },
    weekly: { name: '週方案', days: 7, price: 111.30 },
    '1month': { name: '1個月', days: 30, price: 447 },
    '2months': { name: '2個月', days: 60, price: 834 },
    '3months': { name: '3個月', days: 90, price: 1161 }
};

const PAYMENT_METHODS = ['Credit Card', 'Bank Transfer', 'Cash On Delivery', 'Touch n Go', 'USDT'];
const SUBSCRIPTION_STATUS = ['active', 'expired', 'cancelled', 'paused'];

// ============================================
// 輔助函數
// ============================================

function getPlanName(planType) {
    return PLAN_CONFIG[planType]?.name || planType;
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#2d6a4f' : '#7a2020'};
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function generateUniqueInvitationCodeForAdmin() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const { data: existing } = await supabaseClient
        .from('users')
        .select('invitation_code')
        .eq('invitation_code', code)
        .maybeSingle();
    
    if (existing) {
        return generateUniqueInvitationCodeForAdmin();
    }
    return code;
}

function debounce(func, wait) {
    let timeout;
    return function() {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, arguments), wait);
    };
}

function getTodayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function generateOrderNoByDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const randomNum = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    return `ORD${year}${month}${day}${randomNum}`;
}

// 關閉彈窗的通用函數
function closeModal(modalElement) {
    if (modalElement && modalElement.remove) {
        modalElement.remove();
    }
}

// 處理 ESC 鍵關閉彈窗
function setupModalCloseOnEsc(modalElement, closeCallback) {
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            if (closeCallback) {
                closeCallback(modalElement);
            } else {
                closeModal(modalElement);
            }
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    
    // 返回清理函數
    return () => document.removeEventListener('keydown', handleKeyDown);
}

// ============================================
// 加載用戶列表
// ============================================

async function loadUsersPage() {
    const container = document.getElementById('page_users');
    if (!container) return;
    
    container.innerHTML = `
        <div class="stats-grid" style="margin-bottom: 24px;">
            ${[1,2,3,4].map(() => `<div class="stat-card"><div class="stat-icon"><i class="fas fa-spinner fa-pulse"></i></div><div class="stat-value">---</div><div class="stat-label">加載中...</div></div>`).join('')}
        </div>
        <div class="table-container"><div style="height: 400px;" class="loading-spinner"></div></div>
    `;
    
    try {
        if (usersCache.isValid()) {
            renderUsersPage(usersCache.data);
            return;
        }
        
        const { data: users, error: usersError } = await supabaseClient
            .from('users')
            .select('*')
            .neq('email', ADMIN_EMAIL)
            .order('created_at', { ascending: false });
        
        if (usersError) throw usersError;
        
        if (!users || users.length === 0) {
            container.innerHTML = '<div class="table-container"><p>暫無用戶</p></div>';
            return;
        }
        
        const userIds = users.map(u => u.id);
        
        const [subscriptionsResult, receiptsResult, deliveriesResult, paidSubscriptionsResult] = await Promise.all([
            supabaseClient.from('subscriptions').select('*').in('user_id', userIds),
            supabaseClient.from('receipts').select('*').in('user_id', userIds),
            supabaseClient.from('deliveries').select('*').in('user_id', userIds),
            supabaseClient.from('subscriptions').select('total_price').eq('payment_status', 'paid')
        ]);
        
        const subscriptions = subscriptionsResult.data || [];
        const receipts = receiptsResult.data || [];
        const deliveries = deliveriesResult.data || [];
        const paidSubscriptions = paidSubscriptionsResult.data || [];
        
        const totalRevenue = paidSubscriptions.reduce((sum, s) => sum + (s.total_price || 0), 0);
        
        const userSubscriptionsMap = new Map();
        const userReceiptsMap = new Map();
        const userDeliveriesMap = new Map();
        
        for (const sub of subscriptions) {
            if (!userSubscriptionsMap.has(sub.user_id)) {
                userSubscriptionsMap.set(sub.user_id, []);
            }
            userSubscriptionsMap.get(sub.user_id).push(sub);
        }
        
        for (const receipt of receipts) {
            const current = userReceiptsMap.get(receipt.user_id) || 0;
            userReceiptsMap.set(receipt.user_id, current + (receipt.amount || 0));
        }
        
        for (const delivery of deliveries) {
            if (delivery.status === 'delivered') {
                const current = userDeliveriesMap.get(delivery.user_id) || 0;
                userDeliveriesMap.set(delivery.user_id, current + 1);
            }
        }
        
        const userData = users.map(user => {
            const userSubs = userSubscriptionsMap.get(user.id) || [];
            const activeSub = userSubs.find(s => s.status === 'active');
            const userTotalPaid = userReceiptsMap.get(user.id) || 0;
            const deliveredCount = userDeliveriesMap.get(user.id) || 0;
            const paidOrdersCount = userSubs.filter(s => s.payment_status === 'paid').length;
            const unpaidOrdersCount = userSubs.filter(s => s.payment_status === 'unpaid' || !s.payment_status).length;
            const totalOrdersCount = userSubs.length;
            
            return {
                ...user,
                subscription: activeSub,
                allSubscriptions: userSubs,
                deliveredCount,
                totalPaid: userTotalPaid,
                paidOrdersCount,
                unpaidOrdersCount,
                totalOrdersCount
            };
        });
        
        const totalUsers = users.length;
        const activeSubscriptions = userData.filter(u => u.subscription).length;
        const totalMealsDelivered = userData.reduce((sum, u) => sum + (u.deliveredCount || 0), 0);
        
        const pageData = {
            userData,
            totalUsers,
            activeSubscriptions,
            totalRevenue,
            totalMealsDelivered
        };
        
        usersCache.data = pageData;
        usersCache.timestamp = Date.now();
        
        renderUsersPage(pageData);
        
    } catch (err) {
        console.error('Users page error:', err);
        container.innerHTML = '<div class="table-container"><p>加載失敗: ' + err.message + '</p><button class="btn-small" onclick="loadUsersPage()" style="margin-top:10px;">重試</button></div>';
    }
}

function renderUsersPage(pageData) {
    const container = document.getElementById('page_users');
    if (!container) return;
    
    const { userData, totalUsers, activeSubscriptions, totalRevenue, totalMealsDelivered } = pageData;
    
    container.innerHTML = `
        <div class="stats-grid" style="margin-bottom: 24px;">
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-users"></i></div>
                <div class="stat-value">${totalUsers}</div>
                <div class="stat-label">總用戶數</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-calendar-check"></i></div>
                <div class="stat-value">${activeSubscriptions}</div>
                <div class="stat-label">活躍訂閱</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
                <div class="stat-value">RM ${totalRevenue.toLocaleString()}</div>
                <div class="stat-label">總營收</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-utensils"></i></div>
                <div class="stat-value">${totalMealsDelivered}</div>
                <div class="stat-label">總配送餐數</div>
            </div>
        </div>
        
        <!-- 優化後的搜索框區域 -->
        <div class="user-search-bar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; background: white; padding: 16px 20px; border-radius: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <div style="display: flex; gap: 12px; flex-wrap: wrap; flex: 1;">
                <div style="position: relative; flex: 1; min-width: 200px;">
                    <i class="fas fa-search" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #b8956e; font-size: 14px;"></i>
                    <input type="text" id="searchInput" placeholder="🔍 搜索用戶名或郵箱..." style="width: 100%; padding: 12px 16px 12px 40px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 40px; font-size: 14px; outline: none; transition: all 0.2s;">
                </div>
                <div style="position: relative; min-width: 200px;">
                    <i class="fas fa-hashtag" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #b8956e; font-size: 14px;"></i>
                    <input type="text" id="searchOrderNo" placeholder="🔍 訂單號搜索..." style="width: 100%; padding: 12px 16px 12px 40px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 40px; font-size: 14px; outline: none; transition: all 0.2s;">
                </div>
                <div style="position: relative; min-width: 150px;">
                    <i class="fas fa-filter" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #b8956e; font-size: 14px;"></i>
                    <select id="planFilter" style="width: 100%; padding: 12px 16px 12px 40px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 40px; font-size: 14px; outline: none; cursor: pointer; appearance: none;">
                        <option value="all">📋 全部方案</option>
                        <option value="single">🥗 單次</option>
                        <option value="weekly">📅 週方案</option>
                        <option value="1month">🌟 1個月</option>
                        <option value="2months">🚀 2個月</option>
                        <option value="3months">💪 3個月</option>
                    </select>
                    <i class="fas fa-chevron-down" style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: #b8956e; font-size: 12px; pointer-events: none;"></i>
                </div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn-small" onclick="showAddUserModal()" style="background: #c8a15e; color: #0a1a2e; border-radius: 40px; padding: 10px 20px;">
                    <i class="fas fa-user-plus"></i> 手動新增用戶
                </button>
                <button class="btn-small" onclick="exportUsersData()" style="background: #2d6a4f; border-radius: 40px; padding: 10px 20px;">
                    <i class="fas fa-download"></i> 導出數據
                </button>
            </div>
        </div>
        
        <div class="table-container">
            <div style="overflow-x: auto;">
                <table style="width: 100%; min-width: 800px;">
                    <thead>
                        <tr style="background: #f8f5f0; border-bottom: 1px solid #f0e0d0;">
                            <th style="padding: 14px 16px; text-align: left; color: #8b6f4c; font-weight: 600;">用戶名</th>
                            <th style="padding: 14px 16px; text-align: left; color: #8b6f4c; font-weight: 600;">郵箱</th>
                            <th style="padding: 14px 16px; text-align: left; color: #8b6f4c; font-weight: 600;">當前方案</th>
                            <th style="padding: 14px 16px; text-align: left; color: #8b6f4c; font-weight: 600;">訂閱週期</th>
                            <th style="padding: 14px 16px; text-align: left; color: #8b6f4c; font-weight: 600;">支付狀態</th>
                            <th style="padding: 14px 16px; text-align: left; color: #8b6f4c; font-weight: 600;">消費金額</th>
                            <th style="padding: 14px 16px; text-align: center; color: #8b6f4c; font-weight: 600;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
    
    renderUserTable(userData);
    
    const searchInput = document.getElementById('searchInput');
    const orderNoInput = document.getElementById('searchOrderNo');
    const planFilter = document.getElementById('planFilter');
    
    if (searchInput) searchInput.onkeyup = debounce(() => filterUsers(userData), 300);
    if (orderNoInput) orderNoInput.onkeyup = debounce(() => filterUsers(userData), 300);
    if (planFilter) planFilter.onchange = () => filterUsers(userData);
}

function renderUserTable(userData) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (!userData || userData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #b8956e;">暫無用戶</td></tr>';
        return;
    }
    
    const html = userData.map(user => {
        const sub = user.subscription;
        const startDate = sub ? formatDate(sub.start_date) : 'N/A';
        const endDate = sub ? formatDate(sub.end_date) : 'N/A';
        const planName = sub ? getPlanName(sub.plan_type) : '—';
        const planPrice = sub ? `RM ${sub.total_price}` : '—';
        
        let paymentStatusDisplay = '';
        if (user.totalOrdersCount === 0) {
            paymentStatusDisplay = '<span class="badge badge-pending">無訂單</span>';
        } else if (user.paidOrdersCount === user.totalOrdersCount) {
            paymentStatusDisplay = '<span class="badge badge-active">✅ 已支付</span>';
        } else {
            paymentStatusDisplay = `<span class="badge badge-pending" style="background: rgba(255,184,77,0.15); color: #ffb84d;">⏳ ${user.unpaidOrdersCount} 筆未支付</span>`;
        }
        
        let subscriptionPeriod = '無訂閱';
        if (sub) {
            subscriptionPeriod = `${startDate} → ${endDate}<br><span style="font-size: 10px; color: #c8a15e;">${sub.order_no || '無訂單號'}</span>`;
        }
        
        return `
            <tr style="border-bottom: 1px solid #f0e0d0;">
                <td style="padding: 14px 16px; color: #5a4a3a;">${escapeHtml(user.full_name || 'N/A')}</td>
                <td style="padding: 14px 16px; color: #8a7a6a;">${escapeHtml(user.email || '未設置')}</td>
                <td style="padding: 14px 16px;">${planName}<br><span style="font-size: 11px; color: #c8a15e;">${planPrice}</span></td>
                <td style="padding: 14px 16px; font-size: 13px;">${subscriptionPeriod}</td>
                <td style="padding: 14px 16px;">${paymentStatusDisplay}</td>
                <td style="padding: 14px 16px;"><span style="font-weight: 600; color: #c8a15e;">RM ${user.totalPaid.toLocaleString()}</span></td>
                <td style="padding: 14px 16px; text-align: center;">
                    <button class="btn-icon" onclick="editUser('${user.id}')" title="編輯" style="background: transparent; border: none; color: #c8a15e; cursor: pointer; padding: 6px 10px;"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon" onclick="viewUserDetail('${user.id}')" title="查看詳情" style="background: transparent; border: none; color: #c8a15e; cursor: pointer; padding: 6px 10px;"><i class="fas fa-eye"></i></button>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = html;
}

function filterUsers(allUsers) {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const orderNoSearch = document.getElementById('searchOrderNo')?.value.toLowerCase() || '';
    const planFilter = document.getElementById('planFilter')?.value || 'all';
    
    const filtered = [];
    for (let i = 0; i < allUsers.length; i++) {
        const user = allUsers[i];
        const matchesSearch = searchTerm === '' || 
            (user.full_name && user.full_name.toLowerCase().includes(searchTerm)) || 
            (user.email && user.email.toLowerCase().includes(searchTerm));
        
        let matchesOrderNo = true;
        if (orderNoSearch !== '') {
            matchesOrderNo = user.subscription?.order_no?.toLowerCase().includes(orderNoSearch) || false;
        }
        
        let matchesPlan = true;
        if (planFilter !== 'all') {
            matchesPlan = user.subscription?.plan_type === planFilter;
        }
        
        if (matchesSearch && matchesOrderNo && matchesPlan) {
            filtered.push(user);
        }
    }
    
    renderUserTable(filtered);
    
    const tbody = document.getElementById('usersTableBody');
    if (tbody && filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #b8956e;">沒有找到符合條件的用戶</td></tr>';
    }
}

// ============================================
// 新增用戶
// ============================================

function showAddUserModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.backdropFilter = 'blur(4px)';
    modal.style.zIndex = '1000';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 500px; width: 90%; background: white; border-radius: 28px; padding: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="color: #8b6f4c;"><i class="fas fa-user-plus"></i> 手動新增用戶</h3>
                <button class="close-modal-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #b8956e;">&times;</button>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8b6f4c;">姓名 <span style="color:#ff5a5a;">*</span></label>
                <input type="text" id="addFullName" placeholder="請輸入姓名" style="width: 100%; padding: 12px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 16px;">
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8b6f4c;">郵箱</label>
                <input type="email" id="addEmail" placeholder="user@example.com" style="width: 100%; padding: 12px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 16px;">
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8b6f4c;">手機號碼</label>
                <input type="tel" id="addPhone" placeholder="0123456789" style="width: 100%; padding: 12px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 16px;">
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8b6f4c;">送餐地址</label>
                <textarea id="addAddress" rows="2" placeholder="請輸入完整地址" style="width: 100%; padding: 12px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 16px; resize: vertical;"></textarea>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8b6f4c;">付款方式</label>
                <select id="addPaymentMethod" style="width: 100%; padding: 12px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 16px;">
                    ${PAYMENT_METHODS.map(m => `<option value="${m}">${m}</option>`).join('')}
                </select>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #8b6f4c;">備註</label>
                <textarea id="addNotes" rows="2" placeholder="特殊需求、備註等" style="width: 100%; padding: 12px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 16px; resize: vertical;"></textarea>
            </div>
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-save" onclick="confirmAddUser()" style="flex: 1; background: #c8a15e; border: none; padding: 12px; border-radius: 40px; color: white; font-weight: 600; cursor: pointer;">新增用戶</button>
                <button class="btn-cancel" onclick="closeModal(this.closest('.modal-overlay'))" style="flex: 1; background: #f0ebe2; border: none; padding: 12px; border-radius: 40px; color: #8b6f4c; font-weight: 600; cursor: pointer;">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 關閉按鈕事件
    const closeBtn = modal.querySelector('.close-modal-btn');
    if (closeBtn) closeBtn.onclick = () => closeModal(modal);
    
    // ESC 關閉
    setupModalCloseOnEsc(modal);
    
    // 點擊背景關閉
    modal.onclick = (e) => {
        if (e.target === modal) closeModal(modal);
    };
}

async function confirmAddUser() {
    const fullName = document.getElementById('addFullName').value.trim();
    const email = document.getElementById('addEmail').value.trim();
    const phone = document.getElementById('addPhone').value.trim();
    const address = document.getElementById('addAddress').value.trim();
    const paymentMethod = document.getElementById('addPaymentMethod').value;
    const notes = document.getElementById('addNotes').value.trim();
    
    if (!fullName) {
        showToast('請輸入姓名', 'error');
        return;
    }
    
    const { data: existingUser } = await supabaseClient
        .from('users')
        .select('id')
        .eq('full_name', fullName)
        .maybeSingle();
    
    if (existingUser) {
        showToast('該姓名已存在，請使用其他姓名', 'error');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = '處理中...';
    btn.disabled = true;
    
    try {
        const userId = generateUUID();
        const invitationCode = await generateUniqueInvitationCodeForAdmin();
        
        const { error: insertError } = await supabaseClient
            .from('users')
            .insert({
                id: userId,
                full_name: fullName,
                email: email || null,
                phone: phone || null,
                address: address || null,
                payment_method: paymentMethod,
                invitation_code: invitationCode,
                meal_notes: notes || null,
                created_at: new Date()
            });
        
        if (insertError) throw insertError;
        
        await supabaseClient.from('invitation_codes').insert({
            code: invitationCode,
            created_by: userId,
            status: 'active',
            created_at: new Date()
        });
        
        showToast(`用戶 ${fullName} 新增成功！`);
        document.querySelector('.modal-overlay')?.remove();
        usersCache.data = null;
        loadUsersPage();
        
    } catch (err) {
        console.error('Add user error:', err);
        showToast('新增失敗: ' + err.message, 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ============================================
// 編輯用戶（修復邊框重疊 + ESC關閉）
// ============================================

async function editUser(userId) {
    const { data: user } = await supabaseClient.from('users').select('*').eq('id', userId).single();
    const { data: subscriptionsList } = await supabaseClient.from('subscriptions').select('*').eq('user_id', userId).eq('status', 'active').limit(1);
    const subscription = subscriptionsList?.[0] || null;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 700px; width: 90%; max-height: 85vh; overflow-y: auto; background: white; border-radius: 28px; padding: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #ffe0c0;">
                <h3 style="color: #8b6f4c;"><i class="fas fa-user-edit"></i> 編輯用戶 - ${escapeHtml(user.full_name)}</h3>
                <button class="close-modal-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #b8956e;">&times;</button>
            </div>
            
            <div style="background: #fefaf5; border-radius: 20px; padding: 20px; margin-bottom: 20px;">
                <h4 style="color: #c8a15e; margin-bottom: 16px; font-size: 16px;">📋 基本信息</h4>
                <div style="margin-bottom: 14px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c; font-size: 13px;">地址</label>
                    <input type="text" id="editAddress" value="${escapeHtml(user.address || '')}" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c; font-size: 13px;">郵箱</label>
                    <input type="email" id="editEmail" value="${escapeHtml(user.email || '')}" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c; font-size: 13px;">密碼</label>
                    <input type="password" id="editPassword" placeholder="留空則不修改" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                    <small style="color: #b8956e;">留空表示保持原密碼不變</small>
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c; font-size: 13px;">手機號</label>
                    <input type="tel" id="editPhone" value="${escapeHtml(user.phone || '')}" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c; font-size: 13px;">付款方式</label>
                    <select id="editPaymentMethod" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                        ${PAYMENT_METHODS.map(m => `<option value="${m}" ${user.payment_method === m ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                </div>
            </div>
            
            <div style="background: #fefaf5; border-radius: 20px; padding: 20px; margin-bottom: 20px;">
                <h4 style="color: #c8a15e; margin-bottom: 16px; font-size: 16px;">📦 訂閱信息</h4>
                <div style="margin-bottom: 14px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c; font-size: 13px;">訂單號</label>
                    <input type="text" value="${subscription?.order_no || ''}" readonly style="width: 100%; padding: 10px 14px; background: #e8e0d0; border: 1px solid #ffe0c0; border-radius: 12px;">
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c; font-size: 13px;">訂閱狀態</label>
                    <select id="editSubscriptionStatus" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                        ${SUBSCRIPTION_STATUS.map(s => `<option value="${s}" ${subscription?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c; font-size: 13px;">支付狀態</label>
                    <select id="editPaymentStatus" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                        <option value="paid" ${subscription?.payment_status === 'paid' ? 'selected' : ''}>✅ 已支付</option>
                        <option value="unpaid" ${subscription?.payment_status === 'unpaid' ? 'selected' : ''}>⏳ 未支付</option>
                        <option value="partial" ${subscription?.payment_status === 'partial' ? 'selected' : ''}>💰 部分支付</option>
                    </select>
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c; font-size: 13px;">配套類型</label>
                    <select id="editPlanType" onchange="updatePlanPrice()" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                        ${Object.entries(PLAN_CONFIG).map(([key, config]) => `<option value="${key}" ${subscription?.plan_type === key ? 'selected' : ''} data-days="${config.days}" data-price="${config.price}">${config.name} (${config.days}天 - RM ${config.price})</option>`).join('')}
                    </select>
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c; font-size: 13px;">開始日期</label>
                    <input type="date" id="editStartDate" value="${subscription?.start_date?.split('T')[0] || ''}" onchange="updateEndDate()" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c; font-size: 13px;">結束日期</label>
                    <input type="date" id="editEndDate" readonly style="width: 100%; padding: 10px 14px; background: #e8e0d0; border: 1px solid #ffe0c0; border-radius: 12px;">
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c; font-size: 13px;">已送達餐數</label>
                    <input type="number" id="editMealsReceived" value="${subscription?.meals_received || 0}" min="0" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c; font-size: 13px;">總價格 (RM)</label>
                    <input type="number" id="editTotalPrice" value="${subscription?.total_price || ''}" step="0.01" readonly style="width: 100%; padding: 10px 14px; background: #e8e0d0; border: 1px solid #ffe0c0; border-radius: 12px;">
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-save" onclick="saveUserEdit('${userId}')" style="flex: 1; background: #c8a15e; border: none; padding: 12px; border-radius: 40px; color: white; font-weight: 600; cursor: pointer;">保存修改</button>
                <button class="btn-cancel" onclick="closeModal(this.closest('.modal-overlay'))" style="flex: 1; background: #f0ebe2; border: none; padding: 12px; border-radius: 40px; color: #8b6f4c; font-weight: 600; cursor: pointer;">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 關閉按鈕事件
    const closeBtn = modal.querySelector('.close-modal-btn');
    if (closeBtn) closeBtn.onclick = () => closeModal(modal);
    
    // ESC 關閉
    setupModalCloseOnEsc(modal);
    
    // 點擊背景關閉
    modal.onclick = (e) => {
        if (e.target === modal) closeModal(modal);
    };
    
    window.updatePlanPrice = function() {
        const planSelect = document.getElementById('editPlanType');
        const price = planSelect.options[planSelect.selectedIndex]?.dataset.price;
        const priceInput = document.getElementById('editTotalPrice');
        if (priceInput && price) priceInput.value = price;
        const startDateInput = document.getElementById('editStartDate');
        const days = parseInt(planSelect.options[planSelect.selectedIndex]?.dataset.days);
        const endDateInput = document.getElementById('editEndDate');
        if (startDateInput.value && days) {
            const start = new Date(startDateInput.value);
            const end = new Date(start);
            end.setDate(end.getDate() + days - 1);
            endDateInput.value = end.toISOString().split('T')[0];
        }
    };
    window.updateEndDate = function() {
        const startDateInput = document.getElementById('editStartDate');
        const planSelect = document.getElementById('editPlanType');
        const days = parseInt(planSelect.options[planSelect.selectedIndex]?.dataset.days);
        const endDateInput = document.getElementById('editEndDate');
        if (startDateInput.value && days) {
            const start = new Date(startDateInput.value);
            const end = new Date(start);
            end.setDate(end.getDate() + days - 1);
            endDateInput.value = end.toISOString().split('T')[0];
        }
    };
    window.updatePlanPrice();
}

async function saveUserEdit(userId) {
    const address = document.getElementById('editAddress').value;
    const email = document.getElementById('editEmail').value;
    const password = document.getElementById('editPassword').value;
    const phone = document.getElementById('editPhone').value;
    const paymentMethod = document.getElementById('editPaymentMethod').value;
    const subscriptionStatus = document.getElementById('editSubscriptionStatus').value;
    const paymentStatus = document.getElementById('editPaymentStatus').value;
    const planType = document.getElementById('editPlanType').value;
    const startDate = document.getElementById('editStartDate').value;
    const endDate = document.getElementById('editEndDate').value;
    const mealsReceived = parseInt(document.getElementById('editMealsReceived').value) || 0;
    const totalPrice = parseFloat(document.getElementById('editTotalPrice').value) || 0;
    const planDays = PLAN_CONFIG[planType]?.days || 30;
    
    const updateUserData = { address: address || null, email: email || null, phone: phone || null, payment_method: paymentMethod };
    if (password && password.trim() !== '') updateUserData.password = btoa(password);
    
    const { error: userError } = await supabaseClient.from('users').update(updateUserData).eq('id', userId);
    if (userError) { showToast('更新失敗: ' + userError.message, 'error'); return; }
    
    const { data: existingSubscriptions } = await supabaseClient.from('subscriptions').select('*').eq('user_id', userId).eq('status', 'active').limit(1);
    const existingSubscription = existingSubscriptions?.[0] || null;
    const subscriptionData = { plan_type: planType, total_days: planDays, meals_received: mealsReceived, start_date: startDate, end_date: endDate, status: subscriptionStatus, payment_status: paymentStatus, total_price: totalPrice, updated_at: new Date() };
    
    if (existingSubscription) {
        await supabaseClient.from('subscriptions').update(subscriptionData).eq('id', existingSubscription.id);
    } else if (subscriptionStatus === 'active') {
        await supabaseClient.from('subscriptions').insert({ user_id: userId, ...subscriptionData, created_at: new Date() });
    }
    
    showToast('用戶信息已更新！');
    closeModal(document.querySelector('.modal-overlay'));
    usersCache.data = null;
    loadUsersPage();
}

// ============================================
// 查看用戶詳情（美化版 + ESC關閉 + 修改按鈕 + 快速打開）
// ============================================

async function viewUserDetail(userId) {
    // 立即顯示加載提示，讓用戶知道正在加載
    const loadingModal = document.createElement('div');
    loadingModal.className = 'modal-overlay';
    loadingModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    loadingModal.innerHTML = `
        <div style="background: white; border-radius: 28px; padding: 40px; text-align: center;">
            <div class="loading-spinner" style="margin: 0 auto;"></div>
            <p style="margin-top: 16px; color: #8b6f4c;">加載中...</p>
        </div>
    `;
    document.body.appendChild(loadingModal);
    
    try {
        // 並行加載所有數據
        const [userResult, subscriptionsResult, receiptsResult, deliveriesResult] = await Promise.all([
            supabaseClient.from('users').select('*').eq('id', userId).single(),
            supabaseClient.from('subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            supabaseClient.from('receipts').select('*').eq('user_id', userId),
            supabaseClient.from('deliveries').select('status').eq('user_id', userId)
        ]);
        
        const user = userResult.data;
        const allSubscriptions = subscriptionsResult.data || [];
        const receipts = receiptsResult.data || [];
        const deliveries = deliveriesResult.data || [];
        
        const activeSub = allSubscriptions.find(s => s.status === 'active');
        const totalPaid = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
        const unpaidAmount = allSubscriptions.filter(s => s.payment_status === 'unpaid').reduce((sum, s) => sum + (s.total_price || 0), 0);
        
        let deliveredCount = 0, totalDays = 0, progressPercent = 0;
        if (activeSub) {
            const subDeliveries = deliveries.filter(d => d.subscription_id === activeSub.id);
            deliveredCount = subDeliveries.filter(d => d.status === 'delivered').length || 0;
            totalDays = activeSub.total_days || 0;
            progressPercent = totalDays > 0 ? (deliveredCount / totalDays) * 100 : 0;
        }
        
        // 移除加載彈窗
        loadingModal.remove();
        
        // 創建詳情彈窗（美化版）
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        modal.innerHTML = `
            <div class="modal-card" style="max-width: 1300px; width: 95%; max-height: 85vh; overflow-y: auto; background: white; border-radius: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
                <!-- 頭部 -->
                <div style="background: linear-gradient(135deg, #fefaf5, #f5ede0); border-radius: 28px 28px 0 0; padding: 24px 28px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; border-bottom: 1px solid #ffe0c0;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                            <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #c8a15e, #e0b87a); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: white;">${escapeHtml(user?.full_name?.charAt(0) || 'U')}</div>
                            <div>
                                <h2 style="color: #5a4a3a; margin: 0;">${escapeHtml(user?.full_name)}</h2>
                                <p style="color: #b8956e; margin: 4px 0 0; font-size: 13px;">用戶詳情</p>
                            </div>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 24px; margin-top: 8px;">
                            <div><i class="fas fa-envelope" style="color: #c8a15e; width: 20px;"></i> ${escapeHtml(user?.email || '未設置')}</div>
                            <div><i class="fas fa-phone" style="color: #c8a15e; width: 20px;"></i> ${escapeHtml(user?.phone || '未設置')}</div>
                            <div><i class="fas fa-map-marker-alt" style="color: #c8a15e; width: 20px;"></i> ${escapeHtml(user?.address || '未設置')}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn-add-order" onclick="showAddOrderModal('${userId}')" style="background: #c8a15e; border: none; padding: 10px 20px; border-radius: 40px; color: white; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-plus-circle"></i> 添加訂單
                        </button>
                        <button class="close-modal-btn" style="background: #f0ebe2; border: none; padding: 10px 20px; border-radius: 40px; color: #8b6f4c; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-times"></i> 關閉
                        </button>
                    </div>
                </div>
                
                <!-- 統計卡片 -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 24px 28px; background: white;">
                    <div style="background: #fefaf5; border-radius: 20px; padding: 16px; text-align: center; border: 1px solid #ffe0c0;">
                        <div style="font-size: 12px; color: #b8956e;">訂閱週期</div>
                        <div style="font-size: 14px; font-weight: 600; margin-top: 8px; color: #5a4a3a;">${activeSub ? `${formatDate(activeSub.start_date)} - ${formatDate(activeSub.end_date)}` : '無活躍訂閱'}</div>
                    </div>
                    <div style="background: #fefaf5; border-radius: 20px; padding: 16px; text-align: center; border: 1px solid #ffe0c0;">
                        <div style="font-size: 12px; color: #b8956e;">配送進度</div>
                        <div style="margin-top: 8px;"><div style="width: 80px; background: #e0d0c0; border-radius: 10px; height: 6px; margin: 0 auto;"><div style="width: ${progressPercent}%; background: #c8a15e; border-radius: 10px; height: 6px;"></div></div><div style="font-size: 13px; margin-top: 6px; color: #5a4a3a;">${deliveredCount}/${totalDays} 餐</div></div>
                    </div>
                    <div style="background: #fefaf5; border-radius: 20px; padding: 16px; text-align: center; border: 1px solid #ffe0c0;">
                        <div style="font-size: 12px; color: #b8956e;">總消費</div>
                        <div style="font-size: 22px; font-weight: 700; color: #c8a15e; margin-top: 4px;">RM ${totalPaid.toLocaleString()}</div>
                    </div>
                    <div style="background: #fefaf5; border-radius: 20px; padding: 16px; text-align: center; border: 1px solid #ffe0c0;">
                        <div style="font-size: 12px; color: #b8956e;">未支付</div>
                        <div style="font-size: 22px; font-weight: 700; color: #e8a878; margin-top: 4px;">RM ${unpaidAmount.toLocaleString()}</div>
                    </div>
                </div>
                
                <!-- 歷史訂單標題 -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 28px 16px 28px;">
                    <h3 style="color: #5a4a3a;"><i class="fas fa-history" style="color: #c8a15e;"></i> 歷史訂單</h3>
                    <span style="background: #fefaf5; padding: 4px 12px; border-radius: 30px; font-size: 12px; color: #b8956e;">共 ${allSubscriptions?.length || 0} 筆訂單</span>
                </div>
                
                <!-- 訂單表格 -->
                <div style="padding: 0 28px 28px 28px; overflow-x: auto; max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; min-width: 1000px; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #fefaf5; border-radius: 12px;">
                                <th style="padding: 12px; text-align: left; color: #8b6f4c; font-weight: 600;">訂單號</th>
                                <th style="padding: 12px; text-align: left; color: #8b6f4c; font-weight: 600;">下單時間</th>
                                <th style="padding: 12px; text-align: left; color: #8b6f4c; font-weight: 600;">方案</th>
                                <th style="padding: 12px; text-align: left; color: #8b6f4c; font-weight: 600;">訂閱期間</th>
                                <th style="padding: 12px; text-align: left; color: #8b6f4c; font-weight: 600;">配送進度</th>
                                <th style="padding: 12px; text-align: left; color: #8b6f4c; font-weight: 600;">訂單金額</th>
                                <th style="padding: 12px; text-align: left; color: #8b6f4c; font-weight: 600;">支付狀態</th>
                                <th style="padding: 12px; text-align: left; color: #8b6f4c; font-weight: 600;">對應收據</th>
                                <th style="padding: 12px; text-align: center; color: #8b6f4c; font-weight: 600;">操作</th>
                            </tr>
                        </thead>
                        <tbody id="orderHistoryBody">
                            ${renderOrderHistory(allSubscriptions, receipts, userId)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 關閉按鈕事件
        const closeBtn = modal.querySelector('.close-modal-btn');
        if (closeBtn) closeBtn.onclick = () => closeModal(modal);
        
        // ESC 關閉
        setupModalCloseOnEsc(modal);
        
        // 點擊背景關閉
        modal.onclick = (e) => {
            if (e.target === modal) closeModal(modal);
        };
        
    } catch (err) {
        console.error('View detail error:', err);
        loadingModal.remove();
        showToast('加載失敗: ' + err.message, 'error');
    }
}

function renderOrderHistory(subscriptions, receipts, currentUserId) {
    if (!subscriptions || subscriptions.length === 0) {
        return '<tr><td colspan="9" style="text-align: center; padding: 40px; color: #b8956e;">暫無訂單記錄</td><\/tr>';
    }
    
    const planNames = { single: '單次', weekly: '週方案', '1month': '1個月', '2months': '2個月', '3months': '3個月' };
    
    return subscriptions.map(sub => {
        const subReceipts = receipts?.filter(r => r.subscription_id === sub.id) || [];
        const hasReceipt = subReceipts.length > 0;
        const receiptUrl = subReceipts[0]?.receipt_url;
        
        let paymentStatusHtml = '';
        if (sub.payment_status === 'paid') paymentStatusHtml = '<span class="badge badge-active" style="background: #e0f5e4; color: #2d6a4f; padding: 4px 12px; border-radius: 30px; font-size: 11px;">✅ 已支付</span>';
        else if (sub.payment_status === 'unpaid') paymentStatusHtml = '<span class="badge badge-pending" style="background: #fff0e0; color: #e8a878; padding: 4px 12px; border-radius: 30px; font-size: 11px;">⏳ 未支付</span>';
        else if (sub.payment_status === 'partial') paymentStatusHtml = '<span class="badge badge-warning" style="background: #fff0e0; color: #e8a050; padding: 4px 12px; border-radius: 30px; font-size: 11px;">💰 部分支付</span>';
        else paymentStatusHtml = '<span class="badge badge-pending" style="background: #f0ebe2; color: #b8956e; padding: 4px 12px; border-radius: 30px; font-size: 11px;">待付款</span>';
        
        const mealsReceived = sub.meals_received || 0;
        const totalDays = sub.total_days || 0;
        
        return `
            <tr style="border-bottom: 1px solid #f0e0d0;">
                <td style="padding: 12px;"><span style="background: #fefaf5; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-family: monospace; color: #c8a15e;">${sub.order_no || '無訂單號'}</span></td>
                <td style="padding: 12px; font-size: 12px; color: #8a7a6a;">${formatDate(sub.created_at)}</td>
                <td style="padding: 12px; color: #5a4a3a;">${planNames[sub.plan_type] || sub.plan_type}</td>
                <td style="padding: 12px; font-size: 12px; color: #8a7a6a;">${formatDate(sub.start_date)} → ${formatDate(sub.end_date)}</td>
                <td style="padding: 12px; color: #5a4a3a;">${mealsReceived}/${totalDays}</td>
                <td style="padding: 12px; color: #c8a15e; font-weight: 600;">RM ${sub.total_price}</td>
                <td style="padding: 12px;">${paymentStatusHtml}</td>
                <td style="padding: 12px;">
                    ${hasReceipt ? `<a href="${receiptUrl}" target="_blank" class="btn-small" style="background: #c8a15e; color: #0a1a2e; padding: 4px 12px; border-radius: 30px; font-size: 11px; text-decoration: none;"><i class="fas fa-receipt"></i> 查看</a>` : `<button class="btn-small" onclick="uploadReceiptForUserFromDetail('${sub.user_id}', '${sub.id}', '${sub.order_no}')" style="background: #4a7cff; padding: 4px 12px; border-radius: 30px; font-size: 11px; border: none; color: white; cursor: pointer;"><i class="fas fa-upload"></i> 上傳</button>`}
                </td>
                <td style="padding: 12px; text-align: center;">
                    <div style="display: flex; gap: 8px; justify-content: center;">
                        <button class="btn-icon" onclick="editOrderFromDetail('${sub.id}', '${currentUserId}')" title="修改訂單" style="background: #f0ebe2; border: none; padding: 6px 10px; border-radius: 30px; cursor: pointer; color: #c8a15e;"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" onclick="deleteOrder('${sub.id}', '${currentUserId}')" title="刪除訂單" style="background: #f0ebe2; border: none; padding: 6px 10px; border-radius: 30px; cursor: pointer; color: #e8a878;"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// 修改訂單（從詳情頁）
async function editOrderFromDetail(subscriptionId, userId) {
    // 獲取訂單詳情
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();
    
    if (!subscription) {
        showToast('訂單不存在', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 550px; width: 90%; background: white; border-radius: 28px; padding: 28px; max-height: 85vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="color: #8b6f4c;"><i class="fas fa-edit"></i> 修改訂單</h3>
                <button class="close-modal-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #b8956e;">&times;</button>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">訂單號</label>
                <input type="text" id="editOrderNo" value="${subscription.order_no || ''}" readonly style="width: 100%; padding: 10px 14px; background: #e8e0d0; border: 1px solid #ffe0c0; border-radius: 12px;">
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">方案類型</label>
                <select id="editOrderPlanType" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                    ${Object.entries(PLAN_CONFIG).map(([key, config]) => `<option value="${key}" ${subscription.plan_type === key ? 'selected' : ''} data-days="${config.days}" data-price="${config.price}">${config.name} (${config.days}天 - RM ${config.price})</option>`).join('')}
                    <option value="custom" ${subscription.plan_type === 'custom' ? 'selected' : ''}>自訂金額</option>
                </select>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">訂單金額 (RM)</label>
                <input type="number" id="editOrderTotalPrice" value="${subscription.total_price}" step="0.01" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">支付狀態</label>
                <select id="editOrderPaymentStatus" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                    <option value="paid" ${subscription.payment_status === 'paid' ? 'selected' : ''}>✅ 已支付</option>
                    <option value="unpaid" ${subscription.payment_status === 'unpaid' ? 'selected' : ''}>⏳ 未支付</option>
                    <option value="partial" ${subscription.payment_status === 'partial' ? 'selected' : ''}>💰 部分支付</option>
                </select>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">訂閱狀態</label>
                <select id="editOrderStatus" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                    ${SUBSCRIPTION_STATUS.map(s => `<option value="${s}" ${subscription.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-save" onclick="confirmEditOrder('${subscriptionId}', '${userId}')" style="flex: 1; background: #c8a15e; border: none; padding: 12px; border-radius: 40px; color: white; font-weight: 600; cursor: pointer;">保存修改</button>
                <button class="btn-cancel" onclick="closeModal(this.closest('.modal-overlay'))" style="flex: 1; background: #f0ebe2; border: none; padding: 12px; border-radius: 40px; color: #8b6f4c; font-weight: 600; cursor: pointer;">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 關閉按鈕事件
    const closeBtn = modal.querySelector('.close-modal-btn');
    if (closeBtn) closeBtn.onclick = () => closeModal(modal);
    
    // ESC 關閉
    setupModalCloseOnEsc(modal);
    
    // 點擊背景關閉
    modal.onclick = (e) => {
        if (e.target === modal) closeModal(modal);
    };
}

async function confirmEditOrder(subscriptionId, userId) {
    const planType = document.getElementById('editOrderPlanType').value;
    const totalPrice = parseFloat(document.getElementById('editOrderTotalPrice').value) || 0;
    const paymentStatus = document.getElementById('editOrderPaymentStatus').value;
    const status = document.getElementById('editOrderStatus').value;
    
    if (totalPrice <= 0) {
        showToast('請輸入有效的金額', 'error');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = '保存中...';
    btn.disabled = true;
    
    try {
        const { error } = await supabaseClient
            .from('subscriptions')
            .update({
                plan_type: planType,
                total_price: totalPrice,
                payment_status: paymentStatus,
                status: status,
                updated_at: new Date()
            })
            .eq('id', subscriptionId);
        
        if (error) throw error;
        
        showToast('訂單修改成功！');
        closeModal(document.querySelector('.modal-overlay'));
        
        // 刷新詳情頁
        const detailModal = document.querySelector('.modal-overlay:not([style*="display: none"])');
        if (detailModal) closeModal(detailModal);
        viewUserDetail(userId);
        usersCache.data = null;
        loadUsersPage();
        
    } catch (err) {
        console.error('Edit order error:', err);
        showToast('修改失敗: ' + err.message, 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ============================================
// 刪除訂單
// ============================================

async function deleteOrder(subscriptionId, userId) {
    if (!confirm('確定要刪除此訂單嗎？\n\n注意：刪除訂單會同時刪除相關的配送記錄！')) return;
    
    try {
        await supabaseClient.from('deliveries').delete().eq('subscription_id', subscriptionId);
        const { error } = await supabaseClient.from('subscriptions').delete().eq('id', subscriptionId);
        if (error) throw error;
        showToast('訂單已刪除！');
        const modal = document.querySelector('.modal-overlay');
        if (modal) closeModal(modal);
        usersCache.data = null;
        viewUserDetail(userId);
        loadUsersPage();
    } catch (err) {
        console.error('Delete order error:', err);
        showToast('刪除失敗: ' + err.message, 'error');
    }
}

// ============================================
// 上傳收據
// ============================================

async function uploadReceiptForUserFromDetail(userId, subscriptionId, orderNo) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 450px; width: 90%; background: white; border-radius: 28px; padding: 28px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="color: #8b6f4c;"><i class="fas fa-upload"></i> 上傳收據</h3>
                <button class="close-modal-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #b8956e;">&times;</button>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">訂單號</label>
                <input type="text" value="${orderNo || '無訂單號'}" readonly style="width: 100%; padding: 10px 14px; background: #e8e0d0; border: 1px solid #ffe0c0; border-radius: 12px;">
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">金額 (RM)</label>
                <input type="number" id="receiptAmountDetail" step="0.01" placeholder="輸入金額" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">付款方式</label>
                <select id="receiptPaymentMethodDetail" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                    <option value="credit_card">信用卡</option>
                    <option value="bank_transfer">銀行轉帳</option>
                    <option value="cash">貨到付款</option>
                    <option value="touchngo">Touch n Go</option>
                </select>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">收據圖片</label>
                <input type="file" id="receiptFileDetail" accept="image/*,.pdf" style="width: 100%; padding: 8px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
            </div>
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-save" onclick="confirmUploadReceiptFromDetail('${userId}', '${subscriptionId}', '${orderNo}')" style="flex: 1; background: #c8a15e; border: none; padding: 12px; border-radius: 40px; color: white; font-weight: 600; cursor: pointer;">上傳</button>
                <button class="btn-cancel" onclick="closeModal(this.closest('.modal-overlay'))" style="flex: 1; background: #f0ebe2; border: none; padding: 12px; border-radius: 40px; color: #8b6f4c; font-weight: 600; cursor: pointer;">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 關閉按鈕事件
    const closeBtn = modal.querySelector('.close-modal-btn');
    if (closeBtn) closeBtn.onclick = () => closeModal(modal);
    
    // ESC 關閉
    setupModalCloseOnEsc(modal);
    
    // 點擊背景關閉
    modal.onclick = (e) => {
        if (e.target === modal) closeModal(modal);
    };
}

async function confirmUploadReceiptFromDetail(userId, subscriptionId, orderNo) {
    const amount = parseFloat(document.getElementById('receiptAmountDetail').value) || 0;
    const paymentMethod = document.getElementById('receiptPaymentMethodDetail').value;
    const file = document.getElementById('receiptFileDetail').files[0];
    
    if (amount <= 0) { showToast('請輸入有效的金額', 'error'); return; }
    if (!file) { showToast('請選擇收據文件', 'error'); return; }
    
    const modal = document.querySelector('.modal-overlay');
    if (modal) closeModal(modal);
    
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `receipt_${userId}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage.from('receipts').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);
        
        await supabaseClient.from('receipts').insert({ 
            user_id: userId, 
            subscription_id: subscriptionId, 
            order_no: orderNo, 
            amount: amount, 
            receipt_url: urlData.publicUrl, 
            payment_method: paymentMethod, 
            payment_status: 'paid',
            created_at: new Date() 
        });
        
        await supabaseClient.from('subscriptions').update({ payment_status: 'paid' }).eq('id', subscriptionId);
        
        showToast('收據上傳成功！');
        usersCache.data = null;
        
        // 關閉當前詳情彈窗並重新打開
        const detailModal = document.querySelector('.modal-overlay:not([style*="display: none"])');
        if (detailModal) closeModal(detailModal);
        viewUserDetail(userId);
        loadUsersPage();
    } catch (err) {
        console.error('Upload error:', err);
        showToast('上傳失敗: ' + err.message, 'error');
    }
}

// ============================================
// 添加訂單
// ============================================

async function showAddOrderModal(userId) {
    const { data: user } = await supabaseClient.from('users').select('full_name').eq('id', userId).single();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 550px; width: 90%; background: white; border-radius: 28px; padding: 28px; max-height: 85vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="color: #8b6f4c;"><i class="fas fa-shopping-cart"></i> 添加歷史訂單 - ${escapeHtml(user?.full_name)}</h3>
                <button class="close-modal-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #b8956e;">&times;</button>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">下單日期 <span style="color:#ff5a5a;">*</span></label>
                <input type="date" id="newOrderDate" class="form-input" value="${getTodayString()}" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                <small style="color: #b8956e;">訂單號會根據此日期生成</small>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">訂單號</label>
                <input type="text" id="newOrderNo" class="form-input" readonly style="width: 100%; padding: 10px 14px; background: #e8e0d0; border: 1px solid #ffe0c0; border-radius: 12px;">
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">配套類型 <span style="color:#ff5a5a;">*</span></label>
                <select id="newPlanType" class="form-select" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                    <option value="single">單次 (1天 - RM 15.90)</option>
                    <option value="weekly">週方案 (7天 - RM 111.30)</option>
                    <option value="1month">1個月 (30天 - RM 447)</option>
                    <option value="2months">2個月 (60天 - RM 834)</option>
                    <option value="3months">3個月 (90天 - RM 1161)</option>
                    <option value="custom">自訂金額</option>
                </select>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">訂閱開始日期 <span style="color:#ff5a5a;">*</span></label>
                    <input type="date" id="newStartDate" class="form-input" value="${getTodayString()}" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">訂閱結束日期</label>
                    <input type="date" id="newEndDate" class="form-input" readonly style="width: 100%; padding: 10px 14px; background: #e8e0d0; border: 1px solid #ffe0c0; border-radius: 12px;">
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">訂單金額 (RM) <span style="color:#ff5a5a;">*</span></label>
                <input type="number" id="newTotalPrice" class="form-input" step="0.01" placeholder="0.00" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">訂單完成狀態 <span style="color:#ff5a5a;">*</span></label>
                <select id="newOrderCompleteStatus" class="form-select" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                    <option value="completed">✅ 已完成（歷史訂單）</option>
                    <option value="pending">🚚 待配送（進行中）</option>
                </select>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">付款方式</label>
                <select id="newPaymentMethod" class="form-select" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                    <option value="credit_card">💳 信用卡</option>
                    <option value="bank_transfer">🏦 銀行轉帳</option>
                    <option value="cash">💵 貨到付款</option>
                    <option value="touchngo">📱 Touch n Go</option>
                    <option value="pending">⏳ 待付款</option>
                </select>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">訂閱狀態</label>
                <select id="newSubscriptionStatus" class="form-select" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                    <option value="active">🟢 活躍中</option>
                    <option value="expired">🔴 已過期</option>
                    <option value="cancelled">⚫ 已取消</option>
                    <option value="paused">🟡 暫停</option>
                </select>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">支付狀態</label>
                <select id="newPaymentStatus" class="form-select" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px;">
                    <option value="paid">✅ 已支付</option>
                    <option value="unpaid">⏳ 未支付</option>
                    <option value="partial">💰 部分支付</option>
                </select>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #8b6f4c;">備註</label>
                <textarea id="newOrderNotes" class="form-input" rows="2" placeholder="特殊備註、調整原因等" style="width: 100%; padding: 10px 14px; background: #f8f5f0; border: 1px solid #ffe0c0; border-radius: 12px; resize: vertical;"></textarea>
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-cancel" onclick="closeModal(this.closest('.modal-overlay'))" style="flex: 1; background: #f0ebe2; border: none; padding: 12px; border-radius: 40px; color: #8b6f4c; font-weight: 600; cursor: pointer;">取消</button>
                <button class="btn-submit" id="confirmAddOrderBtn" style="flex: 1; background: #c8a15e; border: none; padding: 12px; border-radius: 40px; color: white; font-weight: 600; cursor: pointer;">確認添加訂單</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    const orderDateInput = document.getElementById('newOrderDate');
    const orderNoInput = document.getElementById('newOrderNo');
    const planSelect = document.getElementById('newPlanType');
    const startDateInput = document.getElementById('newStartDate');
    const endDateInput = document.getElementById('newEndDate');
    const totalPriceInput = document.getElementById('newTotalPrice');
    
    function updateOrderNo() {
        const orderDate = orderDateInput.value;
        if (orderNoInput && orderDate) {
            orderNoInput.value = generateOrderNoByDate(orderDate);
        }
    }
    
    function updatePlanInfo() {
        const selectedPlan = planSelect.value;
        
        if (selectedPlan === 'custom') {
            totalPriceInput.placeholder = '請手動輸入金額';
            totalPriceInput.value = '';
        } else {
            const planConfig = PLAN_CONFIG[selectedPlan];
            if (planConfig) {
                totalPriceInput.value = planConfig.price;
            }
        }
        
        if (startDateInput.value) {
            let days = 0;
            if (selectedPlan === 'custom') {
                days = 30;
            } else {
                const planConfig = PLAN_CONFIG[selectedPlan];
                days = planConfig ? planConfig.days : 30;
            }
            const start = new Date(startDateInput.value);
            const end = new Date(start);
            end.setDate(end.getDate() + days - 1);
            endDateInput.value = end.toISOString().split('T')[0];
        }
    }
    
    orderDateInput.onchange = updateOrderNo;
    planSelect.onchange = updatePlanInfo;
    startDateInput.onchange = updatePlanInfo;
    
    updateOrderNo();
    updatePlanInfo();
    
    // 關閉按鈕事件
    const closeBtn = modal.querySelector('.close-modal-btn');
    if (closeBtn) closeBtn.onclick = () => closeModal(modal);
    
    // ESC 關閉
    setupModalCloseOnEsc(modal);
    
    // 點擊背景關閉
    modal.onclick = (e) => {
        if (e.target === modal) closeModal(modal);
    };
    
    const confirmBtn = document.getElementById('confirmAddOrderBtn');
    if (confirmBtn) confirmBtn.onclick = () => confirmAddOrder(userId);
}

async function confirmAddOrder(userId) {
    const orderDate = document.getElementById('newOrderDate').value;
    const planType = document.getElementById('newPlanType').value;
    const startDate = document.getElementById('newStartDate').value;
    let totalPrice = parseFloat(document.getElementById('newTotalPrice').value) || 0;
    const paymentMethod = document.getElementById('newPaymentMethod').value;
    const subscriptionStatus = document.getElementById('newSubscriptionStatus').value;
    const paymentStatus = document.getElementById('newPaymentStatus').value;
    const orderCompleteStatus = document.getElementById('newOrderCompleteStatus').value;
    const notes = document.getElementById('newOrderNotes').value;
    let orderNo = document.getElementById('newOrderNo').value;
    
    if (!orderDate) { showToast('請選擇下單日期', 'error'); return; }
    if (!startDate) { showToast('請選擇訂閱開始日期', 'error'); return; }
    if (totalPrice <= 0) { showToast('請輸入有效的訂單金額', 'error'); return; }
    
    let totalDays = 30;
    if (planType !== 'custom' && PLAN_CONFIG[planType]) {
        totalDays = PLAN_CONFIG[planType].days;
    }
    
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(endDateObj.getDate() + totalDays - 1);
    const endDate = endDateObj.toISOString().split('T')[0];
    
    const { data: existingOrder } = await supabaseClient.from('subscriptions').select('id').eq('order_no', orderNo).maybeSingle();
    if (existingOrder) {
        const date = new Date(orderDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const randomNum = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
        orderNo = `ORD${year}${month}${day}${randomNum}`;
    }
    
    const confirmBtn = document.getElementById('confirmAddOrderBtn');
    const originalText = confirmBtn?.innerText || '確認添加訂單';
    if (confirmBtn) { confirmBtn.innerText = '處理中...'; confirmBtn.disabled = true; }
    
    try {
        const { data: subscription, error: subError } = await supabaseClient.from('subscriptions').insert({
            user_id: userId,
            plan_type: planType === 'custom' ? 'custom' : planType,
            total_days: totalDays,
            meals_received: 0,
            start_date: startDate,
            end_date: endDate,
            status: subscriptionStatus,
            total_price: totalPrice,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            order_no: orderNo,
            notes: notes || null,
            created_at: new Date(orderDate)
        }).select().single();
        
        if (subError) throw subError;
        
        const deliveries = [];
        for (let i = 0; i < totalDays; i++) {
            const deliveryDate = new Date(startDate);
            deliveryDate.setDate(deliveryDate.getDate() + i);
            
            let deliveryStatus = 'upcoming';
            if (orderCompleteStatus === 'completed') {
                deliveryStatus = 'delivered';
            } else if (orderCompleteStatus === 'pending') {
                deliveryStatus = i === 0 ? 'pending' : 'upcoming';
            }
            
            deliveries.push({
                user_id: userId,
                subscription_id: subscription.id,
                delivery_date: deliveryDate.toISOString().split('T')[0],
                status: deliveryStatus,
                meal_number: i + 1,
                created_at: new Date(orderDate)
            });
        }
        
        if (deliveries.length > 0) {
            await supabaseClient.from('deliveries').insert(deliveries);
            if (orderCompleteStatus === 'completed') {
                await supabaseClient.from('subscriptions').update({ meals_received: totalDays }).eq('id', subscription.id);
            }
        }
        
        showToast(`訂單 ${orderNo} 添加成功！`);
        closeModal(document.querySelector('.modal-overlay'));
        usersCache.data = null;
        
        // 關閉當前詳情彈窗並重新打開
        const detailModal = document.querySelector('.modal-overlay:not([style*="display: none"])');
        if (detailModal) closeModal(detailModal);
        viewUserDetail(userId);
        loadUsersPage();
        
    } catch (err) {
        console.error('Add order error:', err);
        showToast('添加訂單失敗: ' + err.message, 'error');
    } finally {
        if (confirmBtn) { confirmBtn.innerText = originalText; confirmBtn.disabled = false; }
    }
}

// ============================================
// 導出數據
// ============================================

async function exportUsersData() {
    try {
        const { data: users, error } = await supabaseClient.from('users').select('*').neq('email', ADMIN_EMAIL);
        if (error) throw error;
        
        const csv = [['姓名', '郵箱', '電話', '地址', '註冊時間']];
        users.forEach(u => {
            csv.push([u.full_name, u.email || '', u.phone || '', u.address || '', u.created_at]);
        });
        
        const blob = new Blob([csv.map(row => row.join(',')).join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('導出成功');
    } catch (err) { 
        console.error('Export error:', err); 
        showToast('導出失敗', 'error'); 
    }
}

// ============================================
// 刷新頁面
// ============================================

function refreshUsersPage() {
    usersCache.data = null;
    loadUsersPage();
}