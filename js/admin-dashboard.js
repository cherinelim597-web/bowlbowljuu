// ============================================
// 管理員儀表板 - 最終穩定版（修復406錯誤）
// ============================================

let revenueTargetConfig = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    target: 0
};

function loadRevenueTarget() {
    const saved = localStorage.getItem('revenueTarget');
    if (saved) {
        try {
            revenueTargetConfig = JSON.parse(saved);
        } catch(e) {}
    }
    return revenueTargetConfig;
}

function saveRevenueTarget(year, month, target) {
    revenueTargetConfig = { year, month, target };
    localStorage.setItem('revenueTarget', JSON.stringify(revenueTargetConfig));
}

function showSetRevenueTargetModal() {
    const saved = loadRevenueTarget();
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 2; i++) {
        years.push(i);
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:1000;display:flex;justify-content:center;align-items:center;`;
    modal.innerHTML = `
        <div class="modal-card" style="max-width:400px;width:90%;background:white;border-radius:28px;padding:28px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="color:#8b6f4c;"><i class="fas fa-bullseye"></i> 設置本月營收目標</h3>
                <button class="close-modal-btn" style="background:none;border:none;font-size:24px;cursor:pointer;color:#b8956e;">&times;</button>
            </div>
            <div style="margin-bottom:16px;">
                <label style="display:block;margin-bottom:8px;font-weight:600;color:#8b6f4c;">年份</label>
                <select id="targetYear" style="width:100%;padding:12px;background:#f8f5f0;border:1px solid #ffe0c0;border-radius:16px;">
                    ${years.map(y => `<option value="${y}" ${y === saved.year ? 'selected' : ''}>${y}年</option>`).join('')}
                </select>
            </div>
            <div style="margin-bottom:16px;">
                <label style="display:block;margin-bottom:8px;font-weight:600;color:#8b6f4c;">月份</label>
                <select id="targetMonth" style="width:100%;padding:12px;background:#f8f5f0;border:1px solid #ffe0c0;border-radius:16px;">
                    ${Array(12).fill().map((_, i) => `<option value="${i+1}" ${i+1 === saved.month ? 'selected' : ''}>${i+1}月</option>`).join('')}
                </select>
            </div>
            <div style="margin-bottom:20px;">
                <label style="display:block;margin-bottom:8px;font-weight:600;color:#8b6f4c;">營收目標 (RM)</label>
                <input type="number" id="targetAmount" value="${saved.target}" step="1000" placeholder="輸入目標金額" style="width:100%;padding:12px;background:#f8f5f0;border:1px solid #ffe0c0;border-radius:16px;">
            </div>
            <div style="display:flex;gap:12px;">
                <button class="btn-save" onclick="confirmSetRevenueTarget()" style="flex:1;background:#c8a15e;border:none;padding:12px;border-radius:40px;color:white;font-weight:600;cursor:pointer;">保存</button>
                <button class="btn-cancel" onclick="closeModal(this.closest('.modal-overlay'))" style="flex:1;background:#f0ebe2;border:none;padding:12px;border-radius:40px;color:#8b6f4c;font-weight:600;cursor:pointer;">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.close-modal-btn').onclick = () => closeModal(modal);
    modal.onclick = (e) => { if (e.target === modal) closeModal(modal); };
    document.addEventListener('keydown', function handleEsc(e) {
        if (e.key === 'Escape') { closeModal(modal); document.removeEventListener('keydown', handleEsc); }
    });
}

function confirmSetRevenueTarget() {
    const year = parseInt(document.getElementById('targetYear').value);
    const month = parseInt(document.getElementById('targetMonth').value);
    const target = parseFloat(document.getElementById('targetAmount').value) || 0;
    saveRevenueTarget(year, month, target);
    closeModal(document.querySelector('.modal-overlay'));
    showToast(`營收目標已設置為 RM ${target.toLocaleString()}`, 'success');
    loadDashboard();
}

