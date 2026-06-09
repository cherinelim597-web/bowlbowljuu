// ============================================
// 管理員儀表板模組
// ============================================

// ADMIN_EMAIL 已在 admin-common.js 中定義

async function loadDashboard() {
    const container = document.getElementById('page_dashboard');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // 獲取所有用戶（排除管理員）
        const { data: allUsers } = await supabaseClient
            .from('users')
            .select('*')
            .not('email', 'eq', ADMIN_EMAIL);
        
        const totalUsers = allUsers?.length || 0;
        
        // 活躍訂閱
        const { data: subscriptions } = await supabaseClient
            .from('subscriptions')
            .select('*, users!inner(email)')
            .eq('status', 'active')
            .not('users.email', 'eq', ADMIN_EMAIL);
        
        const activeSubscriptions = subscriptions?.length || 0;
        
        // 總訂單數
        const { data: totalOrders } = await supabaseClient
            .from('subscriptions')
            .select('id')
            .not('users.email', 'eq', ADMIN_EMAIL);
        const totalOrdersCount = totalOrders?.length || 0;
        
        // 獲取未支付的訂閱（active 但未支付）
        const { data: unpaidSubscriptions } = await supabaseClient
            .from('subscriptions')
            .select('*, users!inner(full_name, email, phone)')
            .eq('status', 'active')
            .eq('payment_status', 'unpaid')
            .not('users.email', 'eq', ADMIN_EMAIL);
        
        const unpaidCount = unpaidSubscriptions?.length || 0;
        const unpaidTotalAmount = unpaidSubscriptions?.reduce((sum, s) => sum + (s.total_price || 0), 0) || 0;
        
        // 今日配送 - 使用馬來西亞時間
        const today = getTodayString();
        const { data: todayDeliveries } = await supabaseClient
            .from('deliveries')
            .select('*, users!inner(email)')
            .eq('delivery_date', today)
            .eq('status', 'pending')
            .not('users.email', 'eq', ADMIN_EMAIL);
        
        const todayPending = todayDeliveries?.length || 0;
        
        // 總營收
        const { data: receipts } = await supabaseClient
            .from('receipts')
            .select('amount, created_at, users!inner(email)')
            .not('users.email', 'eq', ADMIN_EMAIL);
        
        const totalRevenue = receipts?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
        
        // 本月營收
        const malaysiaNow = getMalaysiaDate();
        const thisMonth = malaysiaNow.getMonth();
        const thisYear = malaysiaNow.getFullYear();
        const monthlyRevenue = receipts?.filter(r => {
            const d = new Date(r.created_at);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        }).reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
        
        // 方案統計
        const planStats = { single: 0, weekly: 0, '1month': 0, '2months': 0, '3months': 0 };
        subscriptions?.forEach(s => {
            if (planStats[s.plan_type] !== undefined) planStats[s.plan_type]++;
        });
        
        // 最近7天配送統計 - 使用馬來西亞時間
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = getMalaysiaDate();
            d.setDate(d.getDate() - i);
            last7Days.push(formatMalaysiaDate(d));
        }
        
        const { data: dailyDeliveries } = await supabaseClient
            .from('deliveries')
            .select('delivery_date, users!inner(email)')
            .in('delivery_date', last7Days)
            .eq('status', 'delivered')
            .not('users.email', 'eq', ADMIN_EMAIL);
        
        const deliveryCounts = last7Days.map(date => 
            dailyDeliveries?.filter(d => d.delivery_date === date).length || 0
        );
        
        container.innerHTML = `
            <div class="stats-grid">
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
                    <div class="stat-icon"><i class="fas fa-ticket-alt"></i></div>
                    <div class="stat-value">${totalOrdersCount}</div>
                    <div class="stat-label">總訂單數</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
                    <div class="stat-value">RM ${totalRevenue.toLocaleString()}</div>
                    <div class="stat-label">總營收</div>
                </div>
            </div>
            
            <div class="stats-grid" style="margin-bottom: 28px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-value">RM ${monthlyRevenue.toLocaleString()}</div>
                    <div class="stat-label">本月營收</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-receipt"></i></div>
                    <div class="stat-value">${receipts?.length || 0}</div>
                    <div class="stat-label">總收據數</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-utensils"></i></div>
                    <div class="stat-value">${subscriptions?.reduce((sum, s) => sum + (s.total_days || 0), 0) || 0}</div>
                    <div class="stat-label">總餐數</div>
                </div>
                <div class="stat-card" style="cursor: pointer;" onclick="showUnpaidModal()">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-value">${unpaidCount}</div>
                    <div class="stat-label">未支付訂單</div>
                    <div style="font-size: 12px; color: #ffb84d; margin-top: 4px;">RM ${unpaidTotalAmount.toLocaleString()}</div>
                </div>
            </div>
            
            <div class="chart-row">
                <div class="chart-card">
                    <h3>📊 方案分佈</h3>
                    <div id="planChart" class="chart-container"></div>
                </div>
                <div class="chart-card">
                    <h3>📈 近7日配送量</h3>
                    <div id="deliveryChart" class="chart-container"></div>
                </div>
            </div>
            
            <div class="table-container">
                <h3 style="margin-bottom: 16px;">🆕 最近註冊用戶</h3>
                <div style="overflow-x: auto;">
                    <table style="width: 100%;">
                        <thead>
                            <tr><th>姓名</th><th>郵箱</th><th>電話</th><th>註冊時間</th><th>狀態</th></tr>
                        </thead>
                        <tbody id="recentUsersList"></tbody>
                    </table>
                </div>
            </div>
        `;
        
        // 方案圖表
        const planChart = echarts.init(document.getElementById('planChart'));
        planChart.setOption({
            tooltip: { trigger: 'item', backgroundColor: '#1a2a3a' },
            legend: { textStyle: { color: '#eef5ff' }, bottom: 0 },
            series: [{
                type: 'pie',
                radius: '55%',
                data: [
                    { name: '單次', value: planStats.single },
                    { name: '週方案', value: planStats.weekly },
                    { name: '1個月', value: planStats['1month'] },
                    { name: '2個月', value: planStats['2months'] },
                    { name: '3個月', value: planStats['3months'] }
                ],
                itemStyle: { borderRadius: 8, borderColor: '#030712' },
                label: { color: '#eef5ff' }
            }]
        });
        
        // 配送圖表
        const deliveryChart = echarts.init(document.getElementById('deliveryChart'));
        deliveryChart.setOption({
            tooltip: { trigger: 'axis', backgroundColor: '#1a2a3a' },
            xAxis: { type: 'category', data: last7Days.map(d => d.slice(5)), axisLabel: { color: '#8a9abb' } },
            yAxis: { type: 'value', axisLabel: { color: '#8a9abb' } },
            series: [{ type: 'bar', data: deliveryCounts, itemStyle: { color: '#4a7cff', borderRadius: [4,4,0,0] } }]
        });
        
        // 最近用戶
        const recentUsers = allUsers?.slice(0, 5) || [];
        const tbody = document.getElementById('recentUsersList');
        if (recentUsers.length > 0) {
            tbody.innerHTML = recentUsers.map(u => `
                <tr>
                    <td>${escapeHtml(u.full_name || 'N/A')}</td>
                    <td>${escapeHtml(u.email)}</td
                    <td>${escapeHtml(u.phone || 'N/A')}</td
                    <td>${formatDisplayDate(u.created_at)}</td
                    <td><span class="badge badge-active">正常</span></td
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5">暫無用戶<\/td><\/tr>';
        }
        
    } catch (err) {
        console.error('Dashboard error:', err);
        container.innerHTML = '<p>加載失敗</p>';
    }
}

// 顯示未支付訂單明細彈窗
async function showUnpaidModal() {
    const { data: unpaidSubscriptions } = await supabaseClient
        .from('subscriptions')
        .select('*, users!inner(full_name, email, phone, address)')
        .eq('status', 'active')
        .eq('payment_status', 'unpaid')
        .not('users.email', 'eq', ADMIN_EMAIL)
        .order('created_at', { ascending: false });
    
    const planNames = { single: '單次', weekly: '週方案', '1month': '1個月', '2months': '2個月', '3months': '3個月' };
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 900px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <h3><i class="fas fa-clock"></i> 未支付訂單 (共 ${unpaidSubscriptions?.length || 0} 筆)</h3>
            <div style="margin-top: 20px; overflow-x: auto;">
                <table style="width: 100%; min-width: 600px;">
                    <thead>
                        <tr style="background: rgba(200,161,94,0.1);">
                            <th style="padding: 10px;">訂單號</th>
                            <th style="padding: 10px;">用戶</th>
                            <th style="padding: 10px;">方案</th>
                            <th style="padding: 10px;">金額</th>
                            <th style="padding: 10px;">訂閱期間</th>
                            <th style="padding: 10px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${unpaidSubscriptions?.map(sub => `
                            <tr style="border-bottom: 1px solid #1e2a3a;">
                                <td style="padding: 12px 8px;">
                                    <span class="order-no-badge">${escapeHtml(sub.order_no || '無')}</span>
                                 </td>
                                <td style="padding: 12px 8px;">
                                    <strong>${escapeHtml(sub.users?.full_name || 'N/A')}</strong><br>
                                    <small>📧 ${escapeHtml(sub.users?.email || 'N/A')}</small><br>
                                    <small>📱 ${escapeHtml(sub.users?.phone || 'N/A')}</small>
                                 </td>
                                <td style="padding: 12px 8px;">${planNames[sub.plan_type] || sub.plan_type}</td>
                                <td style="padding: 12px 8px; color: #c8a15e;">RM ${sub.total_price}</td>
                                <td style="padding: 12px 8px; font-size: 12px;">
                                    ${formatDisplayDate(sub.start_date)}<br>
                                    → ${formatDisplayDate(sub.end_date)}
                                 </td>
                                <td style="padding: 12px 8px;">
                                    <button class="btn-small" onclick="markAsPaid('${sub.id}', '${sub.user_id}')" style="background: #2ed15a;">
                                        ✓ 標記已支付
                                    </button>
                                 </td>
                             </tr>
                        `).join('')}
                    </tbody>
                 </table>
            </div>
            <div style="margin-top: 20px;">
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">關閉</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// 標記訂單為已支付
async function markAsPaid(subscriptionId, userId) {
    if (!confirm('確定將此訂單標記為已支付？')) return;
    
    const { error } = await supabaseClient
        .from('subscriptions')
        .update({ payment_status: 'paid' })
        .eq('id', subscriptionId);
    
    if (error) {
        showToast('操作失敗: ' + error.message, 'error');
    } else {
        showToast('已標記為已支付！');
        document.querySelector('.modal-overlay')?.remove();
        loadDashboard();
        if (document.getElementById('page_users')?.classList.contains('active')) {
            if (typeof loadUsersPage === 'function') loadUsersPage();
        }
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}