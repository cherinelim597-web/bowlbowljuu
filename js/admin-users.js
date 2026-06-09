// ============================================
// 用戶管理模組 - 包含自動計算週期
// ============================================

// ADMIN_EMAIL 已在 admin-common.js 中定義

// 方案天數對照表
const PLAN_DAYS = {
    'single': 1,
    'weekly': 7,
    '1month': 30,
    '2months': 60,
    '3months': 90
};

// 方案名稱對照表
const PLAN_NAMES = {
    'single': '單次',
    'weekly': '週方案',
    '1month': '1個月',
    '2months': '2個月',
    '3months': '3個月'
};

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
                        📧 ${escapeHtml(user.email)}<br>
                        📱 ${escapeHtml(user.phone || 'N/A')}<br>
                        📍 ${escapeHtml(user.address || 'N/A')}
                    </td>
                    <td>
                        ${sub ? `<span class="badge badge-active">${PLAN_NAMES[sub.plan_type]}</span><br>
                        <small>💰 RM ${sub.total_price}</small>` : '<span class="badge badge-expired">無訂閱</span>'}
                    </td>
                    <td>
                        ${sub ? `
                            <small>📅 開始: ${startDate}</small><br>
                            <small>📅 結束: ${endDate}</small><br>
                            <button class="btn-small" style="margin-top: 8px; background: #4a7cff;" onclick="editSubscriptionPeriod('${user.id}', '${sub.id}', '${sub.plan_type}')">
                                <i class="fas fa-calendar-alt"></i> 調整週期
                            </button>
                        ` : '—'}
                    </td>
                    <td>
                        ${sub ? `
                            <div style="width: 100px; background: #1e2a3a; border-radius: 10px; height: 6px;">
                                <div style="width: ${progressPercent}%; background: #c8a15e; border-radius: 10px; height: 6px;"></div>
                            </div>
                            <small>${user.deliveredCount} / ${sub.total_days} 餐</small><br>
                            <small>📦 剩餘 ${sub.total_days - user.deliveredCount} 天</small>
                        ` : '—'}
                    </td>
                    <td>RM ${user.totalPaid.toLocaleString()}<br><small>💰 總消費</small></td>
                    <td>
                        <button class="btn-icon" onclick="editUser('${user.id}')" title="編輯"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" onclick="uploadReceiptForUser('${user.id}')" title="上傳收據"><i class="fas fa-receipt"></i></button>
                        <button class="btn-icon" onclick="viewUserDetail('${user.id}')" title="查看詳情"><i class="fas fa-eye"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Users page error:', err);
        container.innerHTML = '<div class="table-container"><p>加載失敗</p></div>';
    }
}

