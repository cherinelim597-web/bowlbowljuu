// ============================================
// 用戶管理模組
// ============================================

// ADMIN_EMAIL 已在 admin-common.js 中定義

async function loadUsersPage() {
    const container = document.getElementById('page_users');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // 獲取所有用戶（排除管理員）
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
            // 訂閱信息
            const { data: subscription } = await supabaseClient
                .from('subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .maybeSingle();
            
            // 配送統計
            const { data: deliveries } = await supabaseClient
                .from('deliveries')
                .select('status')
                .eq('user_id', user.id);
            
            const totalDeliveries = deliveries?.length || 0;
            const deliveredCount = deliveries?.filter(d => d.status === 'delivered').length || 0;
            
            // 收據統計
            const { data: receipts } = await supabaseClient
                .from('receipts')
                .select('amount')
                .eq('user_id', user.id);
            
            const totalPaid = receipts?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
            
            userData.push({
                ...user,
                subscription,
                totalDeliveries,
                deliveredCount,
                totalPaid
            });
        }
        
        const planNames = { single: '單次', weekly: '週方案', '1month': '1個月', '2months': '2個月', '3months': '3個月' };
        
        container.innerHTML = `
            <div class="table-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                    <h3>👥 用戶管理 (共 ${users.length} 人)</h3>
                    <button class="btn-small" onclick="exportUsersData()" style="background: #2d6a4f;"><i class="fas fa-download"></i> 導出數據</button>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; min-width: 800px;">
                        <thead>
                            <tr>
                                <th>用戶信息</th><th>聯繫方式</th><th>當前方案</th><th>配送進度</th><th>消費金額</th><th>操作</th>
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
                        ${sub ? `
                            <span class="badge badge-active">${planNames[sub.plan_type]}</span><br>
                            <small>${formatDate(sub.start_date)} - ${formatDate(sub.end_date)}</small><br>
                            <small>💰 RM ${sub.total_price}</small>
                        ` : '<span class="badge badge-expired">無訂閱</span>'}
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
                    <td>
                        RM ${user.totalPaid.toLocaleString()}<br>
                        <small>💰 總消費</small>
                    </td>
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
                <div><strong>方案：</strong> ${subscription.plan_type}</div>
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

// 導出用戶數據
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