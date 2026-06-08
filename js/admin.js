// ============================================
// 管理後台主邏輯
// ============================================

const ADMIN_EMAIL_MAIN = "admin@cherinebowl.com";
let currentPage = 'dashboard';

// 顯示頁面
async function showPage(page) {
    currentPage = page;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === page) {
            item.classList.add('active');
        }
    });
    
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    
    const targetPage = document.getElementById(`page_${page}`);
    if (targetPage) targetPage.classList.add('active');
    
    switch(page) {
        case 'dashboard':
            if (typeof loadDashboard === 'function') await loadDashboard();
            break;
        case 'users':
            if (typeof loadUsersPage === 'function') await loadUsersPage();
            break;
        case 'deliveries':
            if (typeof loadDeliveriesPage === 'function') await loadDeliveriesPage();
            break;
        case 'receipts':
            await loadReceiptsPage();
            break;
        case 'reports':
            await loadReportsPage();
            break;
    }
    
    const titles = { 
        dashboard: 'Dashboard', 
        users: 'User Management', 
        deliveries: 'Daily Delivery', 
        receipts: 'Receipts', 
        reports: 'Reports' 
    };
    document.getElementById('pageTitle').innerText = titles[page] || page;
}

// 收據頁面
async function loadReceiptsPage() {
    const container = document.getElementById('page_receipts');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const { data: receipts, error } = await supabaseClient
            .from('receipts')
            .select('*, users!inner(full_name, email)')
            .not('users.email', 'eq', ADMIN_EMAIL_MAIN)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error loading receipts:', error);
            container.innerHTML = '<div class="table-container"><p>Error loading receipts</p></div>';
            return;
        }
        
        if (!receipts || receipts.length === 0) {
            container.innerHTML = '<div class="table-container"><p>No receipts found</p></div>';
            return;
        }
        
        container.innerHTML = `
            <div class="table-container">
                <h3>All Receipts (${receipts.length})</h3>
                <div style="overflow-x: auto; margin-top: 16px;">
                    <table style="width: 100%;">
                        <thead>
                            <tr>
                                <th>User</th><th>Amount</th><th>Payment Method</th><th>Date</th><th>Receipt</th>
                            </tr>
                        </thead>
                        <tbody id="receiptsTableBody"></tbody>
                    </table>
                </div>
            </div>
        `;
        
        const tbody = document.getElementById('receiptsTableBody');
        tbody.innerHTML = receipts.map(r => `
            <tr>
                <td><strong>${escapeHtml(r.users?.full_name || 'N/A')}</strong><br><small>${escapeHtml(r.users?.email || '')}</small></td>
                <td>RM ${r.amount}</td>
                <td>${r.payment_method}</td>
                <td>${new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                    ${r.receipt_url ? `<button class="btn-icon" onclick="window.open('${r.receipt_url}', '_blank')"><i class="fas fa-eye"></i></button>` : '—'}
                </td>
            </tr>
        `).join('');
        
    } catch (err) {
        console.error('Receipts page error:', err);
        container.innerHTML = '<div class="table-container"><p>Error loading receipts</p></div>';
    }
}