// 編輯訂閱週期（自動計算結束日期）
async function editSubscriptionPeriod(userId, subscriptionId, planType) {
    // 獲取當前訂閱信息
    const { data: subscription, error } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();
    
    if (error) {
        showToast('獲取訂閱信息失敗', 'error');
        return;
    }
    
    const startDate = new Date(subscription.start_date).toISOString().split('T')[0];
    const endDate = new Date(subscription.end_date).toISOString().split('T')[0];
    const planDays = PLAN_DAYS[planType] || 30;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-card" style="width: 500px;">
            <h3><i class="fas fa-calendar-alt"></i> 調整訂閱週期</h3>
            <div class="input-group" style="margin-top: 20px;">
                <label>用戶名稱</label>
                <input type="text" value="${escapeHtml(subscription.user_id)}" disabled style="opacity:0.7;">
            </div>
            <div class="input-group">
                <label>當前方案</label>
                <input type="text" value="${PLAN_NAMES[planType]} (${planDays}天)" disabled style="opacity:0.7;">
            </div>
            <div class="input-group">
                <label>開始日期</label>
                <input type="date" id="editStartDate" value="${startDate}">
                <small style="color:#8a9abb;">修改後將自動計算結束日期</small>
            </div>
            <div class="input-group">
                <label>結束日期（自動計算）</label>
                <input type="date" id="editEndDate" value="${endDate}" readonly style="background: rgba(0,0,0,0.3);">
            </div>
            <div class="input-group">
                <label>方案天數</label>
                <input type="number" id="planDays" value="${planDays}" readonly style="background: rgba(0,0,0,0.3);">
            </div>
            <div class="input-group">
                <label>調整說明</label>
                <textarea id="editReason" placeholder="請填寫調整原因（如：用戶要求延期、暫停等）" style="width:100%; padding:12px; background:#0f172a; border:1px solid #1e2a3a; border-radius:12px; color:#fff; resize:vertical;"></textarea>
            </div>
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-save" onclick="saveSubscriptionPeriod('${subscriptionId}', '${userId}')">保存修改</button>
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 綁定開始日期變化事件，自動計算結束日期
    const startDateInput = document.getElementById('editStartDate');
    const endDateInput = document.getElementById('editEndDate');
    const planDaysInput = document.getElementById('planDays');
    
    function calculateEndDate() {
        const startDateValue = startDateInput.value;
        const days = parseInt(planDaysInput.value);
        
        if (startDateValue && days) {
            const start = new Date(startDateValue);
            const end = new Date(start);
            end.setDate(end.getDate() + days - 1); // 減1因為開始當天算第一天
            const endDateStr = end.toISOString().split('T')[0];
            endDateInput.value = endDateStr;
        }
    }
    
    startDateInput.addEventListener('change', calculateEndDate);
    calculateEndDate(); // 初始化計算
}

// 保存訂閱週期修改
async function saveSubscriptionPeriod(subscriptionId, userId) {
    const newStartDate = document.getElementById('editStartDate').value;
    const newEndDate = document.getElementById('editEndDate').value;
    const reason = document.getElementById('editReason').value;
    const planDays = parseInt(document.getElementById('planDays').value);
    
    if (!newStartDate || !newEndDate) {
        showToast('請填寫開始日期', 'error');
        return;
    }
    
    const start = new Date(newStartDate);
    const end = new Date(newEndDate);
    
    if (end <= start) {
        showToast('結束日期必須晚於開始日期', 'error');
        return;
    }
    
    // 確認對話框
    const confirmMsg = `確認修改訂閱週期？\n\n開始日期: ${newStartDate}\n結束日期: ${newEndDate}\n總天數: ${planDays}天\n調整原因: ${reason || '未填寫'}`;
    if (!confirm(confirmMsg)) return;
    
    // 更新訂閱
    const { error: updateError } = await supabaseClient
        .from('subscriptions')
        .update({
            start_date: newStartDate,
            end_date: newEndDate,
            total_days: planDays
        })
        .eq('id', subscriptionId);
    
    if (updateError) {
        showToast('更新失敗: ' + updateError.message, 'error');
        return;
    }
    
    // 同時更新配送日程（可選：重新生成配送日期）
    const shouldUpdateDeliveries = confirm('是否同時更新配送日程？這將重新生成從新開始日期到結束日期的所有配送記錄。');
    
    if (shouldUpdateDeliveries) {
        // 刪除舊的配送記錄
        await supabaseClient
            .from('deliveries')
            .delete()
            .eq('subscription_id', subscriptionId);
        
        // 生成新的配送記錄
        const deliveries = [];
        for (let i = 0; i < planDays; i++) {
            const deliveryDate = new Date(newStartDate);
            deliveryDate.setDate(deliveryDate.getDate() + i);
            deliveries.push({
                user_id: userId,
                subscription_id: subscriptionId,
                delivery_date: deliveryDate.toISOString().split('T')[0],
                status: i === 0 ? 'pending' : 'upcoming',
                meal_number: i + 1
            });
        }
        
        const { error: deliveryError } = await supabaseClient
            .from('deliveries')
            .insert(deliveries);
        
        if (deliveryError) {
            showToast('配送日程更新失敗: ' + deliveryError.message, 'error');
        } else {
            showToast('配送日程已更新！');
        }
    }
    
    // 關閉彈窗
    document.querySelector('.modal-overlay')?.remove();
    
    showToast('訂閱週期已更新！');
    loadUsersPage(); // 刷新頁面
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
            <h3><i class="fas fa-user"></i> 用戶詳情</h3>
            <hr style="margin: 15px 0; border-color: #1e2a3a;">
            <div><strong>姓名：</strong> ${escapeHtml(user.full_name)}</div>
            <div><strong>郵箱：</strong> ${escapeHtml(user.email)}</div>
            <div><strong>電話：</strong> ${escapeHtml(user.phone || 'N/A')}</div>
            <div><strong>地址：</strong> ${escapeHtml(user.address || 'N/A')}</div>
            <div><strong>註冊時間：</strong> ${formatDate(user.created_at)}</div>
            <hr style="margin: 15px 0; border-color: #1e2a3a;">
            <h4>📋 訂閱信息</h4>
            ${subscription ? `
                <div><strong>方案：</strong> ${PLAN_NAMES[subscription.plan_type]}</div>
                <div><strong>期間：</strong> ${formatDate(subscription.start_date)} - ${formatDate(subscription.end_date)}</div>
                <div><strong>總餐數：</strong> ${subscription.total_days} 餐</div>
                <div><strong>已送達：</strong> ${deliveredCount} 餐</div>
                <div><strong>金額：</strong> RM ${subscription.total_price}</div>
            ` : '<p>無活躍訂閱</p>'}
            <hr style="margin: 15px 0; border-color: #1e2a3a;">
            <h4>💰 消費記錄</h4>
            <div><strong>總消費：</strong> RM ${totalPaid}</div>
            <div><strong>收據數量：</strong> ${receipts?.length || 0} 張</div>
            <hr style="margin: 15px 0; border-color: #1e2a3a;">
            <h4>📦 最近配送</h4>
            ${deliveries?.slice(0, 7).map(d => `
                <div>${formatDate(d.delivery_date)} - 餐點 #${d.meal_number} - ${d.status === 'delivered' ? '✅ 已送達' : '⏳ 待配送'}</div>
            `).join('') || '<p>暫無配送記錄</p>'}
            <div style="margin-top: 20px;">
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">關閉</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function editUser(userId) {
    const { data: user } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (!user) return;
    
    document.getElementById('editUserId').value = userId;
    document.getElementById('editFullName').value = user.full_name || '';
    document.getElementById('editPhone').value = user.phone || '';
    document.getElementById('editAddress').value = user.address || '';
    document.getElementById('userModal').style.display = 'flex';
}

