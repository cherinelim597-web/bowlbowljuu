// ============================================
// 每日配送模組 - 彈性伸縮卡片版
// 功能：4卡片統計、搜索、標記配送、撤回、今日暫停
// ============================================

var todayPendingCount = 0;
var todayPausedCount = 0;
var currentDeliveries = [];

async function loadDeliveriesPage() {
    var container = document.getElementById('page_deliveries');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        var todayStr = getTodayString();
        
        var { data: deliveries, error } = await supabaseClient
            .from('deliveries')
            .select(`
                *,
                users (id, full_name, email, phone, address),
                subscriptions (plan_type, total_days, meals_received, start_date, end_date, status)
            `)
            .eq('delivery_date', todayStr);
        
        if (error) throw error;
        
        var { data: pausedRecords } = await supabaseClient
            .from('delivery_pauses')
            .select('user_id')
            .eq('pause_date', todayStr);
        
        var pausedUserIds = [];
        if (pausedRecords) {
            pausedUserIds = pausedRecords.map(function(r) { return r.user_id; });
            todayPausedCount = pausedUserIds.length;
        } else {
            todayPausedCount = 0;
        }
        
        var filtered = [];
        if (deliveries) {
            for (var i = 0; i < deliveries.length; i++) {
                var d = deliveries[i];
                if (d.users && d.users.email === ADMIN_EMAIL) continue;
                var planType = d.subscriptions ? d.subscriptions.plan_type : null;
                if (planType && planType !== 'single') {
                    if (pausedUserIds.indexOf(d.user_id) !== -1) continue;
                    var mealsReceived = d.subscriptions ? d.subscriptions.meals_received : 0;
                    var totalDays = d.subscriptions ? d.subscriptions.total_days : 0;
                    if (mealsReceived >= totalDays && totalDays > 0) continue;
                    filtered.push(d);
                }
            }
        }
        
        currentDeliveries = filtered;
        todayPendingCount = filtered.filter(function(d) { return d.status === 'pending'; }).length;
        
        renderDeliveriesPage(filtered, todayStr);
        
    } catch (err) {
        console.error('Error:', err);
        container.innerHTML = '<div class="table-container"><p>加載失敗: ' + err.message + '</p></div>';
    }
}

function renderDeliveriesPage(deliveries, todayStr) {
    var container = document.getElementById('page_deliveries');
    if (!container) return;
    
    var completionRate = deliveries.length > 0 
        ? Math.round(((deliveries.length - todayPendingCount) / deliveries.length) * 100) 
        : 0;
    
    container.innerHTML = `
        <div class="deliveries-container">
            <!-- 彈性伸縮卡片 - 4個統計卡片 -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-truck"></i></div>
                    <div class="stat-number" id="todayPendingCount">${todayPendingCount}</div>
                    <div class="stat-label">今日待配送</div>
                    <div class="stat-footer">即時更新</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-map-marked-alt"></i></div>
                    <div class="stat-number">${deliveries.length}</div>
                    <div class="stat-label">配送路線數</div>
                    <div class="stat-footer">今日路線</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-pause-circle"></i></div>
                    <div class="stat-number" id="todayPausedCount">${todayPausedCount}</div>
                    <div class="stat-label">今日暫停用戶</div>
                    <div class="stat-footer">已暫停</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-number" id="completionRate">${completionRate}%</div>
                    <div class="stat-label">完成率</div>
                    <div class="stat-footer">目標 100%</div>
                </div>
            </div>
            
            <!-- 搜索欄 -->
            <div class="search-toolbar">
                <div class="search-wrapper">
                    <i class="fas fa-search search-icon"></i>
                    <input type="text" id="searchPhoneInput" placeholder="輸入手機號碼搜索..." class="search-input-modern">
                    <button class="search-clear" id="clearSearchBtn" style="display: none;"><i class="fas fa-times"></i></button>
                </div>
                <button class="btn-modern btn-refresh" onclick="loadDeliveriesPage()">
                    <i class="fas fa-sync-alt"></i> 刷新列表
                </button>
            </div>
            
            <!-- 配送表格 -->
            <div class="delivery-table-modern">
                <div class="table-header">
                    <div class="th" style="width: 18%"><i class="fas fa-user-circle"></i> 用戶信息</div>
                    <div class="th" style="width: 15%"><i class="fas fa-phone-alt"></i> 聯繫方式</div>
                    <div class="th" style="width: 27%"><i class="fas fa-location-dot"></i> 配送地址</div>
                    <div class="th" style="width: 20%"><i class="fas fa-chart-line"></i> 配送進度</div>
                    <div class="th" style="width: 20%"><i class="fas fa-cog"></i> 操作</div>
                </div>
                <div id="deliveriesTableBody" class="table-body">
                    ${renderTableRows(deliveries)}
                </div>
            </div>
            
            ${deliveries.length === 0 ? '<div class="empty-modern"><i class="fas fa-check-circle"></i><h4>今日暫無配送任務</h4><p>所有配送已完成或今日無需配送</p></div>' : ''}
            
            <div class="info-modern">
                <i class="fas fa-lightbulb"></i>
                <span>只顯示週期方案用戶 | 標記送達後數量自動更新 | 暫停後訂閱順延一天</span>
            </div>
        </div>
    `;
    
    var searchInput = document.getElementById('searchPhoneInput');
    var clearBtn = document.getElementById('clearSearchBtn');
    
    if (searchInput) {
        searchInput.onkeyup = function(e) {
            filterTableByPhone(e.target.value);
            if (clearBtn) {
                clearBtn.style.display = e.target.value ? 'flex' : 'none';
            }
        };
    }
    
    if (clearBtn) {
        clearBtn.onclick = function() {
            if (searchInput) {
                searchInput.value = '';
                filterTableByPhone('');
                clearBtn.style.display = 'none';
            }
        };
    }
}

