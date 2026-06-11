// ============================================
// 每日配送模組 - 彈性伸縮卡片版
// 功能：搜索手機號、4卡片統計、標記配送、撤回、今日暫停
// ============================================

// ADMIN_EMAIL 已在 admin-common.js 中定義

// 全局變量
var todayPendingCount = 0;
var todayPausedCount = 0;
var currentDeliveries = [];

// 加載每日配送頁面
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
            .eq('delivery_date', todayStr)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        // 獲取今日暫停的用戶數量
        var { data: pausedRecords, error: pausedError } = await supabaseClient
            .from('delivery_pauses')
            .select('id')
            .eq('pause_date', todayStr);
        
        if (!pausedError && pausedRecords) {
            todayPausedCount = pausedRecords.length;
        } else {
            todayPausedCount = 0;
        }
        
        var filteredDeliveries = [];
        if (deliveries && deliveries.length > 0) {
            for (var i = 0; i < deliveries.length; i++) {
                var d = deliveries[i];
                if (d.users && d.users.email === ADMIN_EMAIL) continue;
                var planType = d.subscriptions ? d.subscriptions.plan_type : null;
                if (planType && planType !== 'single') {
                    filteredDeliveries.push(d);
                }
            }
        }
        
        currentDeliveries = filteredDeliveries;
        todayPendingCount = filteredDeliveries.length;
        
        renderDeliveriesPage(filteredDeliveries, todayStr);
        
    } catch (err) {
        console.error('Deliveries page error:', err);
        container.innerHTML = '<div class="table-container"><p>加載失敗: ' + err.message + '</p></div>';
    }
}

// 渲染頁面
function renderDeliveriesPage(deliveries, todayStr) {
    var container = document.getElementById('page_deliveries');
    if (!container) return;
    
    var completionRate = deliveries.length > 0 
        ? Math.round(((deliveries.length - todayPendingCount) / deliveries.length) * 100) 
        : 0;
    
    container.innerHTML = `
        <div class="deliveries-container">
            <!-- 4個統計卡片 - 彈性伸縮樣式 -->
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
                    <div class="stat-number" id="completionRateNumber">${completionRate}%</div>
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
    
    // 搜索功能
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

// 渲染表格行
function renderTableRows(deliveries) {
    if (!deliveries || deliveries.length === 0) return '';
    
    var html = '';
    for (var i = 0; i < deliveries.length; i++) {
        var delivery = deliveries[i];
        var user = delivery.users;
        var sub = delivery.subscriptions;
        
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
        var remainingText = remainingDays === 0 ? '最後一天' : (remainingDays + ' 天');
        
        html += `
            <div class="table-row" data-delivery-id="${delivery.id}" data-user-id="${userId}" data-subscription-id="${delivery.subscription_id}">
                <div class="td" style="width: 18%">
                    <div class="user-info-modern">
                        <div class="user-avatar-modern">
                            ${userInitial}
                        </div>
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
                            <span class="remain-badge ${remainingDays === 0 ? 'last' : ''}">${remainingText}</span>
                        </div>
                    </div>
                </div>
                <div class="td action-td" style="width: 20%">
                    <div class="action-buttons-modern">
                        <button class="action-undo" onclick="undoDelivery('${delivery.id}', '${userId}', '${delivery.subscription_id}')" title="撤回配送">
                            <i class="fas fa-undo-alt"></i> 撤回
                        </button>
                        <button class="action-pause" onclick="pauseToday('${delivery.id}', '${userId}', '${delivery.subscription_id}')" title="今日暫停">
                            <i class="fas fa-pause-circle"></i> 暫停
                        </button>
                        <button class="action-deliver" onclick="markAsDelivered('${delivery.id}', '${userId}', '${delivery.subscription_id}')" title="標記送達">
                            <i class="fas fa-check-circle"></i> 送達
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    return html;
}

// 按手機號搜索表格
function filterTableByPhone(searchTerm) {
    var tableBody = document.getElementById('deliveriesTableBody');
    if (!tableBody) return;
    
    if (!searchTerm.trim()) {
        tableBody.innerHTML = renderTableRows(currentDeliveries);
        return;
    }
    
    var filtered = [];
    for (var i = 0; i < currentDeliveries.length; i++) {
        var delivery = currentDeliveries[i];
        var phone = delivery.users ? delivery.users.phone : '';
        if (phone && phone.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1) {
            filtered.push(delivery);
        }
    }
    
    tableBody.innerHTML = renderTableRows(filtered);
}

// 更新今日待配送總數
function updateTodayPendingCount() {
    var countElement = document.getElementById('todayPendingCount');
    if (countElement) {
        todayPendingCount--;
        countElement.innerText = todayPendingCount;
        updateCompletionRateNumber();
    }
}

// 更新完成率
function updateCompletionRateNumber() {
    var totalDeliveries = currentDeliveries.length;
    var completed = todayPendingCount;
    var rateElement = document.getElementById('completionRateNumber');
    if (rateElement && totalDeliveries > 0) {
        var rate = Math.round(((totalDeliveries - completed) / totalDeliveries) * 100);
        rateElement.innerText = rate + '%';
    }
}