async function saveUserEdit() {
    const userId = document.getElementById('editUserId').value;
    const fullName = document.getElementById('editFullName').value;
    const phone = document.getElementById('editPhone').value;
    const address = document.getElementById('editAddress').value;
    
    const { error } = await supabaseClient
        .from('users')
        .update({ full_name: fullName, phone, address })
        .eq('id', userId);
    
    if (error) {
        showToast('Update failed: ' + error.message, 'error');
    } else {
        showToast('User updated successfully');
        closeUserModal();
        loadUsersPage();
    }
}

function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

function closeReceiptModal() {
    document.getElementById('receiptModal').style.display = 'none';
}

async function uploadReceiptForUser(userId) {
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    
    if (!subscription) {
        showToast('User has no active subscription', 'error');
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
        showToast('Please select a file', 'error');
        return;
    }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_receipt_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabaseClient.storage
        .from('receipts')
        .upload(fileName, file);
    
    if (uploadError) {
        showToast('Upload failed: ' + uploadError.message, 'error');
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
    
    showToast(`Receipt uploaded! Amount: RM ${amount}`);
    closeReceiptModal();
    if (document.getElementById('page_receipts')?.classList.contains('active')) {
        loadReceiptsPage();
    }
}

async function exportUsersData() {
    const { data: users } = await supabaseClient.from('users').select('*').not('email', 'eq', ADMIN_EMAIL);
    const csv = [
        ['姓名', '郵箱', '電話', '地址', '註冊時間'],
        ...users.map(u => [u.full_name, u.email, u.phone, u.address, u.created_at])
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