async function showExpiringSubscriptionsModal() {
    const sevenDaysLater = getMalaysiaDate();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const sevenDaysLaterStr = formatMalaysiaDate(sevenDaysLater);
    const todayStr = getTodayString();
    
    const loadingModal = document.createElement('div');
    loadingModal.className = 'modal-overlay';
    loadingModal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:1000;display:flex;justify-content:center;align-items:center;`;
    loadingModal.innerHTML = `<div style="background:white;border-radius:28px;padding:40px;"><div class="loading-spinner"></div><p style="margin-top:16px;">加載中...</p></div>`;
    document.body.appendChild(loadingModal);
    
    try {
        const { data: expiringSubs, error } = await supabaseClient
            .from('subscriptions')
            .select('*, users(id, full_name, email, phone, address)')
            .eq('status', 'active')
            .neq('plan_type', 'single')
            .lte('end_date', sevenDaysLaterStr)
            .gte('end_date', todayStr);
        
        loadingModal.remove();
        
        const planNames = { single: '單次', weekly: '週方案', '1month': '1個月', '2months': '2個月', '3months': '3個月' };
        const today = getMalaysiaDate();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:1000;display:flex;justify-content:center;align-items:center;`;
        modal.innerHTML = `
            <div class="modal-card" style="max-width:1000px;width:95%;max-height:85vh;overflow-y:auto;background:white;border-radius:28px;padding:0;">
                <div style="background:linear-gradient(135deg,#fefaf5,#f5ede0);border-radius:28px 28px 0 0;padding:20px 28px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ffe0c0;">
                    <div><h3 style="color:#8b6f4c;margin:0;"><i class="fas fa-hourglass-half"></i> 即將到期訂閱</h3><p style="color:#b8956e;margin:4px 0 0;font-size:13px;">7天內到期的活躍訂閱</p></div>
                    <button class="close-modal-btn" style="background:#f0ebe2;border:none;padding:8px 16px;border-radius:30px;color:#8b6f4c;cursor:pointer;"><i class="fas fa-times"></i> 關閉</button>
                </div>
                <div style="padding:20px 28px;">
                    ${!expiringSubs || expiringSubs.length === 0 ? 
                        `<div style="text-align:center;padding:60px;color:#b8956e;"><i class="fas fa-check-circle" style="font-size:48px;margin-bottom:16px;"></i><p>暫無即將到期的訂閱</p></div>` :
                        `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#fefaf5;"><th style="padding:12px;text-align:left;">用戶</th><th style="padding:12px;text-align:left;">聯繫方式</th><th style="padding:12px;text-align:left;">方案</th><th style="padding:12px;text-align:left;">訂閱期間</th><th style="padding:12px;text-align:left;">剩餘天數</th><th style="padding:12px;text-align:center;">操作</th></tr></thead><tbody>
                            ${expiringSubs.map(sub => {
                                const user = sub.users;
                                const endDate = new Date(sub.end_date);
                                const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                                let daysLeftColor = '#e8a878', daysLeftBg = '#fff0e0';
                                if (daysLeft <= 2) { daysLeftColor = '#e87a8a'; daysLeftBg = '#ffe0e4'; }
                                return `<tr style="border-bottom:1px solid #f0e0d0;">
                                    <td style="padding:12px;"><strong style="color:#5a4a3a;">${escapeHtml(user?.full_name || 'N/A')}</strong><br><span style="font-size:11px;color:#b8956e;">ID: ${sub.user_id?.substring(0,8)}...</span></td>
                                    <td style="padding:12px;"><div><i class="fas fa-phone" style="color:#c8a15e;width:20px;"></i> ${escapeHtml(user?.phone || '未設置')}</div><div><i class="fas fa-envelope" style="color:#c8a15e;width:20px;"></i> ${escapeHtml(user?.email || '未設置')}</div></td>
                                    <td style="padding:12px;">${planNames[sub.plan_type] || sub.plan_type}<br><span style="font-size:11px;color:#c8a15e;">RM ${sub.total_price}</span></td>
                                    <td style="padding:12px;font-size:12px;">${formatDisplayDate(sub.start_date)} → ${formatDisplayDate(sub.end_date)}</td>
                                    <td style="padding:12px;"><span style="background:${daysLeftBg};color:${daysLeftColor};padding:4px 12px;border-radius:30px;font-size:12px;font-weight:600;">${daysLeft} 天</span></td>
                                    <td style="padding:12px;text-align:center;"><button class="btn-small" onclick="sendRenewalReminder('${sub.user_id}', '${escapeHtml(user?.full_name)}', ${daysLeft})" style="background:#c8a15e;color:white;border:none;padding:6px 12px;border-radius:30px;cursor:pointer;font-size:11px;"><i class="fas fa-bell"></i> 發送提醒</button></td>
                                比`;
                            }).join('')}
                        </tbody></table></div><div style="margin-top:16px;padding:12px;background:#fefaf5;border-radius:16px;text-align:center;"><span style="font-size:13px;color:#b8956e;">共 ${expiringSubs.length} 個訂閱即將到期</span></div>`
                    }
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.close-modal-btn').onclick = () => closeModal(modal);
        modal.onclick = (e) => { if (e.target === modal) closeModal(modal); };
        document.addEventListener('keydown', function handleEsc(e) {
            if (e.key === 'Escape') { closeModal(modal); document.removeEventListener('keydown', handleEsc); }
        });
    } catch (err) {
        loadingModal.remove();
        showToast('加載失敗: ' + err.message, 'error');
    }
}

async function sendRenewalReminder(userId, userName, daysLeft) {
    if (confirm(`發送續約提醒給 ${userName}？\n\n訂閱將在 ${daysLeft} 天後到期`)) {
        showToast(`提醒已發送給 ${userName}`, 'success');
    }
}

// ============================================
// 主函數
// ============================================

async function loadDashboard() {
    const container = document.getElementById('page_dashboard');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const today = getTodayString();
        const malaysiaNow = getMalaysiaDate();
        const thisMonth = malaysiaNow.getMonth();
        const thisYear = malaysiaNow.getFullYear();
        
        // 獲取管理員ID（使用 maybeSingle 避免406錯誤）
        const { data: adminUser } = await supabaseClient
            .from('users')
            .select('id')
            .eq('email', ADMIN_EMAIL)
            .maybeSingle();
        
        const adminId = adminUser?.id;
        
        // 獲取所有用戶（排除管理員）
        const { data: allUsers } = await supabaseClient
            .from('users')
            .select('*')
            .neq('email', ADMIN_EMAIL);
        
        const totalUsers = allUsers?.length || 0;
        
        // 獲取所有訂閱
        const { data: allSubscriptions } = await supabaseClient
            .from('subscriptions')
            .select('*');
        
        // 過濾掉管理員的訂閱
        const subscriptions = (allSubscriptions || []).filter(s => s.user_id !== adminId);
        
        // 活躍訂閱（排除單次）
        const activeSubscriptions = subscriptions.filter(s => 
            s.status === 'active' && s.plan_type !== 'single'
        ).length;
        
        // 總訂單數
        const totalOrdersCount = subscriptions.length;
        
        // 已支付訂單
        const paidSubscriptions = subscriptions.filter(s => s.payment_status === 'paid');
        
        // 計算總營收
        let totalRevenue = 0;
        for (const sub of paidSubscriptions) {
            totalRevenue += (sub.total_price || 0);
        }
        
        // 計算本月營收
        let monthlyRevenue = 0;
        for (const sub of paidSubscriptions) {
            if (sub.created_at) {
                const subDate = new Date(sub.created_at);
                if (subDate.getMonth() === thisMonth && subDate.getFullYear() === thisYear) {
                    monthlyRevenue += (sub.total_price || 0);
                }
            }
        }
        
        // 未支付訂單
        const unpaidSubscriptions = subscriptions.filter(s => 
            s.status === 'active' && s.payment_status === 'unpaid'
        );
        const unpaidCount = unpaidSubscriptions.length;
        const unpaidTotalAmount = unpaidSubscriptions.reduce((sum, s) => sum + (s.total_price || 0), 0);
        
        // 今日配送
        const { data: allTodayDeliveries } = await supabaseClient
            .from('deliveries')
            .select('*')
            .eq('delivery_date', today);
        
        const todayDeliveries = (allTodayDeliveries || []).filter(d => d.user_id !== adminId);
        const todayPending = todayDeliveries.filter(d => d.status === 'pending').length;
        
        // 即將到期訂閱
        const sevenDaysLater = getMalaysiaDate();
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
        const sevenDaysLaterStr = formatMalaysiaDate(sevenDaysLater);
        
        const expiringCount = subscriptions.filter(s => 
            s.status === 'active' && 
            s.plan_type !== 'single' && 
            s.end_date <= sevenDaysLaterStr &&
            s.end_date >= today
        ).length;
        
        // 營收目標
        const targetConfig = loadRevenueTarget();
        let targetProgress = 0;
        let targetDisplayText = '';
        let targetCardStyle = '';
        
        if (targetConfig.year === thisYear && targetConfig.month === (thisMonth + 1) && targetConfig.target > 0) {
            targetProgress = Math.min(Math.round((monthlyRevenue / targetConfig.target) * 100), 100);
            targetDisplayText = `${targetProgress}% (RM ${monthlyRevenue.toLocaleString()} / RM ${targetConfig.target.toLocaleString()})`;
            if (targetProgress >= 100) {
                targetCardStyle = 'border-left: 3px solid #2ed15a;';
            } else if (targetProgress >= 70) {
                targetCardStyle = 'border-left: 3px solid #c8a15e;';
            } else {
                targetCardStyle = 'border-left: 3px solid #e8a878;';
            }
        } else {
            targetDisplayText = '點擊設置目標';
            targetCardStyle = 'border-left: 3px solid #e0d0c0; opacity: 0.7;';
        }
        
        // 方案統計
        const planStats = { single: 0, weekly: 0, '1month': 0, '2months': 0, '3months': 0 };
        subscriptions.forEach(s => {
            if (planStats[s.plan_type] !== undefined) planStats[s.plan_type]++;
        });
        
        // 最近7天配送統計
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = getMalaysiaDate();
            d.setDate(d.getDate() - i);
            last7Days.push(formatMalaysiaDate(d));
        }
        
        const { data: allDailyDeliveries } = await supabaseClient
            .from('deliveries')
            .select('delivery_date, status, user_id')
            .in('delivery_date', last7Days);
        
        const dailyDeliveries = (allDailyDeliveries || []).filter(d => d.user_id !== adminId);
        
        const deliveryCounts = last7Days.map(date => 
            dailyDeliveries.filter(d => d.delivery_date === date && d.status === 'delivered').length
        );
        
        // 最近註冊用戶
        const recentUsers = allUsers?.slice(0, 5) || [];
        const recentUsersHtml = recentUsers.map(user => {
            const avatarLetter = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';
            const daysSince = Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24));
            let badgeText = '新用戶';
            let badgeColor = '#6fb87f';
            let badgeBg = '#e0f5e4';
            if (daysSince <= 1) {
                badgeText = '🔥 今日新用戶';
                badgeColor = '#e87a8a';
                badgeBg = '#ffe0e4';
            } else if (daysSince <= 3) {
                badgeText = '🆕 新用戶';
                badgeColor = '#6fb87f';
                badgeBg = '#e0f5e4';
            } else {
                badgeText = '👤 活躍';
                badgeColor = '#b8956e';
                badgeBg = '#f0ebe2';
            }
            return `
                <div style="display: flex; align-items: center; gap: 14px; padding: 10px; background: white; border-radius: 60px; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                    <div style="width: 46px; height: 46px; background: linear-gradient(135deg, #ffe0c0, #ffd4a0); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #e09a5a;">
                        ${escapeHtml(avatarLetter)}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; color: #8b6f4c;">${escapeHtml(user.full_name || 'N/A')}</div>
                        <div style="font-size: 11px; color: #b8956e;">${escapeHtml(user.email || '未設置')}</div>
                    </div>
                    <div style="font-size: 10px; background: ${badgeBg}; padding: 4px 12px; border-radius: 30px; color: ${badgeColor}; font-weight: 600;">
                        ${badgeText}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-icon"><i class="fas fa-users"></i></div><div class="stat-value">${totalUsers}</div><div class="stat-label">總用戶數</div></div>
                <div class="stat-card"><div class="stat-icon"><i class="fas fa-calendar-check"></i></div><div class="stat-value">${activeSubscriptions}</div><div class="stat-label">活躍訂閱</div><div style="font-size: 10px; color: #b8956e;">(不含單次)</div></div>
                <div class="stat-card"><div class="stat-icon"><i class="fas fa-ticket-alt"></i></div><div class="stat-value">${totalOrdersCount}</div><div class="stat-label">總訂單數</div></div>
                <div class="stat-card"><div class="stat-icon"><i class="fas fa-dollar-sign"></i></div><div class="stat-value">RM ${totalRevenue.toLocaleString()}</div><div class="stat-label">總營收</div></div>
            </div>
            
            <div class="stats-grid" style="margin-bottom: 28px;">
                <div class="stat-card"><div class="stat-icon"><i class="fas fa-chart-line"></i></div><div class="stat-value">RM ${monthlyRevenue.toLocaleString()}</div><div class="stat-label">本月營收</div></div>
                
                <div class="stat-card" style="cursor: pointer; ${targetCardStyle}" onclick="showSetRevenueTargetModal()">
                    <div class="stat-icon"><i class="fas fa-bullseye"></i></div>
                    <div class="stat-value">${targetConfig.target > 0 ? `RM ${targetConfig.target.toLocaleString()}` : '未設置'}</div>
                    <div class="stat-label">本月營收目標</div>
                    <div style="font-size: 11px; color: ${targetProgress >= 100 ? '#2ed15a' : '#c8a15e'}; margin-top: 4px;">${targetDisplayText}</div>
                    ${targetConfig.target > 0 && targetProgress < 100 ? `<div style="margin-top: 8px; background: #f0ebe2; border-radius: 20px; height: 4px; overflow: hidden;"><div style="width: ${targetProgress}%; background: #c8a15e; height: 100%; border-radius: 20px;"></div></div>` : ''}
                    <div style="font-size: 10px; color: #b8956e; margin-top: 6px;">點擊設置目標</div>
                </div>
                
                <div class="stat-card" style="cursor: pointer;" onclick="showExpiringSubscriptionsModal()">
                    <div class="stat-icon"><i class="fas fa-hourglass-half"></i></div>
                    <div class="stat-value">${expiringCount}</div>
                    <div class="stat-label">即將到期訂閱</div>
                    <div style="font-size: 11px; color: #e8a878; margin-top: 4px;">7天內到期</div>
                    <div style="font-size: 10px; color: #b8956e; margin-top: 6px;">點擊查看詳情</div>
                </div>
                
                <div class="stat-card" style="cursor: pointer;" onclick="showUnpaidModal()">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-value">${unpaidCount}</div>
                    <div class="stat-label">未支付訂單</div>
                    <div style="font-size: 12px; color: #ffb84d; margin-top: 4px;">RM ${unpaidTotalAmount.toLocaleString()}</div>
                </div>
            </div>
            
            <div class="chart-row">
                <div class="chart-card"><h3>📊 方案分佈</h3><div id="planChart" class="chart-container"></div></div>
                <div class="chart-card"><h3>📈 近7日配送量</h3><div id="deliveryChart" class="chart-container"></div></div>
            </div>
            
            <div class="table-container">
                <h3 style="margin-bottom: 16px; color: #8b6f4c;"><i class="fas fa-user-plus"></i> 最近註冊用戶</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">${recentUsersHtml}</div>
            </div>
        `;
        
        // 圖表
        const planChart = echarts.init(document.getElementById('planChart'));
        planChart.setOption({
            tooltip: { trigger: 'item', backgroundColor: '#1a2a3a' },
            legend: { textStyle: { color: '#eef5ff' }, bottom: 0 },
            series: [{
                type: 'pie', radius: '55%',
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
        
        const deliveryChart = echarts.init(document.getElementById('deliveryChart'));
        deliveryChart.setOption({
            tooltip: { trigger: 'axis', backgroundColor: '#1a2a3a' },
            xAxis: { type: 'category', data: last7Days.map(d => d.slice(5)), axisLabel: { color: '#8a9abb' } },
            yAxis: { type: 'value', axisLabel: { color: '#8a9abb' } },
            series: [{ type: 'bar', data: deliveryCounts, itemStyle: { color: '#4a7cff', borderRadius: [4,4,0,0] } }]
        });
        
    } catch (err) {
        console.error('Dashboard error:', err);
        container.innerHTML = '<p>加載失敗: ' + err.message + '</p>';
    }
}

// ============================================
// 輔助函數
// ============================================

function closeModal(modalElement) {
    if (modalElement && modalElement.remove) {
        modalElement.remove();
    }
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getMalaysiaDate() {
    const now = new Date();
    const malaysiaTime = now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' });
    return new Date(malaysiaTime);
}

function formatMalaysiaDate(date) {
    const d = date ? new Date(date) : getMalaysiaDate();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTodayString() {
    return formatMalaysiaDate();
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> ${message}`;
    toast.style.cssText = `position:fixed;bottom:20px;right:20px;background:${type === 'error' ? '#e87a8a' : '#6fb87f'};color:white;padding:12px 20px;border-radius:40px;z-index:2000;animation:slideIn 0.3s ease;`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function showUnpaidModal() {
    const { data: adminUser } = await supabaseClient
        .from('users')
        .select('id')
        .eq('email', ADMIN_EMAIL)
        .maybeSingle();
    
    const adminId = adminUser?.id;
    
    const { data: allSubscriptions } = await supabaseClient
        .from('subscriptions')
        .select('*, users(id, full_name, email, phone, address)');
    
    const unpaidSubscriptions = (allSubscriptions || []).filter(s => 
        s.status === 'active' && 
        s.payment_status === 'unpaid' && 
        s.user_id !== adminId
    );
    
    const planNames = { single: '單次', weekly: '週方案', '1month': '1個月', '2months': '2個月', '3months': '3個月' };
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:1000;display:flex;justify-content:center;align-items:center;`;
    modal.innerHTML = `
        <div class="modal-card" style="max-width:900px;width:90%;max-height:80vh;overflow-y:auto;background:white;border-radius:28px;padding:24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="color:#8b6f4c;"><i class="fas fa-clock"></i> 未支付訂單 (共 ${unpaidSubscriptions.length} 筆)</h3>
                <button class="close-modal-btn" style="background:none;border:none;font-size:24px;cursor:pointer;color:#b8956e;">&times;</button>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;min-width:600px;border-collapse:collapse;">
                    <thead><tr style="background:#fefaf5;"><th style="padding:10px;">訂單號</th><th style="padding:10px;">用戶</th><th style="padding:10px;">方案</th><th style="padding:10px;">金額</th><th style="padding:10px;">訂閱期間</th><th style="padding:10px;">操作</th></tr></thead>
                    <tbody>
                        ${unpaidSubscriptions.map(sub => `
                            <tr style="border-bottom:1px solid #f0e0d0;">
                                <td style="padding:10px;"><span class="order-no-badge">${escapeHtml(sub.order_no || '無')}</span></td>
                                <td style="padding:10px;"><strong>${escapeHtml(sub.users?.full_name || 'N/A')}</strong><br><small>📧 ${escapeHtml(sub.users?.email || 'N/A')}</small><br><small>📱 ${escapeHtml(sub.users?.phone || 'N/A')}</small></td>
                                <td style="padding:10px;">${planNames[sub.plan_type] || sub.plan_type}</td>
                                <td style="padding:10px;color:#c8a15e;">RM ${sub.total_price}</td>
                                <td style="padding:10px;font-size:12px;">${formatDisplayDate(sub.start_date)}<br>→ ${formatDisplayDate(sub.end_date)}</td>
                                <td style="padding:10px;text-align:center;"><button class="btn-small" onclick="markAsPaid('${sub.id}', '${sub.user_id}')" style="background:#2ed15a;border:none;padding:6px 12px;border-radius:30px;color:white;cursor:pointer;">✓ 標記已支付</button></td>
                            比
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="margin-top:20px;"><button class="btn-cancel" onclick="closeModal(this.closest('.modal-overlay'))" style="background:#f0ebe2;border:none;padding:10px 20px;border-radius:30px;cursor:pointer;">關閉</button></div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.close-modal-btn').onclick = () => closeModal(modal);
    modal.onclick = (e) => { if (e.target === modal) closeModal(modal); };
}

async function markAsPaid(subscriptionId, userId) {
    if (!confirm('確定將此訂單標記為已支付？')) return;
    const { error } = await supabaseClient.from('subscriptions').update({ payment_status: 'paid' }).eq('id', subscriptionId);
    if (error) {
        showToast('操作失敗: ' + error.message, 'error');
    } else {
        showToast('已標記為已支付！');
        document.querySelector('.modal-overlay')?.remove();
        loadDashboard();
        if (document.getElementById('page_users')?.classList.contains('active') && typeof loadUsersPage === 'function') {
            loadUsersPage();
        }
    }
}