// ============================================
// 用戶管理模組 - 表格專業風
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

// 加載用戶列表
async function loadUsersPage() {
    const container = document.getElementById('page_users');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const { data: users, error } = await supabaseClient
            .from('users')
            .select('*')
            .not('email', 'eq', ADMIN_EMAIL)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!users || users.length === 0) {
            container.innerHTML = '<div class="table-container"><p>暫無用戶</p></div>';
            return;
        }
        
        // 獲取每個用戶的訂閱和配送統計
        const userData = [];
        for (const user of users) {
            const { data: subscription } = await supabaseClient
                .from('subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .maybeSingle();
            
            const { data: deliveries } = await supabaseClient
                .from('deliveries')
                .select('status')
                .eq('user_id', user.id);
            
            const deliveredCount = deliveries?.filter(d => d.status === 'delivered').length || 0;
            const totalDeliveries = subscription?.total_days || 0;
            
            const { data: receipts } = await supabaseClient
                .from('receipts')
                .select('amount')
                .eq('user_id', user.id);
            
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
        }
        
        // 統計數據
        const totalUsers = users.length;
        const activeSubscriptions = userData.filter(u => u.subscription).length;
        const totalRevenue = userData.reduce((sum, u) => sum + u.totalPaid, 0);
        const totalMealsDelivered = userData.reduce((sum, u) => sum + (u.deliveredCount || 0), 0);
        
        container.innerHTML = `
            <!-- 頂部統計欄 -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 24px;">
                <div style="background: #111827; border-radius: 16px; padding: 16px 20px; border: 1px solid #1e2a3a;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 28px; font-weight: 700; color: #c8a15e;">${totalUsers}</div>
                            <div style="font-size: 13px; color: #8a9abb;">總用戶數</div>
                        </div>
                        <i class="fas fa-users" style="font-size: 32px; color: #c8a15e; opacity: 0.5;"></i>
                    </div>
                </div>
                <div style="background: #111827; border-radius: 16px; padding: 16px 20px; border: 1px solid #1e2a3a;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 28px; font-weight: 700; color: #c8a15e;">${activeSubscriptions}</div>
                            <div style="font-size: 13px; color: #8a9abb;">活躍訂閱</div>
                        </div>
                        <i class="fas fa-calendar-check" style="font-size: 32px; color: #c8a15e; opacity: 0.5;"></i>
                    </div>
                </div>
                <div style="background: #111827; border-radius: 16px; padding: 16px 20px; border: 1px solid #1e2a3a;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 28px; font-weight: 700; color: #c8a15e;">RM ${totalRevenue.toLocaleString()}</div>
                            <div style="font-size: 13px; color: #8a9abb;">總營收</div>
                        </div>
                        <i class="fas fa-dollar-sign" style="font-size: 32px; color: #c8a15e; opacity: 0.5;"></i>
                    </div>
                </div>
                <div style="background: #111827; border-radius: 16px; padding: 16px 20px; border: 1px solid #1e2a3a;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 28px; font-weight: 700; color: #c8a15e;">${totalMealsDelivered}</div>
                            <div style="font-size: 13px; color: #8a9abb;">總配送餐數</div>
                        </div>
                        <i class="fas fa-utensils" style="font-size: 32px; color: #c8a15e; opacity: 0.5;"></i>
                    </div>
                </div>
            </div>
            
            <!-- 工具欄 -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                <div style="display: flex; gap: 12px;">
                    <input type="text" id="searchInput" placeholder="🔍 搜索用戶名或郵箱..." style="background: #0f172a; border: 1px solid #1e2a3a; border-radius: 40px; padding: 10px 20px; color: #eef5ff; width: 260px;">
                    <select id="planFilter" style="background: #0f172a; border: 1px solid #1e2a3a; border-radius: 40px; padding: 10px 16px; color: #eef5ff;">
                        <option value="all">全部方案</option>
                        <option value="single">單次</option>
                        <option value="weekly">週方案</option>
                        <option value="1month">1個月</option>
                        <option value="2months">2個月</option>
                        <option value="3months">3個月</option>
                    </select>
                </div>
                <button class="btn-small" onclick="exportUsersData()" style="background: #2d6a4f; padding: 10px 20px;">
                    <i class="fas fa-download"></i> 導出數據
                </button>
            </div>
            
            <!-- 用戶表格 -->
            <div style="background: #111827; border-radius: 20px; border: 1px solid #1e2a3a; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #0f172a; border-bottom: 1px solid #1e2a3a;">
                            <th style="padding: 16px 20px; text-align: left; color: #8a9abb; font-weight: 500;">用戶信息</th>
                            <th style="padding: 16px 20px; text-align: left; color: #8a9abb; font-weight: 500;">聯繫方式</th>
                            <th style="padding: 16px 20px; text-align: left; color: #8a9abb; font-weight: 500;">當前方案</th>
                            <th style="padding: 16px 20px; text-align: left; color: #8a9abb; font-weight: 500;">訂閱週期</th>
                            <th style="padding: 16px 20px; text-align: left; color: #8a9abb; font-weight: 500;">配送進度</th>
                            <th style="padding: 16px 20px; text-align: left; color: #8a9abb; font-weight: 500;">消費金額</th>
                            <th style="padding: 16px 20px; text-align: center; color: #8a9abb; font-weight: 500;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody"></tbody>
                </table>
            </div>
        `;
        
        // 渲染表格
        renderUserTable(userData);
        
        // 綁定搜索和過濾事件
        document.getElementById('searchInput')?.addEventListener('keyup', () => filterUsers(userData));
        document.getElementById('planFilter')?.addEventListener('change', () => filterUsers(userData));
        
    } catch (err) {
        console.error('Users page error:', err);
        container.innerHTML = '<div class="table-container"><p>加載失敗</p></div>';
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
        const statusClass = sub ? 'status-active' : 'status-inactive';
        const statusText = sub ? 'Active' : 'Inactive';
        const planName = sub ? getPlanName(sub.plan_type) : '—';
        const planPrice = sub ? `RM ${sub.total_price}` : '—';
        
        // 進度條
        const progressBar = sub ? `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 80px; background: #1e2a3a; border-radius: 10px; height: 6px;">
                    <div style="width: ${user.progressPercent}%; background: #c8a15e; border-radius: 10px; height: 6px;"></div>
                </div>
                <span style="font-size: 12px; color: #8a9abb;">${user.deliveredCount}/${sub.total_days}</span>
            </div>
        ` : '<span style="color: #8a9abb;">—</span>';
        
        return `
            <tr style="border-bottom: 1px solid #1e2a3a;" data-user-id="${user.id}">
                <td style="padding: 16px 20px;">
                    <div style="font-weight: 600; color: #eef5ff;">${escapeHtml(user.full_name || 'N/A')}</div>
                    <div style="font-size: 11px; color: #6b7a8a; margin-top: 4px;">ID: ${user.id.substring(0, 12)}...</div>
                    <div style="font-size: 11px; color: #6b7a8a; margin-top: 2px;">📅 ${formatDate(user.created_at)}</div>
                </td>
                <td style="padding: 16px 20px;">
                    <div style="font-size: 13px;"><i class="fas fa-envelope" style="width: 20px; color: #c8a15e;"></i> ${escapeHtml(user.email || '未設置')}</div>
                    <div style="font-size: 13px; margin-top: 6px;"><i class="fas fa-phone" style="width: 20px; color: #c8a15e;"></i> ${escapeHtml(user.phone || '未設置')}</div>
                    <div style="font-size: 13px; margin-top: 6px;"><i class="fas fa-map-marker-alt" style="width: 20px; color: #c8a15e;"></i> ${escapeHtml(user.address || '未設置')}</div>
                </td>
                <td style="padding: 16px 20px;">
                    <div><span class="badge badge-active" style="background: rgba(200,161,94,0.15); color: #c8a15e;">${planName}</span></div>
                    <div style="font-size: 13px; margin-top: 6px;">💰 ${planPrice}</div>
                    <div style="font-size: 12px; margin-top: 4px; color: #8a9abb;">${sub ? sub.payment_method || '未設置' : '—'}</div>
                </td>
                <td style="padding: 16px 20px;">
                    ${sub ? `
                        <div style="font-size: 13px;">📅 ${startDate} → ${endDate}</div>
                        <div style="font-size: 12px; margin-top: 4px;">
                            <span class="badge ${statusClass}" style="background: ${statusText === 'Active' ? 'rgba(46,209,90,0.15)' : 'rgba(255,90,90,0.15)'}; color: ${statusText === 'Active' ? '#2ed15a' : '#ff5a5a'};">${statusText}</span>
                        </div>
                    ` : '<span style="color: #8a9abb;">無訂閱</span>'}
                </td>
                <td style="padding: 16px 20px;">
                    ${progressBar}
                </td>
                <td style="padding: 16px 20px;">
                    <div style="font-weight: 600; color: #c8a15e;">RM ${user.totalPaid.toLocaleString()}</div>
                    <div style="font-size: 11px; color: #6b7a8a; margin-top: 2px;">總消費</div>
                </td>
                <td style="padding: 16px 20px; text-align: center;">
                    <button class="btn-icon" onclick="editUser('${user.id}')" title="編輯" style="background: transparent; border: none; color: #8a9abb; cursor: pointer; padding: 6px 10px;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="uploadReceiptForUser('${user.id}')" title="上傳收據" style="background: transparent; border: none; color: #8a9abb; cursor: pointer; padding: 6px 10px;">
                        <i class="fas fa-receipt"></i>
                    </button>
                    <button class="btn-icon" onclick="viewUserDetail('${user.id}')" title="查看詳情" style="background: transparent; border: none; color: #8a9abb; cursor: pointer; padding: 6px 10px;">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 過濾用戶
function filterUsers(allUsers) {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const planFilter = document.getElementById('planFilter')?.value || 'all';
    
    const filtered = allUsers.filter(user => {
        // 搜索過濾
        const matchesSearch = searchTerm === '' || 
            user.full_name?.toLowerCase().includes(searchTerm) ||
            user.email?.toLowerCase().includes(searchTerm);
        
        // 方案過濾
        let matchesPlan = true;
        if (planFilter !== 'all') {
            matchesPlan = user.subscription?.plan_type === planFilter;
        }
        
        return matchesSearch && matchesPlan;
    });
    
    renderUserTable(filtered);
    
    // 更新顯示數量
    const tbody = document.getElementById('usersTableBody');
    if (tbody && filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #8a9abb;">沒有找到符合條件的用戶</td></tr>';
    }
}

// 編輯用戶
async function editUser(userId) {
    // 獲取用戶信息
    const { data: user } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (!user) return;
    
    // 獲取用戶的訂閱信息
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    
    // 獲取配送統計
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
                <h4 style="color: #c8a15e; margin-bottom: 15px;"><i class="fas fa-info-circle"></i> 基本信息</h4>
                <div class="input-group"><label>地址</label><input type="text" id="editAddress" value="${escapeHtml(user.address || '')}" placeholder="送餐地址"></div>
                <div class="input-group"><label>郵箱</label><input type="email" id="editEmail" value="${escapeHtml(user.email || '')}" placeholder="user@example.com"></div>
                <div class="input-group"><label>密碼</label><input type="password" id="editPassword" placeholder="留空則不修改"><small style="color:#8a9abb;">留空表示保持原密碼不變</small></div>
                <div class="input-group"><label>手機號</label><input type="tel" id="editPhone" value="${escapeHtml(user.phone || '')}" placeholder="0123456789"></div>
                <div class="input-group">
                    <label>付款方式</label>
                    <select id="editPaymentMethod">${PAYMENT_METHODS.map(m => `<option value="${m}" ${user.payment_method === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
                </div>
            </div>
            
            <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 15px; margin: 15px 0;">
                <h4 style="color: #c8a15e; margin-bottom: 15px;"><i class="fas fa-calendar-alt"></i> 訂閱信息</h4>
                <div class="input-group">
                    <label>訂閱狀態</label>
                    <select id="editSubscriptionStatus">${SUBSCRIPTION_STATUS.map(s => `<option value="${s}" ${subscription?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
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
                    <input type="number" id="editMealsReceived" value="${subscription?.meals_received || deliveredCount || 0}" min="0" step="1">
                </div>
                <div class="input-group">
                    <label>總價格 (RM)</label>
                    <input type="number" id="editTotalPrice" value="${subscription?.total_price || ''}" step="0.01" readonly style="background: rgba(0,0,0,0.3);">
                </div>
            </div>
            
            <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 15px; margin: 15px 0;">
                <h4 style="color: #c8a15e; margin-bottom: 15px;"><i class="fas fa-sticky-note"></i> 備註信息</h4>
                <div class="input-group">
                    <label>餐品備註</label>
                    <textarea id="editMealNotes" rows="2" placeholder="特殊飲食需求、過敏信息等">${escapeHtml(user.meal_notes || '')}</textarea>
                </div>
                <div class="input-group">
                    <label>訂閱備註</label>
                    <textarea id="editSubscriptionNotes" rows="2" placeholder="訂閱調整原因、特殊情況等">${escapeHtml(subscription?.notes || '')}</textarea>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-save" onclick="saveUserEdit('${userId}')">保存修改</button>
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 綁定更新函數
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
    const planType = document.getElementById('editPlanType').value;
    const startDate = document.getElementById('editStartDate').value;
    const endDate = document.getElementById('editEndDate').value;
    const mealsReceived = parseInt(document.getElementById('editMealsReceived').value) || 0;
    const totalPrice = parseFloat(document.getElementById('editTotalPrice').value) || 0;
    const mealNotes = document.getElementById('editMealNotes').value;
    const subscriptionNotes = document.getElementById('editSubscriptionNotes').value;
    
    const planDays = PLAN_CONFIG[planType]?.days || 30;
    
    // 更新用戶基本信息
    const updateUserData = {
        address: address || null,
        email: email || null,
        phone: phone || null,
        payment_method: paymentMethod,
        meal_notes: mealNotes || null
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
    
    // 檢查現有訂閱
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
        total_price: totalPrice,
        notes: subscriptionNotes || null,
        updated_at: new Date()
    };
    
    if (existingSubscription) {
        await supabaseClient.from('subscriptions').update(subscriptionData).eq('id', existingSubscription.id);
    } else if (subscriptionStatus === 'active') {
        await supabaseClient.from('subscriptions').insert({ user_id: userId, ...subscriptionData, created_at: new Date() });
    }
    
    // 更新配送記錄
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    
    if (subscription) {
        await supabaseClient.from('deliveries').delete().eq('user_id', userId).eq('subscription_id', subscription.id);
        
        const deliveries = [];
        for (let i = 0; i < planDays; i++) {
            const deliveryDate = new Date(startDate);
            deliveryDate.setDate(deliveryDate.getDate() + i);
            deliveries.push({
                user_id: userId,
                subscription_id: subscription.id,
                delivery_date: deliveryDate.toISOString().split('T')[0],
                status: i < mealsReceived ? 'delivered' : (i === mealsReceived ? 'pending' : 'upcoming'),
                meal_number: i + 1
            });
        }
        if (deliveries.length > 0) await supabaseClient.from('deliveries').insert(deliveries);
    }
    
    showToast('用戶信息已更新！');
    document.querySelector('.modal-overlay')?.remove();
    loadUsersPage();
}

// 查看用戶詳情
async function viewUserDetail(userId) {
    const { data: user } = await supabaseClient.from('users').select('*').eq('id', userId).single();
    const { data: subscription } = await supabaseClient.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
    const { data: deliveries } = await supabaseClient.from('deliveries').select('*').eq('user_id', userId).order('delivery_date', { ascending: false }).limit(14);
    const { data: receipts } = await supabaseClient.from('receipts').select('*').eq('user_id', userId);
    
    const totalPaid = receipts?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
    const deliveredCount = deliveries?.filter(d => d.status === 'delivered').length || 0;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <h3><i class="fas fa-user"></i> 用戶詳情 - ${escapeHtml(user.full_name)}</h3>
            <hr style="margin: 15px 0; border-color: #1e2a3a;">
            <div><strong>姓名：</strong> ${escapeHtml(user.full_name)}</div>
            <div><strong>郵箱：</strong> ${escapeHtml(user.email || '未設置')}</div>
            <div><strong>電話：</strong> ${escapeHtml(user.phone || '未設置')}</div>
            <div><strong>地址：</strong> ${escapeHtml(user.address || '未設置')}</div>
            <div><strong>付款方式：</strong> ${escapeHtml(user.payment_method || '未設置')}</div>
            <div><strong>註冊時間：</strong> ${formatDate(user.created_at)}</div>
            <hr style="margin: 15px 0; border-color: #1e2a3a;">
            <h4>📋 訂閱信息</h4>
            ${subscription ? `
                <div><strong>方案：</strong> ${getPlanName(subscription.plan_type)}</div>
                <div><strong>期間：</strong> ${formatDate(subscription.start_date)} - ${formatDate(subscription.end_date)}</div>
                <div><strong>總餐數：</strong> ${subscription.total_days} 餐</div>
                <div><strong>已送達：</strong> ${deliveredCount} 餐</div>
                <div><strong>金額：</strong> RM ${subscription.total_price}</div>
                <div><strong>狀態：</strong> ${subscription.status}</div>
                ${subscription.notes ? `<div><strong>備註：</strong> ${escapeHtml(subscription.notes)}</div>` : ''}
            ` : '<p>無活躍訂閱</p>'}
            <hr style="margin: 15px 0; border-color: #1e2a3a;">
            <h4>💰 消費記錄</h4>
            <div><strong>總消費：</strong> RM ${totalPaid}</div>
            <div><strong>收據數量：</strong> ${receipts?.length || 0} 張</div>
            ${user.meal_notes ? `<hr style="margin: 15px 0; border-color: #1e2a3a;"><h4>🍽️ 餐品備註</h4><div>${escapeHtml(user.meal_notes)}</div>` : ''}
            <div style="margin-top: 20px;"><button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">關閉</button></div>
        </div>
    `;
    document.body.appendChild(modal);
}

// 上傳收據
async function uploadReceiptForUser(userId) {
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    
    if (!subscription) {
        showToast('用戶沒有活躍訂閱', 'error');
        return;
    }
    
    document.getElementById('receiptUserId').value = userId;
    document.getElementById('receiptAmount').value = '';
    document.getElementById('receiptFile').value = '';
    document.getElementById('receiptModal').style.display = 'flex';
}

async function uploadReceipt() {
    const userId = document.getElementById('receiptUserId').value;
    const amount = parseInt(document.getElementById('receiptAmount').value) || 0;
    const file = document.getElementById('receiptFile').files[0];
    
    if (!file) {
        showToast('請選擇文件', 'error');
        return;
    }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `receipt_${userId}_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabaseClient.storage.from('receipts').upload(fileName, file);
    if (uploadError) {
        showToast('上傳失敗: ' + uploadError.message, 'error');
        return;
    }
    
    const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);
    
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    
    if (subscription) {
        await supabaseClient.from('receipts').insert({
            user_id: userId,
            subscription_id: subscription.id,
            amount: amount,
            receipt_url: urlData.publicUrl,
            payment_method: 'admin_upload',
            created_at: new Date()
        });
    }
    
    showToast(`收據上傳成功！金額: RM ${amount}`);
    closeReceiptModal();
}

function closeReceiptModal() {
    document.getElementById('receiptModal').style.display = 'none';
}

// 導出用戶數據
async function exportUsersData() {
    const { data: users } = await supabaseClient.from('users').select('*').not('email', 'eq', ADMIN_EMAIL);
    const csv = [['姓名', '郵箱', '電話', '地址', '付款方式', '註冊時間']];
    users.forEach(u => csv.push([u.full_name, u.email, u.phone, u.address, u.payment_method, u.created_at]));
    const blob = new Blob([csv.map(row => row.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('導出成功');
}