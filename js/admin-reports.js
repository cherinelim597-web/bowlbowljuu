// ============================================
// 報表統計模組
// ============================================

// ADMIN_EMAIL 已在 admin-common.js 中定義

async function loadReportsPage() {
    const container = document.getElementById('page_reports');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // 獲取所有數據
        const { data: users } = await supabaseClient
            .from('users')
            .select('*')
            .not('email', 'eq', ADMIN_EMAIL);
        
        const { data: subscriptions } = await supabaseClient
            .from('subscriptions')
            .select('*, users!inner(email)')
            .not('users.email', 'eq', ADMIN_EMAIL);
        
        const { data: receipts } = await supabaseClient
            .from('receipts')
            .select('*, users!inner(email)')
            .not('users.email', 'eq', ADMIN_EMAIL);
        
        const { data: deliveries } = await supabaseClient
            .from('deliveries')
            .select('*, users!inner(email)')
            .not('users.email', 'eq', ADMIN_EMAIL);
        
        // 統計數據
        const totalUsers = users?.length || 0;
        const totalSubscriptions = subscriptions?.length || 0;
        const totalRevenue = receipts?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
        const totalDeliveries = deliveries?.length || 0;
        const completedDeliveries = deliveries?.filter(d => d.status === 'delivered').length || 0;
        
        // 按月統計營收
        const monthlyRevenue = {};
        receipts?.forEach(r => {
            const month = new Date(r.created_at).toLocaleDateString('en', { year: 'numeric', month: 'short' });
            monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (r.amount || 0);
        });
        
        // 方案統計
        const planStats = { single: 0, weekly: 0, '1month': 0, '2months': 0, '3months': 0 };
        subscriptions?.forEach(s => {
            if (planStats[s.plan_type] !== undefined) planStats[s.plan_type]++;
        });
        
        // 按日期統計配送
        const deliveryByDate = {};
        deliveries?.forEach(d => {
            const date = d.delivery_date;
            if (!deliveryByDate[date]) deliveryByDate[date] = { total: 0, completed: 0 };
            deliveryByDate[date].total++;
            if (d.status === 'delivered') deliveryByDate[date].completed++;
        });
        
        const sortedDates = Object.keys(deliveryByDate).sort().slice(-14);
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-users"></i></div>
                    <div class="stat-value">${totalUsers}</div>
                    <div class="stat-label">總用戶數</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-calendar-check"></i></div>
                    <div class="stat-value">${totalSubscriptions}</div>
                    <div class="stat-label">總訂閱數</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
                    <div class="stat-value">RM ${totalRevenue.toLocaleString()}</div>
                    <div class="stat-label">總營收</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-truck"></i></div>
                    <div class="stat-value">${totalDeliveries}</div>
                    <div class="stat-label">總配送次數</div>
                </div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-value">${completedDeliveries}</div>
                    <div class="stat-label">已完成配送</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-hourglass-half"></i></div>
                    <div class="stat-value">${totalDeliveries - completedDeliveries}</div>
                    <div class="stat-label">待配送</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-receipt"></i></div>
                    <div class="stat-value">${receipts?.length || 0}</div>
                    <div class="stat-label">收據數量</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-value">${((completedDeliveries / totalDeliveries) * 100 || 0).toFixed(1)}%</div>
                    <div class="stat-label">完成率</div>
                </div>
            </div>
            
            <div class="chart-row">
                <div class="chart-card">
                    <h3>📊 方案分佈</h3>
                    <div id="reportPlanChart" class="chart-container"></div>
                </div>
                <div class="chart-card">
                    <h3>💰 每月營收趨勢</h3>
                    <div id="revenueChart" class="chart-container"></div>
                </div>
            </div>
            
            <div class="chart-row">
                <div class="chart-card">
                    <h3>📦 近14日配送統計</h3>
                    <div id="deliveryStatsChart" class="chart-container"></div>
                </div>
                <div class="chart-card">
                    <h3>🏆 方案排行</h3>
                    <div id="planRankingChart" class="chart-container"></div>
                </div>
            </div>
            
            <div class="table-container">
                <h3 style="margin-bottom: 16px;">📋 詳細訂閱列表</h3>
                <div style="overflow-x: auto;">
                    <table style="width: 100%;">
                        <thead>
                            <tr><th>用戶</th><th>方案</th><th>開始日期</th><th>結束日期</th><th>進度</th><th>金額</th></tr>
                        </thead>
                        <tbody id="subscriptionsTableBody"></tbody>
                    </table>
                </div>
            </div>
        `;
        
        // 方案圖表
        const planChart = echarts.init(document.getElementById('reportPlanChart'));
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
        
        // 營收趨勢
        const revenueChart = echarts.init(document.getElementById('revenueChart'));
        revenueChart.setOption({
            tooltip: { trigger: 'axis', backgroundColor: '#1a2a3a' },
            xAxis: { type: 'category', data: Object.keys(monthlyRevenue), axisLabel: { color: '#8a9abb', rotate: 30 } },
            yAxis: { type: 'value', name: 'RM', axisLabel: { color: '#8a9abb' } },
            series: [{ type: 'line', data: Object.values(monthlyRevenue), itemStyle: { color: '#c8a15e' }, smooth: true, areaStyle: { opacity: 0.3 } }]
        });
        
        // 配送統計圖表
        const deliveryChart = echarts.init(document.getElementById('deliveryStatsChart'));
        deliveryChart.setOption({
            tooltip: { trigger: 'axis', backgroundColor: '#1a2a3a' },
            xAxis: { type: 'category', data: sortedDates, axisLabel: { color: '#8a9abb', rotate: 30 } },
            yAxis: { type: 'value', axisLabel: { color: '#8a9abb' } },
            series: [
                { name: '總配送', type: 'bar', data: sortedDates.map(d => deliveryByDate[d]?.total || 0), itemStyle: { color: '#4a7cff' } },
                { name: '已完成', type: 'bar', data: sortedDates.map(d => deliveryByDate[d]?.completed || 0), itemStyle: { color: '#2ed15a' } }
            ]
        });
        
        // 方案排行
        const planRanking = [
            { name: '1個月', value: planStats['1month'] },
            { name: '3個月', value: planStats['3months'] },
            { name: '週方案', value: planStats.weekly },
            { name: '2個月', value: planStats['2months'] },
            { name: '單次', value: planStats.single }
        ].filter(p => p.value > 0).sort((a, b) => b.value - a.value);
        
        const rankingChart = echarts.init(document.getElementById('planRankingChart'));
        rankingChart.setOption({
            tooltip: { trigger: 'axis', backgroundColor: '#1a2a3a' },
            xAxis: { type: 'category', data: planRanking.map(p => p.name), axisLabel: { color: '#8a9abb', rotate: 30 } },
            yAxis: { type: 'value', axisLabel: { color: '#8a9abb' } },
            series: [{ type: 'bar', data: planRanking.map(p => p.value), itemStyle: { color: '#c8a15e', borderRadius: [4,4,0,0] } }]
        });
        
        // 訂閱列表
        const tbody = document.getElementById('subscriptionsTableBody');
        const planNames = { single: '單次', weekly: '週方案', '1month': '1個月', '2months': '2個月', '3months': '3個月' };
        
        if (subscriptions && subscriptions.length > 0) {
            tbody.innerHTML = subscriptions.slice(0, 20).map(s => {
                const progress = (s.meals_received / s.total_days) * 100;
                return `
                    <tr>
                        <td>${escapeHtml(s.users?.full_name || 'N/A')}</td>
                        <td>${planNames[s.plan_type]}</td>
                        <td>${formatDate(s.start_date)}</td>
                        <td>${formatDate(s.end_date)}</td>
                        <td>
                            <div style="width: 80px; background: #1e2a3a; border-radius: 10px; height: 6px;">
                                <div style="width: ${progress}%; background: #c8a15e; border-radius: 10px; height: 6px;"></div>
                            </div>
                            <small>${s.meals_received}/${s.total_days}</small>
                        </td>
                        <td>RM ${s.total_price}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6">暫無訂閱記錄</td></tr>';
        }
        
    } catch (err) {
        console.error('Reports page error:', err);
        container.innerHTML = '<div class="table-container"><p>加載失敗</p></div>';
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