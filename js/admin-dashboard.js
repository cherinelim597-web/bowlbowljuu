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
        
        // 今日配送
        const today = new Date().toISOString().split('T')[0];
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
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        const monthlyRevenue = receipts?.filter(r => {
            const d = new Date(r.created_at);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        }).reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
        
        // 方案統計
        const planStats = { single: 0, weekly: 0, '1month': 0, '2months': 0, '3months': 0 };
        subscriptions?.forEach(s => {
            if (planStats[s.plan_type] !== undefined) planStats[s.plan_type]++;
        });
        
        // 最近7天配送統計
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days.push(d.toISOString().split('T')[0]);
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
                    <div class="stat-icon"><i class="fas fa-truck"></i></div>
                    <div class="stat-value">${todayPending}</div>
                    <div class="stat-label">今日待配送</div>
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
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-chart-pie"></i></div>
                    <div class="stat-value">${Object.keys(planStats).filter(k => planStats[k] > 0).length}</div>
                    <div class="stat-label">方案類型</div>
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
                    <td>${escapeHtml(u.email)}</td>
                    <td>${escapeHtml(u.phone || 'N/A')}</td>
                    <td>${formatDate(u.created_at)}</td>
                    <td><span class="badge badge-active">正常</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5">暫無用戶</td></tr>';
        }
        
    } catch (err) {
        console.error('Dashboard error:', err);
        container.innerHTML = '<p>加載失敗</p>';
    }
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