function renderTableRows(deliveries) {
    if (!deliveries || deliveries.length === 0) return '';
    
    var html = '';
    for (var i = 0; i < deliveries.length; i++) {
        var d = deliveries[i];
        var user = d.users;
        var sub = d.subscriptions;
        
        var mealsReceived = sub ? sub.meals_received : 0;
        var totalDays = sub ? sub.total_days : 0;
        var progressPercent = totalDays > 0 ? (mealsReceived / totalDays) * 100 : 0;
        var startDate = (sub && sub.start_date) ? formatDisplayDate(sub.start_date) : 'N/A';
        var endDate = (sub && sub.end_date) ? formatDisplayDate(sub.end_date) : 'N/A';
        var userName = user ? (user.full_name || 'N/A') : 'N/A';
        var userPhone = user ? (user.phone || '未設置') : '未設置';
        var userEmail = user ? (user.email || '未設置') : '未設置';
        var userAddress = user ? (user.address || '未設置地址') : '未設置地址';
        var userId = user ? user.id : '';
        var userInitial = userName ? userName.charAt(0).toUpperCase() : 'U';
        var remainingDays = totalDays - mealsReceived;
        
        html += `
            <div class="table-row" data-delivery-id="${d.id}" data-user-id="${userId}" data-subscription-id="${d.subscription_id}">
                <div class="td" style="width: 18%">
                    <div class="user-info-modern">
                        <div class="user-avatar-modern">${userInitial}</div>
                        <div class="user-details-modern">
                            <div class="user-name-modern">${escapeHtml(userName)}</div>
                            <div class="user-id-modern">${userId.substring(0, 12)}</div>
                        </div>
                    </div>
                </div>
                <div class="td" style="width: 15%">
                    <div class="contact-modern">
                        <div><i class="fas fa-phone"></i> ${escapeHtml(userPhone)}</div>
                        <div><i class="fas fa-envelope"></i> ${escapeHtml(userEmail)}</div>
                    </div>
                </div>
                <div class="td" style="width: 27%">
                    <div class="address-modern">
                        <i class="fas fa-location-dot"></i>
                        <span>${escapeHtml(userAddress)}</span>
                    </div>
                </div>
                <div class="td" style="width: 20%">
                    <div class="progress-modern">
                        <div class="progress-stats-modern">
                            <span class="completed">${mealsReceived} 餐</span>
                            <span class="total">/ ${totalDays} 餐</span>
                            <span class="percentage">(${Math.round(progressPercent)}%)</span>
                        </div>
                        <div class="progress-bar-modern">
                            <div class="progress-fill-modern" style="width: ${progressPercent}%"></div>
                        </div>
                        <div class="progress-date-modern">
                            ${startDate} → ${endDate}
                            <span class="remain-badge">剩餘 ${remainingDays} 天</span>
                        </div>
                    </div>
                </div>
                <div class="td action-td" style="width: 20%">
                    <div class="action-buttons-modern">
                        <button class="action-undo" onclick="undoDelivery('${d.id}', '${userId}', '${d.subscription_id}')" title="撤回配送">
                            <i class="fas fa-undo-alt"></i> 撤回
                        </button>
                        <button class="action-pause" onclick="pauseToday('${d.id}', '${userId}', '${d.subscription_id}')" title="今日暫停">
                            <i class="fas fa-pause-circle"></i> 暫停
                        </button>
                        <button class="action-deliver" onclick="markAsDelivered('${d.id}', '${userId}', '${d.subscription_id}')" title="標記送達">
                            <i class="fas fa-check-circle"></i> 送達
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    return html;
}

function filterTableByPhone(searchTerm) {
    var tableBody = document.getElementById('deliveriesTableBody');
    if (!tableBody) return;
    
    if (!searchTerm.trim()) {
        tableBody.innerHTML = renderTableRows(currentDeliveries);
        return;
    }
    
    var filtered = [];
    for (var i = 0; i < currentDeliveries.length; i++) {
        var d = currentDeliveries[i];
        var phone = d.users ? d.users.phone : '';
        if (phone && phone.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1) {
            filtered.push(d);
        }
    }
    
    tableBody.innerHTML = renderTableRows(filtered);
}

function updateTodayPendingCount() {
    var countElement = document.getElementById('todayPendingCount');
    if (countElement) {
        todayPendingCount--;
        countElement.innerText = todayPendingCount;
        updateCompletionRateNumber();
    }
}

function updateCompletionRateNumber() {
    var totalDeliveries = currentDeliveries.length;
    var completed = todayPendingCount;
    var rateElement = document.getElementById('completionRate');
    if (rateElement && totalDeliveries > 0) {
        var rate = Math.round(((totalDeliveries - completed) / totalDeliveries) * 100);
        rateElement.innerText = rate + '%';
    }
}

function increasePausedCount() {
    todayPausedCount++;
    var pausedElement = document.getElementById('todayPausedCount');
    if (pausedElement) {
        pausedElement.innerText = todayPausedCount;
    }
}

async function markAsDelivered(deliveryId, userId, subscriptionId) {
    try {
        var { error: deliveryError } = await supabaseClient
            .from('deliveries')
            .update({ status: 'delivered' })
            .eq('id', deliveryId);
        if (deliveryError) throw deliveryError;
        
        var { data: sub } = await supabaseClient
            .from('subscriptions')
            .select('meals_received, total_days')
            .eq('id', subscriptionId)
            .single();
        
        var newCount = (sub ? sub.meals_received : 0) + 1;
        await supabaseClient
            .from('subscriptions')
            .update({ meals_received: newCount })
            .eq('id', subscriptionId);
        
        updateTodayPendingCount();
        
        var row = document.querySelector('.table-row[data-delivery-id="' + deliveryId + '"]');
        if (row) {
            row.style.opacity = '0';
            row.style.transform = 'translateX(20px)';
            row.style.transition = 'all 0.3s ease';
            setTimeout(function() {
                row.remove();
                var newList = [];
                for (var i = 0; i < currentDeliveries.length; i++) {
                    if (currentDeliveries[i].id !== deliveryId) {
                        newList.push(currentDeliveries[i]);
                    }
                }
                currentDeliveries = newList;
                if (currentDeliveries.length === 0) {
                    location.reload();
                }
            }, 300);
        }
        
        showToast('配送已完成！' + newCount + '/' + (sub ? sub.total_days : 0) + ' 餐', 'success');
        
        var dashboardPage = document.getElementById('page_dashboard');
        if (dashboardPage && dashboardPage.classList && dashboardPage.classList.contains('active')) {
            if (typeof loadDashboard === 'function') loadDashboard();
        }
    } catch (err) {
        showToast('操作失敗: ' + err.message, 'error');
    }
}

async function undoDelivery(deliveryId, userId, subscriptionId) {
    if (!confirm('撤回後該配送將恢復為待配送狀態，確定撤回嗎？')) return;
    
    try {
        var { data: delivery } = await supabaseClient
            .from('deliveries')
            .select('status')
            .eq('id', deliveryId)
            .single();
        
        if (delivery.status !== 'delivered') {
            showToast('該配送尚未完成，無需撤回', 'error');
            return;
        }
        
        await supabaseClient
            .from('deliveries')
            .update({ status: 'pending' })
            .eq('id', deliveryId);
        
        var { data: sub } = await supabaseClient
            .from('subscriptions')
            .select('meals_received')
            .eq('id', subscriptionId)
            .single();
        
        var newCount = (sub ? sub.meals_received : 0) - 1;
        await supabaseClient
            .from('subscriptions')
            .update({ meals_received: newCount })
            .eq('id', subscriptionId);
        
        todayPendingCount++;
        var countElement = document.getElementById('todayPendingCount');
        if (countElement) countElement.innerText = todayPendingCount;
        updateCompletionRateNumber();
        
        showToast('已撤回配送', 'success');
        loadDeliveriesPage();
        
        var dashboardPage = document.getElementById('page_dashboard');
        if (dashboardPage && dashboardPage.classList && dashboardPage.classList.contains('active')) {
            if (typeof loadDashboard === 'function') loadDashboard();
        }
    } catch (err) {
        showToast('操作失敗: ' + err.message, 'error');
    }
}

async function pauseToday(deliveryId, userId, subscriptionId) {
    if (!confirm('暫停後今日配送將取消，訂閱週期順延一天，確定暫停嗎？')) return;
    
    try {
        var { data: delivery } = await supabaseClient
            .from('deliveries')
            .select('delivery_date, meal_number')
            .eq('id', deliveryId)
            .single();
        
        await supabaseClient.from('deliveries').delete().eq('id', deliveryId);
        
        await supabaseClient
            .from('delivery_pauses')
            .insert({
                user_id: userId,
                delivery_id: deliveryId,
                pause_date: getTodayString(),
                original_meal_number: delivery.meal_number,
                created_at: new Date()
            });
        
        var { data: subscription } = await supabaseClient
            .from('subscriptions')
            .select('end_date, total_days')
            .eq('id', subscriptionId)
            .single();
        
        var newEndDate = new Date(subscription.end_date);
        newEndDate.setDate(newEndDate.getDate() + 1);
        
        await supabaseClient
            .from('subscriptions')
            .update({ 
                end_date: newEndDate.toISOString().split('T')[0],
                total_days: subscription.total_days + 1
            })
            .eq('id', subscriptionId);
        
        updateTodayPendingCount();
        increasePausedCount();
        
        var row = document.querySelector('.table-row[data-delivery-id="' + deliveryId + '"]');
        if (row) {
            row.style.opacity = '0';
            row.style.transform = 'translateX(-20px)';
            row.style.transition = 'all 0.3s ease';
            setTimeout(function() {
                row.remove();
                var newList = [];
                for (var i = 0; i < currentDeliveries.length; i++) {
                    if (currentDeliveries[i].id !== deliveryId) {
                        newList.push(currentDeliveries[i]);
                    }
                }
                currentDeliveries = newList;
            }, 300);
        }
        
        showToast('已暫停今日配送，訂閱週期已順延', 'success');
        
        var dashboardPage = document.getElementById('page_dashboard');
        if (dashboardPage && dashboardPage.classList && dashboardPage.classList.contains('active')) {
            if (typeof loadDashboard === 'function') loadDashboard();
        }
    } catch (err) {
        showToast('操作失敗: ' + err.message, 'error');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return 'N/A';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '/' + month + '/' + day;
}

function getTodayString() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}