// ============================================
// 用戶管理模組 - 修復版
// ============================================

// ADMIN_EMAIL 已在 admin-common.js 中定義

// 方案配置
const PLAN_CONFIG = {
    single: { name: '單次', days: 1, price: 15.90 },
    weekly: { name: '週方案', days: 7, price: 111.30 },
    '1month': { name: '1個月', days: 30, price: 447 },
    '2months': { name: '2個月', days: 60, price: 834 },
    '3months': { name: '3個月', days: 90, price: 1161 }
};

// 付款方式選項
const PAYMENT_METHODS = [
    'Credit Card',
    'Bank Transfer', 
    'Cash On Delivery',
    'Touch \'n Go',
    'USDT'
];

// 訂閱狀態選項
const SUBSCRIPTION_STATUS = [
    'active',
    'expired',
    'cancelled',
    'paused'
];

// 獲取方案名稱
function getPlanName(planType) {
    return PLAN_CONFIG[planType]?.name || planType;
}

// 格式化日期
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

// HTML 跳脫
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 顯示通知
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

// 生成 UUID 備用函數
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

// 生成唯一邀請碼（管理員用）
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

// 顯示新增用戶彈窗
function showAddUserModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 500px; width: 90%;">
            <h3><i class="fas fa-user-plus"></i> 手動新增用戶</h3>
            <div class="input-group">
                <label>姓名 <span style="color:#ff5a5a;">*</span></label>
                <input type="text" id="addFullName" placeholder="請輸入姓名">
            </div>
            <div class="input-group">
                <label>郵箱</label>
                <input type="email" id="addEmail" placeholder="user@example.com">
            </div>
            <div class="input-group">
                <label>手機號碼</label>
                <input type="tel" id="addPhone" placeholder="0123456789">
            </div>
            <div class="input-group">
                <label>送餐地址</label>
                <textarea id="addAddress" rows="2" placeholder="請輸入完整地址"></textarea>
            </div>
            <div class="input-group">
                <label>付款方式</label>
                <select id="addPaymentMethod">
                    ${PAYMENT_METHODS.map(m => `<option value="${m}">${m}</option>`).join('')}
                </select>
            </div>
            <div class="input-group">
                <label>備註</label>
                <textarea id="addNotes" rows="2" placeholder="特殊需求、備註等"></textarea>
            </div>
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-save" onclick="confirmAddUser()">新增用戶</button>
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// 確認新增用戶
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
        
        if (insertError) {
            showToast('新增失敗: ' + insertError.message, 'error');
            return;
        }
        
        await supabaseClient.from('invitation_codes').insert({
            code: invitationCode,
            created_by: userId,
            status: 'active',
            created_at: new Date()
        });
        
        showToast(`用戶 ${fullName} 新增成功！`);
        document.querySelector('.modal-overlay')?.remove();
        loadUsersPage();
        
    } catch (err) {
        console.error('Add user error:', err);
        showToast('新增失敗，請重試', 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 加載用戶列表
// 加載用戶列表
async function loadUsersPage() {
    const container = document.getElementById('page_users');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // 修復：使用 neq 代替 not
        const { data: users, error } = await supabaseClient
            .from('users')
            .select('*')
            .neq('email', ADMIN_EMAIL)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Users query error:', error);
            container.innerHTML = '<div class="table-container"><p>加載失敗: ' + error.message + '</p></div>';
            return;
        }
        
        if (!users || users.length === 0) {
            container.innerHTML = '<div class="table-container"><p>暫無用戶</p></div>';
            return;
        }
        
        // 獲取每個用戶的訂閱和配送統計
        const userData = [];
        for (const user of users) {
            try {
                const { data: subscription, error: subError } = await supabaseClient
                    .from('subscriptions')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'active')
                    .maybeSingle();
                
                if (subError) {
                    console.error('Subscription error for user', user.id, subError);
                }
                
                const { data: deliveries, error: delError } = await supabaseClient
                    .from('deliveries')
                    .select('status')
                    .eq('user_id', user.id);
                
                if (delError) {
                    console.error('Deliveries error for user', user.id, delError);
                }
                
                const deliveredCount = deliveries?.filter(d => d.status === 'delivered').length || 0;
                const totalDeliveries = subscription?.total_days || 0;
                
                const { data: receipts, error: recError } = await supabaseClient
                    .from('receipts')
                    .select('amount')
                    .eq('user_id', user.id);
                
                if (recError) {
                    console.error('Receipts error for user', user.id, recError);
                }
                
                const totalPaid = receipts?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
                const progressPercent = subscription ? (deliveredCount / subscription.total_days) * 100 : 0;
                
                userData.push({ 
                    ...user, 
                    subscription, 
                    deliveredCount, 
                    totalDeliveries, 
                    totalPaid,
                    progressPercent
                });
            } catch (err) {
                console.error('Error processing user', user.id, err);
                userData.push({ ...user, subscription: null, deliveredCount: 0, totalDeliveries: 0, totalPaid: 0, progressPercent: 0 });
            }
        }
        
        // 統計數據
        const totalUsers = users.length;
        const activeSubscriptions = userData.filter(u => u.subscription).length;
        const totalRevenue = userData.reduce((sum, u) => sum + u.totalPaid, 0);
        const totalMealsDelivered = userData.reduce((sum, u) => sum + (u.deliveredCount || 0), 0);
        
        container.innerHTML = `
            <!-- 頂部統計欄 -->
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
            
            <!-- 工具欄 -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <input type="text" id="searchInput" placeholder="🔍 搜索用戶名或郵箱..." class="receipt-search" style="width: 260px;">
                    <input type="text" id="searchOrderNo" placeholder="🔍 訂單號搜索..." class="receipt-search" style="width: 220px;">
                    <select id="planFilter" class="form-select" style="width: auto;">
                        <option value="all">全部方案</option>
                        <option value="single">單次</option>
                        <option value="weekly">週方案</option>
                        <option value="1month">1個月</option>
                        <option value="2months">2個月</option>
                        <option value="3months">3個月</option>
                    </select>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-small" onclick="showAddUserModal()" style="background: #c8a15e; color: #0a1a2e;">
                        <i class="fas fa-user-plus"></i> 手動新增用戶
                    </button>
                    <button class="btn-small" onclick="exportUsersData()" style="background: #2d6a4f;">
                        <i class="fas fa-download"></i> 導出數據
                    </button>
                </div>
            </div>
            
            <!-- 用戶表格 -->
            <div class="table-container">
                <div style="overflow-x: auto;">
                    <table style="width: 100%; min-width: 1000px;">
                        <thead>
                            <tr>
                                <th>用戶信息</th>
                                <th>聯繫方式</th>
                                <th>當前方案</th>
                                <th>訂單號 / 訂閱週期</th>
                                <th>配送進度</th>
                                <th>消費金額</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="usersTableBody"></tbody>
                    </table>
                </div>
            </div>
        `;
        
        // 渲染表格
        renderUserTable(userData);
        
        // 綁定搜索和過濾事件
        document.getElementById('searchInput')?.addEventListener('keyup', () => filterUsers(userData));
        document.getElementById('searchOrderNo')?.addEventListener('keyup', () => filterUsers(userData));
        document.getElementById('planFilter')?.addEventListener('change', () => filterUsers(userData));
        
    } catch (err) {
        console.error('Users page error:', err);
        container.innerHTML = '<div class="table-container"><p>加載失敗: ' + err.message + '</p></div>';
    }
}