// 報表頁面
async function loadReportsPage() {
    const container = document.getElementById('page_reports');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const { data: users } = await supabaseClient
            .from('users')
            .select('id, created_at')
            .not('email', 'eq', ADMIN_EMAIL_MAIN);
        
        const { data: subscriptions } = await supabaseClient
            .from('subscriptions')
            .select('*, users!inner(email)')
            .not('users.email', 'eq', ADMIN_EMAIL_MAIN);
        
        const { data: receipts } = await supabaseClient
            .from('receipts')
            .select('amount, created_at, users!inner(email)')
            .not('users.email', 'eq', ADMIN_EMAIL_MAIN);
        
        const totalRevenue = receipts?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
        
        const monthlyRevenue = {};
        receipts?.forEach(r => {
            const month = new Date(r.created_at).toLocaleDateString('en', { year: 'numeric', month: 'short' });
            monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (r.amount || 0);
        });
        
        const planStats = { single: 0, weekly: 0, '1month': 0, '2months': 0, '3months': 0 };
        subscriptions?.forEach(s => {
            if (planStats[s.plan_type] !== undefined) planStats[s.plan_type]++;
        });
        
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
                    <div class="stat-label">Total Subscriptions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-receipt"></i></div>
                    <div class="stat-value">${receipts?.length || 0}</div>
                    <div class="stat-label">Total Receipts</div>
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
                    <div id="reportPlanChart" class="chart-container"></div>
                </div>
                <div class="chart-card">
                    <h3>Monthly Revenue</h3>
                    <div id="revenueChart" class="chart-container"></div>
                </div>
            </div>
        `;
        
        const planChart = echarts.init(document.getElementById('reportPlanChart'));
        planChart.setOption({
            tooltip: { trigger: 'item', backgroundColor: '#1a2a3a' },
            legend: { textStyle: { color: '#eef5ff' }, bottom: 0 },
            series: [{
                type: 'pie',
                radius: '55%',
                data: Object.entries(planStats).map(([k, v]) => ({ name: k, value: v })),
                itemStyle: { borderRadius: 8, borderColor: '#030712' },
                label: { color: '#eef5ff' }
            }]
        });
        
        const revenueChart = echarts.init(document.getElementById('revenueChart'));
        revenueChart.setOption({
            tooltip: { trigger: 'axis', backgroundColor: '#1a2a3a' },
            xAxis: { type: 'category', data: Object.keys(monthlyRevenue), axisLabel: { color: '#8a9abb', rotate: 30 } },
            yAxis: { type: 'value', axisLabel: { color: '#8a9abb' } },
            series: [{ type: 'line', data: Object.values(monthlyRevenue), itemStyle: { color: '#4a7cff' }, smooth: true, areaStyle: { opacity: 0.3 } }]
        });
        
    } catch (err) {
        console.error('Reports page error:', err);
        container.innerHTML = '<div class="table-container"><p>Error loading reports</p></div>';
    }
}

// 檢查管理員登入（修正版）
async function checkAdminAuth() {
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        console.log('Checking admin auth...', user?.email);
        
        // 如果沒有用戶，跳轉到管理員登入頁
        if (error || !user) {
            console.log('No user found, redirecting to admin-login');
            window.location.href = 'admin-login.html';
            return null;
        }
        
        // 允許的管理員郵箱列表
        const adminEmails = [
            "admin@cherinebowl.com",
            "admin2@cherinebowl.com",
            "admin@healthybowl.com"
        ];
        
        const isAdmin = adminEmails.includes(user.email.toLowerCase());
        
        // 如果不是管理員，清除 session 並跳轉
        if (!isAdmin) {
            console.log('Not admin, clearing session and redirecting');
            sessionStorage.removeItem('adminLoggedIn');
            sessionStorage.removeItem('adminEmail');
            await supabaseClient.auth.signOut();
            alert('You do not have admin privileges');
            window.location.href = 'admin-login.html';
            return null;
        }
        
        // 是管理員，更新界面
        console.log('Admin logged in:', user.email);
        document.getElementById('adminEmail').innerText = user.email;
        sessionStorage.setItem('adminLoggedIn', 'true');
        sessionStorage.setItem('adminEmail', user.email);
        return user;
        
    } catch (err) {
        console.error('Auth check error:', err);
        window.location.href = 'admin-login.html';
        return null;
    }
}

// 初始化
async function initAdmin() {
    const user = await checkAdminAuth();
    if (!user) return;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            if (page) showPage(page);
        });
    });
    
    // 登出按鈕
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        sessionStorage.removeItem('adminLoggedIn');
        sessionStorage.removeItem('adminEmail');
        window.location.href = 'admin-login.html';
    });
    
    await showPage('dashboard');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 啟動
initAdmin();