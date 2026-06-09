// ============================================
// 用戶管理模組 - 完整編輯功能
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
            
            const totalDeliveries = deliveries?.length || 0;
            const deliveredCount = deliveries?.filter(d => d.status === 'delivered').length || 0;
            
            const { data: receipts } = await supabaseClient
                .from('receipts')
                .select('amount')
                .eq('user_id', user.id);
            
            const totalPaid = receipts?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
            
            userData.push({ ...user, subscription, totalDeliveries, deliveredCount, totalPaid });
        }
        
        container.innerHTML = `
            <div class="table-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                    <h3>👥 用戶管理 (共 ${users.length} 人)</h3>
                    <button class="btn-small" onclick="exportUsersData()" style="background: #2d6a4f;"><i class="fas fa-download"></i> 導出數據</button>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; min-width: 1000px;">
                        <thead>
                            <tr>
                                <th>用戶信息</th><th>聯繫方式</th><th>當前方案</th><th>週期</th><th>配送進度</th><th>消費金額</th><th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="usersTableBody"></tbody>
                    </table>
                </div>
            </div>
        `;
        
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = userData.map(user => {
            const sub = user.subscription;
            const progressPercent = sub ? (user.deliveredCount / sub.total_days) * 100 : 0;
            const startDate = sub ? new Date(sub.start_date).toLocaleDateString() : 'N/A';
            const endDate = sub ? new Date(sub.end_date).toLocaleDateString() : 'N/A';
            
            return `
                <tr>
                    <td>
                        <strong>${escapeHtml(user.full_name || 'N/A')}</strong><br>
                        <small style="color:#8a9abb;">ID: ${user.id.substring(0, 8)}...</small><br>
                        <small>註冊: ${formatDate(user.created_at)}</small>
                    </td>
                    <td>
                        📧 ${escapeHtml(user.email || 'N/A')}<br>
                        📱 ${escapeHtml(user.phone || 'N/A')}<br>
                        📍 ${escapeHtml(user.address || 'N/A')}
                    </td
                    <td>
                        ${sub ? `<span class="badge badge-active">${PLAN_CONFIG[sub.plan_type]?.name || sub.plan_type}</span><br>
                        <small>💰 RM ${sub.total_price}</small>` : '<span class="badge badge-expired">無訂閱</span>'}
                    </td>
                    <td>
                        ${sub ? `
                            <small>📅 開始: ${startDate}</small><br>
                            <small>📅 結束: ${endDate}</small><br>
                            <small>📦 狀態: ${sub.status || 'active'}</small>
                        ` : '—'}
                    </td>
                    <td>
                        ${sub ? `
                            <div style="width: 100px; background: #1e2a3a; border-radius: 10px; height: 6px;">
                                <div style="width: ${progressPercent}%; background: #c8a15e; border-radius: 10px; height: 6px;"></div>
                            </div>
                            <small>${user.deliveredCount} / ${sub.total_days} 餐</small>
                        ` : '—'}
                    </td>
                    <td>RM ${user.totalPaid.toLocaleString()}<br><small>💰 總消費</small></td>
                    <td>
                        <button class="btn-icon" onclick="editUser('${user.id}')" title="編輯用戶">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="uploadReceiptForUser('${user.id}')" title="上傳收據">
                            <i class="fas fa-receipt"></i>
                        </button>
                        <button class="btn-icon" onclick="viewUserDetail('${user.id}')" title="查看詳情">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </td>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Users page error:', err);
        container.innerHTML = '<div class="table-container"><p>加載失敗</p></div>';
    }
}

// 編輯用戶（完整版）
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
            
            <!-- 基本信息區塊 -->
            <div style="background: rgba(200,161,94,0.1); border-radius: 16px; padding: 15px; margin: 15px 0;">
                <h4 style="color: #c8a15e; margin-bottom: 15px;"><i class="fas fa-info-circle"></i> 基本信息</h4>
                <div class="input-group">
                    <label>地址 / Address</label>
                    <input type="text" id="editAddress" value="${escapeHtml(user.address || '')}" placeholder="送餐地址">
                </div>
                <div class="input-group">
                    <label>郵箱 / Email</label>
                    <input type="email" id="editEmail" value="${escapeHtml(user.email || '')}" placeholder="user@example.com">
                </div>
                <div class="input-group">
                    <label>密碼 / Password</label>
                    <input type="password" id="editPassword" placeholder="留空則不修改密碼">
                    <small style="color:#8a9abb;">留空表示保持原密碼不變</small>
                </div>
                <div class="input-group">
                    <label>手機號 / Phone</label>
                    <input type="tel" id="editPhone" value="${escapeHtml(user.phone || '')}" placeholder="0123456789">
                </div>
                <div class="input-group">
                    <label>付款方式 / Payment Method</label>
                    <select id="editPaymentMethod">
                        ${PAYMENT_METHODS.map(m => `<option value="${m}" ${user.payment_method === m ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                </div>
            </div>
            
            <!-- 訂閱信息區塊 -->
            <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 15px; margin: 15px 0;">
                <h4 style="color: #c8a15e; margin-bottom: 15px;"><i class="fas fa-calendar-alt"></i> 訂閱信息</h4>
                <div class="input-group">
                    <label>訂閱狀態 / Subscription Status</label>
                    <select id="editSubscriptionStatus">
                        ${SUBSCRIPTION_STATUS.map(s => `<option value="${s}" ${subscription?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div class="input-group">
                    <label>配套類型 / Plan Type</label>
                    <select id="editPlanType" onchange="updatePlanPrice()">
                        ${Object.entries(PLAN_CONFIG).map(([key, config]) => `
                            <option value="${key}" ${subscription?.plan_type === key ? 'selected' : ''} data-days="${config.days}" data-price="${config.price}">
                                ${config.name} (${config.days}天 - RM ${config.price})
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="input-group">
                    <label>開始日期 / Start Date</label>
                    <input type="date" id="editStartDate" value="${subscription?.start_date?.split('T')[0] || ''}" onchange="updateEndDate()">
                </div>
                <div class="input-group">
                    <label>結束日期 / End Date (自動計算)</label>
                    <input type="date" id="editEndDate" readonly style="background: rgba(0,0,0,0.3);">
                </div>
                <div class="input-group">
                    <label>已送達餐數 / Meals Delivered</label>
                    <input type="number" id="editMealsReceived" value="${subscription?.meals_received || deliveredCount || 0}" min="0" step="1">
                    <small style="color:#8a9abb;">手動調整已送達的餐點數量</small>
                </div>
                <div class="input-group">
                    <label>總價格 / Total Price (RM)</label>
                    <input type="number" id="editTotalPrice" value="${subscription?.total_price || ''}" step="0.01" readonly style="background: rgba(0,0,0,0.3);">
                </div>
            </div>
            
            <!-- 備註區塊 -->
            <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 15px; margin: 15px 0;">
                <h4 style="color: #c8a15e; margin-bottom: 15px;"><i class="fas fa-sticky-note"></i> 備註信息</h4>
                <div class="input-group">
                    <label>餐品備註 / Meal Notes</label>
                    <textarea id="editMealNotes" rows="2" placeholder="特殊飲食需求、過敏信息、喜好等">${escapeHtml(user.meal_notes || '')}</textarea>
                    <small style="color:#8a9abb;">關於餐品的特殊要求（過敏、忌口等）</small>
                </div>
                <div class="input-group">
                    <label>訂閱備註 / Subscription Notes</label>
                    <textarea id="editSubscriptionNotes" rows="2" placeholder="訂閱調整原因、特殊情況等">${escapeHtml(subscription?.notes || '')}</textarea>
                    <small style="color:#8a9abb;">內部備註，記錄訂閱調整原因</small>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-save" onclick="saveUserEdit('${userId}')">保存修改</button>
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 綁定配套變化事件
    window.updatePlanPrice = function() {
        const planSelect = document.getElementById('editPlanType');
        const selectedOption = planSelect.options[planSelect.selectedIndex];
        const price = selectedOption.dataset.price;
        const priceInput = document.getElementById('editTotalPrice');
        if (priceInput && price) {
            priceInput.value = price;
        }
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
    
    // 初始化更新
    updatePlanPrice();
    updateEndDate();
}

// 保存用戶編輯
async function saveUserEdit(userId) {
    // 獲取表單數據
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
    
    // 獲取方案天數
    const planDays = PLAN_CONFIG[planType]?.days || 30;
    
    // 1. 更新用戶基本信息
    const updateUserData = {
        address: address || null,
        email: email || null,
        phone: phone || null,
        payment_method: paymentMethod,
        meal_notes: mealNotes || null
    };
    
    // 如果有填寫密碼，則更新密碼（簡單編碼存儲）
    if (password && password.trim() !== '') {
        updateUserData.password = btoa(password);
    }
    
    const { error: userError } = await supabaseClient
        .from('users')
        .update(updateUserData)
        .eq('id', userId);
    
    if (userError) {
        showToast('更新用戶信息失敗: ' + userError.message, 'error');
        return;
    }
    
    // 2. 檢查是否有現有訂閱
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
    
    let subscriptionError;
    
    if (existingSubscription) {
        // 更新現有訂閱
        const { error } = await supabaseClient
            .from('subscriptions')
            .update(subscriptionData)
            .eq('id', existingSubscription.id);
        subscriptionError = error;
    } else if (subscriptionStatus === 'active') {
        // 創建新訂閱
        const { error } = await supabaseClient
            .from('subscriptions')
            .insert({
                user_id: userId,
                ...subscriptionData,
                created_at: new Date()
            });
        subscriptionError = error;
    }
    
    if (subscriptionError) {
        showToast('更新訂閱信息失敗: ' + subscriptionError.message, 'error');
        return;
    }
    
    // 3. 更新配送記錄中的已送達數量（如果需要重新生成配送）
    const shouldRegenerateDeliveries = existingSubscription && existingSubscription.plan_type !== planType;
    
    if (shouldRegenerateDeliveries) {
        // 刪除舊配送記錄
        await supabaseClient
            .from('deliveries')
            .delete()
            .eq('user_id', userId)
            .eq('subscription_id', existingSubscription.id);
        
        // 生成新配送記錄
        const deliveries = [];
        for (let i = 0; i < planDays; i++) {
            const deliveryDate = new Date(startDate);
            deliveryDate.setDate(deliveryDate.getDate() + i);
            deliveries.push({
                user_id: userId,
                subscription_id: existingSubscription.id,
                delivery_date: deliveryDate.toISOString().split('T')[0],
                status: i < mealsReceived ? 'delivered' : (i === mealsReceived ? 'pending' : 'upcoming'),
                meal_number: i + 1
            });
        }
        
        if (deliveries.length > 0) {
            await supabaseClient.from('deliveries').insert(deliveries);
        }
    } else if (existingSubscription) {
        // 只更新已送達狀態
        const { data: deliveries } = await supabaseClient
            .from('deliveries')
            .select('*')
            .eq('user_id', userId)
            .eq('subscription_id', existingSubscription.id)
            .order('delivery_date', { ascending: true });
        
        if (deliveries && deliveries.length > 0) {
            for (let i = 0; i < deliveries.length; i++) {
                const newStatus = i < mealsReceived ? 'delivered' : (i === mealsReceived ? 'pending' : 'upcoming');
                if (deliveries[i].status !== newStatus) {
                    await supabaseClient
                        .from('deliveries')
                        .update({ status: newStatus })
                        .eq('id', deliveries[i].id);
                }
            }
        }
    }
    
    // 4. 更新 localStorage 中的用戶信息（如果當前編輯的是登入用戶）
    const currentUser = getCurrentUserFromLocal();
    if (currentUser && currentUser.id === userId) {
        const updatedUser = {
            ...currentUser,
            email: email || null,
            phone: phone || null,
            address: address || null
        };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }
    
    showToast('用戶信息已更新！');
    document.querySelector('.modal-overlay')?.remove();
    loadUsersPage(); // 刷新頁面
}

// 從 localStorage 獲取當前用戶
function getCurrentUserFromLocal() {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
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
                <div><strong>方案：</strong> ${PLAN_CONFIG[subscription.plan_type]?.name || subscription.plan_type}</div>
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
            <div style="margin-top: 20px;">
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">關閉</button>
            </div>
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
        showToast('用戶沒有活躍訂閱，請先創建訂閱', 'error');
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
    
    const { error: uploadError } = await supabaseClient.storage
        .from('receipts')
        .upload(fileName, file);
    
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
    if (document.getElementById('page_receipts')?.classList.contains('active')) {
        loadReceiptsPage();
    }
}

function closeReceiptModal() {
    document.getElementById('receiptModal').style.display = 'none';
}

// 導出用戶數據
async function exportUsersData() {
    const { data: users } = await supabaseClient.from('users').select('*').not('email', 'eq', ADMIN_EMAIL);
    const csv = [
        ['姓名', '郵箱', '電話', '地址', '付款方式', '註冊時間'],
        ...users.map(u => [u.full_name, u.email, u.phone, u.address, u.payment_method, u.created_at])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('導出成功');
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}