// 增加暫停用戶計數
function increasePausedCount() {
    todayPausedCount++;
    var pausedElement = document.getElementById('todayPausedCount');
    if (pausedElement) {
        pausedElement.innerText = todayPausedCount;
    }
}

// 標記為已送達
async function markAsDelivered(deliveryId, userId, subscriptionId) {
    try {
        var { error: deliveryError } = await supabaseClient
            .from('deliveries')
            .update({ status: 'delivered' })
            .eq('id', deliveryId);
        
        if (deliveryError) throw deliveryError;
        
        var { data: sub, error: subError } = await supabaseClient
            .from('subscriptions')
            .select('meals_received, total_days')
            .eq('id', subscriptionId)
            .single();
        
        if (subError) throw subError;
        
        var newCount = (sub ? sub.meals_received : 0) + 1;
        var totalDays = sub ? sub.total_days : 0;
        
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
                    var container = document.querySelector('.delivery-table-modern');
                    if (container && !document.querySelector('.empty-modern')) {
                        container.insertAdjacentHTML('afterend', '<div class="empty-modern"><i class="fas fa-check-circle"></i><h4>今日暫無配送任務</h4><p>所有配送已完成！</p></div>');
                    }
                }
            }, 300);
        }
        
        showToast('配送已完成！' + newCount + '/' + totalDays + ' 餐', 'success');
        
        var dashboardPage = document.getElementById('page_dashboard');
        if (dashboardPage && dashboardPage.classList && dashboardPage.classList.contains('active')) {
            if (typeof loadDashboard === 'function') loadDashboard();
        }
        
    } catch (err) {
        console.error('Error:', err);
        showToast('操作失敗: ' + err.message, 'error');
    }
}

// 撤回配送
async function undoDelivery(deliveryId, userId, subscriptionId) {
    if (!confirm('撤回後該配送將恢復為待配送狀態，確定撤回嗎？')) return;
    
    try {
        var { data: delivery, error: checkError } = await supabaseClient
            .from('deliveries')
            .select('status')
            .eq('id', deliveryId)
            .single();
        
        if (checkError) throw checkError;
        
        if (delivery.status !== 'delivered') {
            showToast('該配送尚未完成，無需撤回', 'error');
            return;
        }
        
        var { error: deliveryError } = await supabaseClient
            .from('deliveries')
            .update({ status: 'pending' })
            .eq('id', deliveryId);
        
        if (deliveryError) throw deliveryError;
        
        var { data: sub, error: subError } = await supabaseClient
            .from('subscriptions')
            .select('meals_received')
            .eq('id', subscriptionId)
            .single();
        
        if (subError) throw subError;
        
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
        console.error('Error:', err);
        showToast('操作失敗: ' + err.message, 'error');
    }
}

// 今日暫停
async function pauseToday(deliveryId, userId, subscriptionId) {
    if (!confirm('暫停後今日配送將取消，訂閱週期順延一天，確定暫停嗎？')) return;
    
    try {
        var { data: delivery, error: getError } = await supabaseClient
            .from('deliveries')
            .select('delivery_date, meal_number')
            .eq('id', deliveryId)
            .single();
        
        if (getError) throw getError;
        
        var { error: deleteError } = await supabaseClient
            .from('deliveries')
            .delete()
            .eq('id', deliveryId);
        
        if (deleteError) throw deleteError;
        
        // 記錄暫停記錄
        await supabaseClient
            .from('delivery_pauses')
            .insert({
                user_id: userId,
                delivery_id: deliveryId,
                pause_date: getTodayString(),
                original_meal_number: delivery.meal_number,
                created_at: new Date()
            });
        
        var { data: subscription, error: subError } = await supabaseClient
            .from('subscriptions')
            .select('end_date, total_days')
            .eq('id', subscriptionId)
            .single();
        
        if (subError) throw subError;
        
        var currentEndDate = new Date(subscription.end_date);
        var newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() + 1);
        
        await supabaseClient
            .from('subscriptions')
            .update({ 
                end_date: newEndDate.toISOString().split('T')[0],
                total_days: subscription.total_days + 1
            })
            .eq('id', subscriptionId);
        
        var { data: futureDeliveries } = await supabaseClient
            .from('deliveries')
            .select('id, meal_number')
            .eq('user_id', userId)
            .eq('subscription_id', subscriptionId)
            .gt('meal_number', delivery.meal_number)
            .order('meal_number', { ascending: true });
        
        if (futureDeliveries && futureDeliveries.length > 0) {
            for (var i = 0; i < futureDeliveries.length; i++) {
                await supabaseClient
                    .from('deliveries')
                    .update({ meal_number: delivery.meal_number + i })
                    .eq('id', futureDeliveries[i].id);
            }
        }
        
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
                for (var j = 0; j < currentDeliveries.length; j++) {
                    if (currentDeliveries[j].id !== deliveryId) {
                        newList.push(currentDeliveries[j]);
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
        console.error('Error:', err);
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