// 渲染用戶表格
function renderUserTable(userData) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = userData.map(user => {
        const sub = user.subscription;
        const startDate = sub ? formatDate(sub.start_date) : 'N/A';
        const endDate = sub ? formatDate(sub.end_date) : 'N/A';
        const statusText = sub ? 'Active' : 'Inactive';
        const planName = sub ? getPlanName(sub.plan_type) : '—';
        const planPrice = sub ? `RM ${sub.total_price}` : '—';
        
        // 獲取支付狀態顯示
        let paymentStatusHtml = '';
        if (sub && sub.payment_status) {
            const statusMap = {
                'paid': { label: '✅ 已支付', class: 'badge-active' },
                'unpaid': { label: '⏳ 未支付', class: 'badge-pending' },
                'partial': { label: '💰 部分支付', class: 'badge-warning' }
            };
            const ps = statusMap[sub.payment_status] || { label: sub.payment_status, class: 'badge-pending' };
            paymentStatusHtml = `<span class="badge ${ps.class}" style="font-size: 10px;">${ps.label}</span>`;
        }
        
        // 進度條
        const progressBar = sub ? `
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 80px; background: #1e2a3a; border-radius: 10px; height: 6px;">
                    <div style="width: ${user.progressPercent}%; background: #c8a15e; border-radius: 10px; height: 6px;"></div>
                </div>
                <span style="font-size: 11px;">${user.deliveredCount}/${sub.total_days}</span>
            </div>
        ` : '<span>—</span>';
        
        return `
            <tr style="border-bottom: 1px solid #1e2a3a;">
                <td style="padding: 12px 16px;">
                    <div style="font-weight: 600;">${escapeHtml(user.full_name || 'N/A')}</div>
                    <div style="font-size: 11px; color: #6b7a8a;">ID: ${user.id.substring(0, 12)}...</div>
                    <div style="font-size: 11px; color: #6b7a8a;">📅 ${formatDate(user.created_at)}</div>
                </td>
                <td style="padding: 12px 16px;">
                    <div style="font-size: 12px;"><i class="fas fa-envelope"></i> ${escapeHtml(user.email || '未設置')}</div>
                    <div style="font-size: 12px; margin-top: 4px;"><i class="fas fa-phone"></i> ${escapeHtml(user.phone || '未設置')}</div>
                    <div style="font-size: 12px; margin-top: 4px;"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(user.address || '未設置')}</div>
                </td>
                <td style="padding: 12px 16px;">
                    <div><span class="badge badge-active">${planName}</span></div>
                    <div style="font-size: 13px; margin-top: 4px;">💰 ${planPrice}</div>
                    <div style="font-size: 11px; color: #8a9abb;">${sub ? sub.payment_method || '—' : '—'}</div>
                    <div style="margin-top: 4px;">${paymentStatusHtml}</div>
                </td>
                <td style="padding: 12px 16px;">
                    ${sub ? `
                        <div style="font-size: 12px; color: #c8a15e; margin-bottom: 4px;">
                            <i class="fas fa-hashtag"></i> <span class="order-no-badge" style="font-size: 11px;">${sub.order_no || '無訂單號'}</span>
                        </div>
                        <div style="font-size: 12px;">📅 ${startDate} → ${endDate}</div>
                        <div style="font-size: 11px; margin-top: 4px;">
                            <span class="badge ${sub.status === 'active' ? 'badge-active' : 'badge-expired'}">${sub.status}</span>
                        </div>
                    ` : '<span>無訂閱</span>'}
                </td>
                <td style="padding: 12px 16px;">
                    ${progressBar}
                </td>
                <td style="padding: 12px 16px;">
                    <div style="font-weight: 600; color: #c8a15e;">RM ${user.totalPaid.toLocaleString()}</div>
                    <div style="font-size: 11px; color: #6b7a8a;">總消費</div>
                </td>
                <td style="padding: 12px 16px; text-align: center;">
                    <button class="btn-icon" onclick="editUser('${user.id}')" title="編輯"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon" onclick="uploadReceiptForUser('${user.id}')" title="上傳收據"><i class="fas fa-receipt"></i></button>
                    <button class="btn-icon" onclick="viewUserDetail('${user.id}')" title="查看詳情"><i class="fas fa-eye"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// 過濾用戶
function filterUsers(allUsers) {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const orderNoSearch = document.getElementById('searchOrderNo')?.value.toLowerCase() || '';
    const planFilter = document.getElementById('planFilter')?.value || 'all';
    
    const filtered = allUsers.filter(user => {
        const matchesSearch = searchTerm === '' || 
            user.full_name?.toLowerCase().includes(searchTerm) ||
            user.email?.toLowerCase().includes(searchTerm);
        
        let matchesOrderNo = true;
        if (orderNoSearch !== '') {
            matchesOrderNo = user.subscription?.order_no?.toLowerCase().includes(orderNoSearch) || false;
        }
        
        let matchesPlan = true;
        if (planFilter !== 'all') {
            matchesPlan = user.subscription?.plan_type === planFilter;
        }
        
        return matchesSearch && matchesOrderNo && matchesPlan;
    });
    
    renderUserTable(filtered);
    
    const tbody = document.getElementById('usersTableBody');
    if (tbody && filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">沒有找到符合條件的用戶</td></tr>';
    }
}

// 編輯用戶
async function editUser(userId) {
    const { data: user } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (!user) return;
    
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    
    const { data: deliveries } = await supabaseClient
        .from('deliveries')
        .select('status')
        .eq('user_id', userId);
    
    const deliveredCount = deliveries?.filter(d => d.status === 'delivered').length || 0;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 700px; width: 90%; max-height: 85vh; overflow-y: auto;">
            <h3><i class="fas fa-user-edit"></i> 編輯用戶 - ${escapeHtml(user.full_name)}</h3>
            
            <div style="background: rgba(200,161,94,0.1); border-radius: 16px; padding: 15px; margin: 15px 0;">
                <h4 style="color: #c8a15e; margin-bottom: 15px;">基本信息</h4>
                <div class="input-group"><label>地址</label><input type="text" id="editAddress" value="${escapeHtml(user.address || '')}"></div>
                <div class="input-group"><label>郵箱</label><input type="email" id="editEmail" value="${escapeHtml(user.email || '')}"></div>
                <div class="input-group"><label>密碼</label><input type="password" id="editPassword" placeholder="留空則不修改"><small>留空表示保持原密碼不變</small></div>
                <div class="input-group"><label>手機號</label><input type="tel" id="editPhone" value="${escapeHtml(user.phone || '')}"></div>
                <div class="input-group">
                    <label>付款方式</label>
                    <select id="editPaymentMethod">${PAYMENT_METHODS.map(m => `<option value="${m}" ${user.payment_method === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
                </div>
            </div>
            
            <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 15px; margin: 15px 0;">
                <h4 style="color: #c8a15e; margin-bottom: 15px;">訂閱信息</h4>
                <div class="input-group">
                    <label>訂單號</label>
                    <input type="text" value="${subscription?.order_no || ''}" readonly style="background: rgba(0,0,0,0.3);">
                </div>
                <div class="input-group">
                    <label>訂閱狀態</label>
                    <select id="editSubscriptionStatus">${SUBSCRIPTION_STATUS.map(s => `<option value="${s}" ${subscription?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
                </div>
                <div class="input-group">
                    <label>支付狀態</label>
                    <select id="editPaymentStatus">
                        <option value="paid" ${subscription?.payment_status === 'paid' ? 'selected' : ''}>✅ 已支付</option>
                        <option value="unpaid" ${subscription?.payment_status === 'unpaid' ? 'selected' : ''}>⏳ 未支付</option>
                        <option value="partial" ${subscription?.payment_status === 'partial' ? 'selected' : ''}>💰 部分支付</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>配套類型</label>
                    <select id="editPlanType" onchange="updatePlanPrice()">
                        ${Object.entries(PLAN_CONFIG).map(([key, config]) => `
                            <option value="${key}" ${subscription?.plan_type === key ? 'selected' : ''} data-days="${config.days}" data-price="${config.price}">
                                ${config.name} (${config.days}天 - RM ${config.price})
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="input-group">
                    <label>開始日期</label>
                    <input type="date" id="editStartDate" value="${subscription?.start_date?.split('T')[0] || ''}" onchange="updateEndDate()">
                </div>
                <div class="input-group">
                    <label>結束日期</label>
                    <input type="date" id="editEndDate" readonly style="background: rgba(0,0,0,0.3);">
                </div>
                <div class="input-group">
                    <label>已送達餐數</label>
                    <input type="number" id="editMealsReceived" value="${subscription?.meals_received || deliveredCount || 0}" min="0">
                </div>
                <div class="input-group">
                    <label>總價格 (RM)</label>
                    <input type="number" id="editTotalPrice" value="${subscription?.total_price || ''}" step="0.01" readonly style="background: rgba(0,0,0,0.3);">
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-save" onclick="saveUserEdit('${userId}')">保存修改</button>
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    window.updatePlanPrice = function() {
        const planSelect = document.getElementById('editPlanType');
        const selectedOption = planSelect.options[planSelect.selectedIndex];
        const price = selectedOption.dataset.price;
        const priceInput = document.getElementById('editTotalPrice');
        if (priceInput && price) priceInput.value = price;
        updateEndDate();
    };
    
    window.updateEndDate = function() {
        const startDateInput = document.getElementById('editStartDate');
        const planSelect = document.getElementById('editPlanType');
        const selectedOption = planSelect.options[planSelect.selectedIndex];
        const days = parseInt(selectedOption.dataset.days);
        const endDateInput = document.getElementById('editEndDate');
        if (startDateInput.value && days) {
            const start = new Date(startDateInput.value);
            const end = new Date(start);
            end.setDate(end.getDate() + days - 1);
            endDateInput.value = end.toISOString().split('T')[0];
        }
    };
    
    updatePlanPrice();
    updateEndDate();
}

// 保存用戶編輯
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
    
    const updateUserData = {
        address: address || null,
        email: email || null,
        phone: phone || null,
        payment_method: paymentMethod
    };
    
    if (password && password.trim() !== '') {
        updateUserData.password = btoa(password);
    }
    
    const { error: userError } = await supabaseClient
        .from('users')
        .update(updateUserData)
        .eq('id', userId);
    
    if (userError) {
        showToast('更新失敗: ' + userError.message, 'error');
        return;
    }
    
    const { data: existingSubscription } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    
    const subscriptionData = {
        plan_type: planType,
        total_days: planDays,
        meals_received: mealsReceived,
        start_date: startDate,
        end_date: endDate,
        status: subscriptionStatus,
        payment_status: paymentStatus,
        total_price: totalPrice,
        updated_at: new Date()
    };
    
    if (existingSubscription) {
        await supabaseClient.from('subscriptions').update(subscriptionData).eq('id', existingSubscription.id);
    } else if (subscriptionStatus === 'active') {
        await supabaseClient.from('subscriptions').insert({ user_id: userId, ...subscriptionData, created_at: new Date() });
    }
    
    showToast('用戶信息已更新！');
    document.querySelector('.modal-overlay')?.remove();
    loadUsersPage();
}

// 查看用戶詳情
async function viewUserDetail(userId) {
    const { data: user } = await supabaseClient.from('users').select('*').eq('id', userId).single();
    const { data: subscription } = await supabaseClient.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
    const { data: receipts } = await supabaseClient.from('receipts').select('*').eq('user_id', userId);
    
    const totalPaid = receipts?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 500px; width: 90%;">
            <h3>用戶詳情 - ${escapeHtml(user.full_name)}</h3>
            <hr style="margin: 15px 0;">
            <div><strong>姓名：</strong> ${escapeHtml(user.full_name)}</div>
            <div><strong>郵箱：</strong> ${escapeHtml(user.email || '未設置')}</div>
            <div><strong>電話：</strong> ${escapeHtml(user.phone || '未設置')}</div>
            <div><strong>地址：</strong> ${escapeHtml(user.address || '未設置')}</div>
            <hr style="margin: 15px 0;">
            <h4>訂閱信息</h4>
            ${subscription ? `
                <div><strong>訂單號：</strong> ${subscription.order_no || '無'}</div>
                <div><strong>方案：</strong> ${getPlanName(subscription.plan_type)}</div>
                <div><strong>期間：</strong> ${formatDate(subscription.start_date)} - ${formatDate(subscription.end_date)}</div>
                <div><strong>金額：</strong> RM ${subscription.total_price}</div>
                <div><strong>支付狀態：</strong> ${subscription.payment_status === 'paid' ? '已支付' : '未支付'}</div>
            ` : '<p>無活躍訂閱</p>'}
            <hr>
            <div><strong>總消費：</strong> RM ${totalPaid}</div>
            <div style="margin-top: 20px;"><button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">關閉</button></div>
        </div>
    `;
    document.body.appendChild(modal);
}

// 上傳收據（從用戶管理頁面調用）
async function uploadReceiptForUser(userId) {
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('id, order_no, total_price')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    
    if (!subscription) {
        showToast('用戶沒有活躍訂閱', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 450px; width: 90%;">
            <h3>上傳收據 - ${escapeHtml(user.full_name)}</h3>
            <div class="input-group">
                <label>訂單號</label>
                <input type="text" value="${subscription.order_no || '無訂單號'}" readonly style="background: rgba(0,0,0,0.3);">
            </div>
            <div class="input-group">
                <label>金額 (RM)</label>
                <input type="number" id="receiptAmount" value="${subscription.total_price}" step="0.01">
            </div>
            <div class="input-group">
                <label>付款方式</label>
                <select id="receiptPaymentMethod">
                    <option value="credit_card">信用卡</option>
                    <option value="bank_transfer">銀行轉帳</option>
                    <option value="cash">貨到付款</option>
                    <option value="touchngo">Touch n Go</option>
                </select>
            </div>
            <div class="input-group">
                <label>收據圖片</label>
                <input type="file" id="receiptFile" accept="image/*,.pdf">
            </div>
            <div class="modal-buttons">
                <button class="btn-save" onclick="uploadReceiptForUserConfirm('${userId}', '${subscription.id}', '${subscription.order_no}')">上傳</button>
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function uploadReceiptForUserConfirm(userId, subscriptionId, orderNo) {
    const amount = parseFloat(document.getElementById('receiptAmount').value) || 0;
    const paymentMethod = document.getElementById('receiptPaymentMethod').value;
    const file = document.getElementById('receiptFile').files[0];
    
    if (amount <= 0) {
        showToast('請輸入有效的金額', 'error');
        return;
    }
    
    if (!file) {
        showToast('請選擇收據文件', 'error');
        return;
    }
    
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `receipt_${userId}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabaseClient.storage
            .from('receipts')
            .upload(fileName, file);
        
        if (uploadError) {
            showToast('上傳失敗: ' + uploadError.message, 'error');
            return;
        }
        
        const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);
        
        await supabaseClient.from('receipts').insert({
            user_id: userId,
            subscription_id: subscriptionId,
            order_no: orderNo,
            amount: amount,
            receipt_url: urlData.publicUrl,
            payment_method: paymentMethod,
            created_at: new Date()
        });
        
        await supabaseClient
            .from('subscriptions')
            .update({ payment_status: 'paid' })
            .eq('id', subscriptionId);
        
        showToast('收據上傳成功！');
        if (document.getElementById('page_receipts')?.classList.contains('active') && typeof loadReceiptsPage === 'function') {
            loadReceiptsPage();
        }
        loadUsersPage();
        
    } catch (err) {
        console.error('Upload error:', err);
        showToast('上傳失敗: ' + err.message, 'error');
    }
}

// 導出用戶數據
async function exportUsersData() {
    try {
        const { data: users, error } = await supabaseClient
            .from('users')
            .select('*, subscriptions(order_no, plan_type, total_price, payment_status)')
            .neq('email', ADMIN_EMAIL);
        
        if (error) {
            showToast('導出失敗: ' + error.message, 'error');
            return;
        }
        
        const csv = [['姓名', '郵箱', '電話', '地址', '訂單號', '方案', '金額', '支付狀態', '註冊時間']];
        users.forEach(u => {
            const sub = u.subscriptions;
            csv.push([
                u.full_name,
                u.email || '',
                u.phone || '',
                u.address || '',
                sub?.order_no || '',
                sub?.plan_type || '',
                sub?.total_price || '',
                sub?.payment_status || '',
                u.created_at
            ]);
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