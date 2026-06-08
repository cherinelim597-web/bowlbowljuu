// ============================================
// 管理員儀表板模組 - 不顯示管理員，使用 RM
// ============================================

const ADMIN_EMAIL_DASHBOARD = "admin@cherinebowl.com";

async function loadDashboard() {
    const container = document.getElementById('page_dashboard');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // 獲取統計數據 - 排除管理員
        const { data: allUsers } = await supabaseClient
            .from('users')
            .select('id')
            .not('email', 'eq', ADMIN_EMAIL_DASHBOARD);
        
        const totalUsers = allUsers?.length || 0;
        
        const { data: subscriptions } = await supabaseClient
            .from('subscriptions')
            .select('*, users!inner(email)')
            .eq('status', 'active')
            .not('users.email', 'eq', ADMIN_EMAIL_DASHBOARD);
        
        const activeSubscriptions = subscriptions?.length || 0;
        
        const today = new Date().toISOString().split('T')[0];
        const { data: todayDeliveries } = await supabaseClient
            .from('deliveries')
            .select('*, users!inner(email)')
            .eq('delivery_date', today)
            .eq('status', 'pending')
            .not('users.email', 'eq', ADMIN_EMAIL_DASHBOARD);
        
        const todayPending = todayDeliveries?.length || 0;
        
        // 計算總營收（只計算非管理員用戶）
        const { data: receipts } = await supabaseClient
            .from('receipts')
            .select('amount, users!inner(email)')
            .not('users.email', 'eq', ADMIN_EMAIL_DASHBOARD);
        
        const totalRevenue = receipts?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-users"></i></div>
                    <div class="stat-value">${totalUsers}</div>
                    <div class="stat-label">Total Users</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-calendar-check"></i></div>
                    <div class="stat-value">${activeSubscriptions}</div>
                    <div class="stat-label">Active Subscriptions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-truck"></i></div>
                    <div class="stat-value">${todayPending}</div>
                    <div class="stat-label">Today's Deliveries</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
                    <div class="stat-value">RM ${totalRevenue.toLocaleString()}</div>
                    <div class="stat-label">Total Revenue</div>
                </div>
            </div>
            
            <div class="chart-row">
                <div class="chart-card">
                    <h3>Subscription Plans Distribution</h3>
                    <div id="planChart" class="chart-container"></div>
                </div>
                <div class="chart-card">
                    <h3>Daily Deliveries (Last 7 Days)</h3>
                    <div id="deliveryChart" class="chart-container"></div>
                </div>
            </div>
            
            <div class="table-container">
                <h3 style="margin-bottom: 16px;">Recent Users</h3>
                <div style="overflow-x: auto;">
                    <table style="width: 100%;">
                        <thead>
                            <tr><th>Name</th><th>Email</th><th>Plan</th><th>Status</th><th>Joined</th></tr>
                        </thead>
                        <tbody id="recentUsersList"></tbody>
                    </table>
                </div>
            </div>
        `;
        
        // 方案統計圖表 - 排除管理員
        const planCounts = { single: 0, weekly: 0, '1month': 0, '2months': 0, '3months': 0 };
        subscriptions?.forEach(s => {
            if (planCounts[s.plan_type] !== undefined) planCounts[s.plan_type]++;
        });
        
        const planChart = echarts.init(document.getElementById('planChart'));
        planChart.setOption({
            tooltip: { trigger: 'item', backgroundColor: '#1a2a3a' },
            legend: { textStyle: { color: '#eef5ff' }, bottom: 0 },
            series: [{
                type: 'pie',
                radius: '55%',
                data: Object.entries(planCounts).map(([k, v]) => ({ name: k, value: v })),
                itemStyle: { borderRadius: 8, borderColor: '#030712' },
                label: { color: '#eef5ff' }
            }]
        });
        
        // 最近 7 天配送統計 - 排除管理員
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
            .not('users.email', 'eq', ADMIN_EMAIL_DASHBOARD);
        
        const deliveryCounts = last7Days.map(date => 
            dailyDeliveries?.filter(d => d.delivery_date === date).length || 0
        );
        
        const deliveryChart = echarts.init(document.getElementById('deliveryChart'));
        deliveryChart.setOption({
            tooltip: { trigger: 'axis', backgroundColor: '#1a2a3a' },
            xAxis: { type: 'category', data: last7Days.map(d => d.slice(5)), axisLabel: { color: '#8a9abb' } },
            yAxis: { type: 'value', axisLabel: { color: '#8a9abb' } },
            series: [{ type: 'bar', data: deliveryCounts, itemStyle: { color: '#4a7cff', borderRadius: [4,4,0,0] } }]
        });
        
        // 最近用戶 - 排除管理員
        const { data: recentUsers } = await supabaseClient
            .from('users')
            .select('*')
            .not('email', 'eq', ADMIN_EMAIL_DASHBOARD)
            .order('created_at', { ascending: false })
            .limit(5);
        
        const tbody = document.getElementById('recentUsersList');
        if (recentUsers?.length) {
            tbody.innerHTML = recentUsers.map(u => {
                const userSub = subscriptions?.find(s => s.user_id === u.id);
                const planName = userSub ? { single: 'Single', weekly: 'Weekly', '1month': '1M', '2months': '2M', '3months': '3M' }[userSub.plan_type] : '—';
                return `
                    <tr>
                        <td>${escapeHtml(u.full_name || 'N/A')}</td>
                        <td>${escapeHtml(u.email)}</td>
                        <td>${planName}</td>
                        <td><span class="badge ${userSub ? 'badge-active' : 'badge-expired'}">${userSub ? 'Active' : 'Inactive'}</span></td>
                        <td>${formatDate(u.created_at)}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5">No users yet</tr>';
        }
        
    } catch (err) {
        console.error('Dashboard error:', err);
        container.innerHTML = '<p>Error loading dashboard</p>';
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