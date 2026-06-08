// ============================================
// 儀表板模組
// ============================================

async function loadDashboard() {
    const container = document.getElementById('page_dashboard');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // 獲取統計數據
        const { data: users } = await supabaseClient.from('users').select('id');
        const { data: subscriptions } = await supabaseClient.from('subscriptions').select('*').eq('status', 'active');
        const { data: deliveries } = await supabaseClient.from('deliveries').select('*').eq('status', 'pending');
        
        const today = new Date().toISOString().split('T')[0];
        const { data: todayDeliveries } = await supabaseClient
            .from('deliveries')
            .select('*')
            .eq('delivery_date', today)
            .eq('status', 'pending');
        
        // 計算總營收
        const { data: receipts } = await supabaseClient.from('receipts').select('amount');
        const totalRevenue = receipts?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-users"></i></div>
                    <div class="stat-value">${users?.length || 0}</div>
                    <div class="stat-label">Total Users</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-calendar-check"></i></div>
                    <div class="stat-value">${subscriptions?.length || 0}</div>
                    <div class="stat-label">Active Subscriptions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-truck"></i></div>
                    <div class="stat-value">${todayDeliveries?.length || 0}</div>
                    <div class="stat-label">Today's Deliveries</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
                    <div class="stat-value">NT$${totalRevenue.toLocaleString()}</div>
                    <div class="stat-label">Total Revenue</div>
                </div>
            </div>
            
            <div class="chart-row">
                <div class="chart-card">
                    <h3>Subscription Plans</h3>
                    <div id="planChart" class="chart-container"></div>
                </div>
                <div class="chart-card">
                    <h3>Daily Deliveries (Last 7 Days)</h3>
                    <div id="deliveryChart" class="chart-container"></div>
                </div>
            </div>
            
            <div class="table-container">
                <h3 style="margin-bottom: 16px;">Recent Users</h3>
                <table>
                    <thead>
                        <tr><th>Name</th><th>Email</th><th>Plan</th><th>Status</th><th>Joined</th></tr>
                    </thead>
                    <tbody id="recentUsersList"></tbody>
                </table>
            </div>
        `;
        
        // 載入方案統計圖表
        const planCounts = { single: 0, weekly: 0, '1month': 0, '2months': 0, '3months': 0 };
        subscriptions?.forEach(s => { planCounts[s.plan_type] = (planCounts[s.plan_type] || 0) + 1; });
        
        const planChart = echarts.init(document.getElementById('planChart'));
        planChart.setOption({
            tooltip: { trigger: 'item', backgroundColor: '#1a2a3a' },
            legend: { textStyle: { color: '#eef5ff' } },
            series: [{
                type: 'pie',
                radius: '55%',
                data: Object.entries(planCounts).map(([k, v]) => ({ name: k, value: v })),
                itemStyle: { borderRadius: 8, borderColor: '#030712' },
                label: { color: '#eef5ff' }
            }]
        });
        
        // 載入最近 7 天配送
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days.push(d.toISOString().split('T')[0]);
        }
        
        const { data: dailyDeliveries } = await supabaseClient
            .from('deliveries')
            .select('delivery_date')
            .in('delivery_date', last7Days)
            .eq('status', 'delivered');
        
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
        
        // 載入最近用戶
        const { data: recentUsers } = await supabaseClient
            .from('users')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
        
        const tbody = document.getElementById('recentUsersList');
        if (recentUsers?.length) {
            tbody.innerHTML = recentUsers.map(u => `
                <tr>
                    <td>${u.full_name || 'N/A'}</td>
                    <td>${u.email}</td>
                    <td>—</td>
                    <td><span class="badge badge-active">Active</span></td>
                    <td>${formatDate(u.created_at)}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5">No users yet</td></tr>';
        }
        
    } catch (err) {
        console.error('Dashboard error:', err);
        container.innerHTML = '<p>Error loading dashboard</p>';
    }
}