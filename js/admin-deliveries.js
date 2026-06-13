// ============================================
// 每日配送模組 - 修復計數邏輯
// 核心原則：待配送數量 = 總配送數量 - 已臨時標記數量 - 已暫停數量
// ============================================

var todayPendingCount = 0;      // 待配送數量（未點擊送達）
var todayPausedCount = 0;       // 暫停數量
var currentDeliveries = [];     // 當前所有配送記錄
var tempDeliveredIds = [];       // 臨時標記為送達的ID（未提交到數據庫）

// ========== 核心修復：重新計算待配送數量 ==========
function recalcPendingCount() {
    // 獲取所有活躍的配送（未暫停的）
    var activeDeliveries = currentDeliveries.filter(function(d) {
        return !d.is_paused;
    });
    
    // 待配送數量 = 活躍配送總數 - 已臨時標記送達的數量
    var newCount = activeDeliveries.length - tempDeliveredIds.length;
    
    // 確保不為負數
    if (newCount < 0) newCount = 0;
    
    todayPendingCount = newCount;
    
    // 更新頁面顯示
    var countElement = document.getElementById('todayPendingCount');
    if (countElement) {
        countElement.innerText = todayPendingCount;
    }
    
    // 更新完成率
    updateCompletionRate();
    
    console.log('重新計算: 活躍配送=' + activeDeliveries.length + ', 已標記=' + tempDeliveredIds.length + ', 待配送=' + todayPendingCount);
    
    return todayPendingCount;
}

// 更新完成率
function updateCompletionRate() {
    var totalActive = currentDeliveries.filter(function(d) { 
        return !d.is_paused; 
    }).length;
    
    var completed = tempDeliveredIds.length;
    var rateElement = document.getElementById('completionRate');
    
    if (rateElement && totalActive > 0) {
        var rate = Math.round((completed / totalActive) * 100);
        rateElement.innerText = rate + '%';
    } else if (rateElement) {
        rateElement.innerText = '0%';
    }
}

// 加載配送頁面
async function loadDeliveriesPage() {
    var container = document.getElementById('page_deliveries');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        var todayStr = getTodayString();
        
        // 查詢今日配送
        var { data: deliveries, error: deliveriesError } = await supabaseClient
            .from('deliveries')
            .select(`
                *,
                users (id, full_name, email, phone, address),
                subscriptions (plan_type, total_days, meals_received, start_date, end_date, status)
            `)
            .eq('delivery_date', todayStr);
        
        if (deliveriesError) throw deliveriesError;
        
        // 查詢今日暫停記錄（使用 try-catch 避免 400 錯誤）
        var pausedItems = [];
        try {
            var { data: pausedRecords, error: pausedError } = await supabaseClient
                .from('delivery_pauses')
                .select('*, users(id, full_name, email, phone, address), subscriptions(plan_type, total_days, meals_received, start_date, end_date, status)')
                .eq('pause_date', todayStr);
            
            if (!pausedError && pausedRecords && pausedRecords.length > 0) {
                for (var j = 0; j < pausedRecords.length; j++) {
                    var p = pausedRecords[j];
                    if (p.users && p.users.email === ADMIN_EMAIL) continue;
                    var planType = p.subscriptions ? p.subscriptions.plan_type : null;
                    if (planType && planType !== 'single') {
                        pausedItems.push({
                            id: p.delivery_id,
                            user_id: p.user_id,
                            subscription_id: p.subscription_id,
                            delivery_date: todayStr,
                            status: 'paused',
                            meal_number: p.original_meal_number,
                            is_paused: true,
                            users: p.users,
                            subscriptions: p.subscriptions
                        });
                    }
                }
            }
        } catch (pauseErr) {
            console.log('No paused records found');
        }
        
        // 過濾活躍配送（排除管理員和單次方案）
        var activeDeliveries = [];
        if (deliveries) {
            for (var i = 0; i < deliveries.length; i++) {
                var d = deliveries[i];
                if (d.users && d.users.email === ADMIN_EMAIL) continue;
                var planType = d.subscriptions ? d.subscriptions.plan_type : null;
                if (planType && planType !== 'single') {
                    // 標記為未暫停、未送達
                    d.is_paused = false;
                    activeDeliveries.push(d);
                }
            }
        }
        
        // 合併並排序
        var allDeliveries = [...activeDeliveries, ...pausedItems];
        allDeliveries.sort(function(a, b) {
            return (a.meal_number || 0) - (b.meal_number || 0);
        });
        
        currentDeliveries = allDeliveries;
        tempDeliveredIds = [];  // 清空臨時標記
        todayPausedCount = pausedItems.length;
        
        // ========== 核心修復：計算待配送數量 ==========
        // 待配送 = 所有未暫停的配送
        var activeCount = currentDeliveries.filter(function(d) {
            return !d.is_paused;
        }).length;
        todayPendingCount = activeCount;
        
        console.log('加載完成: 總配送=' + allDeliveries.length + ', 活躍=' + activeCount + ', 暫停=' + todayPausedCount);
        
        renderDeliveriesPage(allDeliveries, todayStr);
        
    } catch (err) {
        console.error('Error:', err);
        container.innerHTML = '<div class="table-container"><p>加載失敗: ' + (err.message || '請刷新頁面') + '</p><button class="btn-small" onclick="loadDeliveriesPage()" style="margin-top: 10px;">重新加載</button></div>';
    }
}

function renderDeliveriesPage(deliveries, todayStr) {
    var container = document.getElementById('page_deliveries');
    if (!container) return;
    
    var totalActive = deliveries.filter(function(d) { return !d.is_paused; }).length;
    var completed = tempDeliveredIds.length;
    var completionRate = totalActive > 0 ? Math.round((completed / totalActive) * 100) : 0;
    
    var tableRowsHtml = renderTableRows(deliveries);
    
    container.innerHTML = `
        <div class="deliveries-container">
            <div class="stats-four">
                <div class="stat-card-primary">
                    <div class="stat-icon-lg"><i class="fas fa-truck"></i></div>
                    <div class="stat-info">
                        <div class="stat-number-lg" id="todayPendingCount">${todayPendingCount}</div>
                        <div class="stat-label-sm">今日待配送</div>
                    </div>
                    <div class="stat-tag pending-tag">待處理</div>
                </div>
                <div class="stat-card-cyan">
                    <div class="stat-icon-lg"><i class="fas fa-map-marked-alt"></i></div>
                    <div class="stat-info">
                        <div class="stat-number-lg">${deliveries.length}</div>
                        <div class="stat-label-sm">配送路線數</div>
                    </div>
                    <div class="stat-tag route-tag">今日路線</div>
                </div>
                <div class="stat-card-orange">
                    <div class="stat-icon-lg"><i class="fas fa-pause-circle"></i></div>
                    <div class="stat-info">
                        <div class="stat-number-lg" id="todayPausedCount">${todayPausedCount}</div>
                        <div class="stat-label-sm">今日暫停用戶</div>
                    </div>
                    <div class="stat-tag paused-tag">已暫停</div>
                </div>
                <div class="stat-card-green">
                    <div class="stat-icon-lg"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-info">
                        <div class="stat-number-lg" id="completionRate">${completionRate}%</div>
                        <div class="stat-label-sm">完成率</div>
                    </div>
                    <div class="stat-tag rate-tag">即時更新</div>
                </div>
            </div>
            
            <div class="search-toolbar">
                <div class="search-wrapper">
                    <i class="fas fa-search search-icon"></i>
                    <input type="text" id="searchPhoneInput" placeholder="輸入手機號碼搜索..." class="search-input-modern">
                    <button class="search-clear" id="clearSearchBtn" style="display: none;"><i class="fas fa-times"></i></button>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button class="btn-modern btn-refresh" onclick="loadDeliveriesPage()">
                        <i class="fas fa-sync-alt"></i> 刷新
                    </button>
                    <button class="btn-modern btn-submit-all" id="submitAllBtn" style="background: linear-gradient(135deg, #8fcf9f, #6fb87f);">
                        <i class="fas fa-check-double"></i> 今日配送完畢
                    </button>
                </div>
            </div>
            
            <div class="delivery-table-modern">
                <div class="table-header">
                    <div class="th" style="width: 18%"><i class="fas fa-user-circle"></i> 用戶信息</div>
                    <div class="th" style="width: 15%"><i class="fas fa-phone-alt"></i> 聯繫方式</div>
                    <div class="th" style="width: 27%"><i class="fas fa-location-dot"></i> 配送地址</div>
                    <div class="th" style="width: 20%"><i class="fas fa-chart-line"></i> 配送進度</div>
                    <div class="th" style="width: 20%"><i class="fas fa-cog"></i> 操作</div>
                </div>
                <div id="deliveriesTableBody" class="table-body">
                    ${tableRowsHtml}
                </div>
            </div>
            
            ${deliveries.length === 0 ? '<div class="empty-modern"><i class="fas fa-check-circle"></i><h4>今日暫無配送任務</h4><p>所有配送已完成或今日無需配送</p></div>' : ''}
            
            <div class="info-modern">
                <i class="fas fa-lightbulb"></i>
                <span>點擊「送達」臨時標記 | 點擊「暫停」變灰色可恢復 | 完成後點擊「今日配送完畢」批量保存</span>
            </div>
        </div>
    `;
    
    // 綁定搜索事件
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
    
    var submitBtn = document.getElementById('submitAllBtn');
    if (submitBtn) {
        submitBtn.onclick = submitAllDeliveries;
    }
}

function renderTableRows(deliveries) {
    if (!deliveries || deliveries.length === 0) return '';
    
    var html = '';
    for (var i = 0; i < deliveries.length; i++) {
        var d = deliveries[i];
        var user = d.users;
        var sub = d.subscriptions;
        var isPaused = d.is_paused === true;
        var isTempDelivered = !isPaused && tempDeliveredIds.indexOf(d.id) !== -1;
        
        var mealsReceived = sub ? sub.meals_received : 0;
        var totalDays = sub ? sub.total_days : 0;
        var progressPercent = totalDays > 0 ? (mealsReceived / totalDays) * 100 : 0;
        var startDate = (sub && sub.start_date) ? formatDisplayDate(sub.start_date) : 'N/A';
        var endDate = (sub && sub.end_date) ? formatDisplayDate(sub.end_date) : 'N/A';
        var userName = user ? (user.full_name || 'N/A') : 'N/A';
        var userPhone = (user && user.phone) ? user.phone : '未設置';
        var userEmail = user ? (user.email || '未設置') : '未設置';
        var userAddress = user ? (user.address || '未設置地址') : '未設置地址';
        var userId = user ? user.id : '';
        var userInitial = userName ? userName.charAt(0).toUpperCase() : 'U';
        var remainingDays = totalDays - mealsReceived;
        
        // 暫停的行
        if (isPaused) {
            html += `
                <div class="table-row paused-row" data-delivery-id="${d.id}" data-user-id="${userId}" data-subscription-id="${d.subscription_id}" style="opacity: 0.6; background: #f5f5f5;">
                    <div class="td" style="width: 18%">
                        <div class="user-info-modern">
                            <div class="user-avatar-modern">${escapeHtml(userInitial)}</div>
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
                        <button class="action-pause-restore" onclick="restoreDelivery('${d.id}', '${userId}', '${d.subscription_id}', ${d.meal_number || 1})" style="background: #4a7cff; border: none; padding: 8px 16px; border-radius: 30px; color: white; font-size: 12px; cursor: pointer;">
                            <i class="fas fa-redo-alt"></i> 恢復
                        </button>
                    </div>
                </div>
            `;
            continue;
        }
        
        // 正常配送的行
        var deliverBtnText = isTempDelivered ? '✅ 已送達' : '🚚 送達';
        var deliverBtnDisabled = isTempDelivered ? 'disabled' : '';
        var deliverBtnStyle = isTempDelivered ? 'opacity:0.6; cursor:not-allowed; background:#a0a0a0;' : '';
        var rowStyle = isTempDelivered ? 'opacity:0.7; background:#f0f0f0;' : '';
        
        html += `
            <div class="table-row" data-delivery-id="${d.id}" data-user-id="${userId}" data-subscription-id="${d.subscription_id}" style="${rowStyle}">
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
                        <button class="action-undo" onclick="undoTempDelivery('${d.id}')" title="撤回臨時標記">
                            <i class="fas fa-undo-alt"></i> 撤回
                        </button>
                        <button class="action-pause" onclick="pauseDelivery('${d.id}', '${userId}', '${d.subscription_id}')" title="今日暫停">
                            <i class="fas fa-pause-circle"></i> 暫停
                        </button>
                        <button class="action-deliver" onclick="tempMarkAsDelivered('${d.id}')" title="標記送達" ${deliverBtnDisabled} style="${deliverBtnStyle}">
                            <i class="fas fa-check-circle"></i> ${deliverBtnText}
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

// ========== 核心修復：點擊送達 ==========
function tempMarkAsDelivered(deliveryId) {
    // 檢查是否已經標記過
    if (tempDeliveredIds.indexOf(deliveryId) !== -1) {
        showToast('已經標記過了', 'warning');
        return;
    }
    
    // 檢查是否可以標記（不能是暫停的）
    var delivery = currentDeliveries.find(function(d) { return d.id === deliveryId; });
    if (!delivery) {
        showToast('配送記錄不存在', 'error');
        return;
    }
    if (delivery.is_paused) {
        showToast('暫停的配送不能標記送達', 'warning');
        return;
    }
    
    // 添加到臨時標記列表
    tempDeliveredIds.push(deliveryId);
    
    // 更新UI：改變行樣式
    var row = document.querySelector('.table-row[data-delivery-id="' + deliveryId + '"]');
    if (row) {
        row.style.opacity = '0.7';
        row.style.background = '#f0f0f0';
        var deliverBtn = row.querySelector('.action-deliver');
        if (deliverBtn) {
            deliverBtn.innerHTML = '<i class="fas fa-check-circle"></i> ✅ 已送達';
            deliverBtn.disabled = true;
            deliverBtn.style.opacity = '0.6';
            deliverBtn.style.cursor = 'not-allowed';
        }
        var undoBtn = row.querySelector('.action-undo');
        if (undoBtn) undoBtn.style.opacity = '1';
    }
    
    // ========== 核心修復：重新計算待配送數量 ==========
    recalcPendingCount();
    
    showToast('已標記送達，待配送數量 -1', 'success');
}

// ========== 核心修復：撤回送達 ==========
function undoTempDelivery(deliveryId) {
    var index = tempDeliveredIds.indexOf(deliveryId);
    if (index === -1) {
        showToast('尚未標記送達', 'warning');
        return;
    }
    
    // 從臨時標記列表中移除
    tempDeliveredIds.splice(index, 1);
    
    // 更新UI
    var row = document.querySelector('.table-row[data-delivery-id="' + deliveryId + '"]');
    if (row) {
        row.style.opacity = '1';
        row.style.background = '';
        var deliverBtn = row.querySelector('.action-deliver');
        if (deliverBtn) {
            deliverBtn.innerHTML = '<i class="fas fa-check-circle"></i> 🚚 送達';
            deliverBtn.disabled = false;
            deliverBtn.style.opacity = '1';
            deliverBtn.style.cursor = 'pointer';
        }
        var undoBtn = row.querySelector('.action-undo');
        if (undoBtn) undoBtn.style.opacity = '0.5';
    }
    
    // ========== 核心修復：重新計算待配送數量 ==========
    recalcPendingCount();
    
    showToast('已撤回標記，待配送數量 +1', 'info');
}

// 暫停配送
async function pauseDelivery(deliveryId, userId, subscriptionId) {
    if (!confirm('暫停後今日配送將取消，訂閱週期順延一天，確定暫停嗎？')) return;
    
    var btn = event.target;
    var originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    try {
        var { data: delivery } = await supabaseClient
            .from('deliveries')
            .select('delivery_date, meal_number')
            .eq('id', deliveryId)
            .single();
        
        if (!delivery) throw new Error('配送記錄不存在');
        
        // 刪除配送記錄
        await supabaseClient.from('deliveries').delete().eq('id', deliveryId);
        
        // 添加暫停記錄
        await supabaseClient.from('delivery_pauses').insert({
            user_id: userId,
            delivery_id: deliveryId,
            pause_date: getTodayString(),
            original_meal_number: delivery.meal_number,
            subscription_id: subscriptionId,
            created_at: new Date()
        });
        
        // 更新訂閱週期
        var { data: subscription } = await supabaseClient
            .from('subscriptions')
            .select('end_date, total_days')
            .eq('id', subscriptionId)
            .single();
        
        if (subscription) {
            var newEndDate = new Date(subscription.end_date);
            newEndDate.setDate(newEndDate.getDate() + 1);
            
            await supabaseClient.from('subscriptions').update({ 
                end_date: newEndDate.toISOString().split('T')[0],
                total_days: subscription.total_days + 1
            }).eq('id', subscriptionId);
        }
        
        // 如果這個配送之前被臨時標記過，需要從臨時標記中移除
        var tempIndex = tempDeliveredIds.indexOf(deliveryId);
        if (tempIndex !== -1) {
            tempDeliveredIds.splice(tempIndex, 1);
        }
        
        // 更新本地數據
        var deliveryIndex = currentDeliveries.findIndex(function(d) { return d.id === deliveryId; });
        if (deliveryIndex !== -1) {
            currentDeliveries[deliveryIndex].is_paused = true;
        }
        
        // 更新暫停計數
        todayPausedCount++;
        var pausedElement = document.getElementById('todayPausedCount');
        if (pausedElement) pausedElement.innerText = todayPausedCount;
        
        // 重新計算待配送
        recalcPendingCount();
        
        // 重新渲染該行
        var row = document.querySelector('.table-row[data-delivery-id="' + deliveryId + '"]');
        if (row) {
            row.style.opacity = '0.6';
            row.style.background = '#f5f5f5';
            var actionCell = row.querySelector('.action-td');
            if (actionCell) {
                actionCell.innerHTML = `
                    <button class="action-pause-restore" onclick="restoreDelivery('${deliveryId}', '${userId}', '${subscriptionId}', ${delivery.meal_number})" 
                        style="background: #4a7cff; border: none; padding: 8px 16px; border-radius: 30px; color: white; font-size: 12px; cursor: pointer;">
                        <i class="fas fa-redo-alt"></i> 恢復
                    </button>
                `;
            }
        }
        
        showToast('已暫停今日配送，訂閱週期已順延', 'success');
        
    } catch (err) {
        console.error('Error pausing delivery:', err);
        showToast('操作失敗: ' + err.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// 恢復配送
async function restoreDelivery(deliveryId, userId, subscriptionId, originalMealNumber) {
    if (!confirm('恢復後將重新建立今日配送任務，訂閱週期將減少一天，確定恢復嗎？')) return;
    
    try {
        var { data: subscription } = await supabaseClient
            .from('subscriptions')
            .select('end_date, total_days')
            .eq('id', subscriptionId)
            .single();
        
        if (subscription) {
            var newEndDate = new Date(subscription.end_date);
            newEndDate.setDate(newEndDate.getDate() - 1);
            
            await supabaseClient.from('subscriptions').update({ 
                end_date: newEndDate.toISOString().split('T')[0],
                total_days: subscription.total_days - 1
            }).eq('id', subscriptionId);
        }
        
        await supabaseClient.from('delivery_pauses').delete().eq('delivery_id', deliveryId);
        
        var todayStr = getTodayString();
        await supabaseClient.from('deliveries').insert({
            id: deliveryId,
            user_id: userId,
            subscription_id: subscriptionId,
            delivery_date: todayStr,
            status: 'pending',
            meal_number: originalMealNumber,
            created_at: new Date()
        });
        
        // 更新暫停計數
        if (todayPausedCount > 0) todayPausedCount--;
        var pausedElement = document.getElementById('todayPausedCount');
        if (pausedElement) pausedElement.innerText = todayPausedCount;
        
        showToast('已恢復今日配送，訂閱週期已縮減', 'success');
        loadDeliveriesPage();
        
    } catch (err) {
        console.error('Error restoring delivery:', err);
        showToast('恢復失敗: ' + err.message, 'error');
    }
}

// 提交所有配送
async function submitAllDeliveries() {
    if (tempDeliveredIds.length === 0) {
        showToast('沒有需要提交的配送記錄', 'warning');
        return;
    }
    
    if (!confirm('確定要提交所有已標記「送達」的配送記錄嗎？')) return;
    
    var submitBtn = document.getElementById('submitAllBtn');
    var originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';
        submitBtn.disabled = true;
    }
    
    var successCount = 0;
    var failCount = 0;
    
    for (var i = 0; i < tempDeliveredIds.length; i++) {
        var deliveryId = tempDeliveredIds[i];
        var row = document.querySelector('.table-row[data-delivery-id="' + deliveryId + '"]');
        if (!row) continue;
        
        var userId = row.getAttribute('data-user-id');
        var subscriptionId = row.getAttribute('data-subscription-id');
        
        try {
            await supabaseClient.from('deliveries').update({ status: 'delivered' }).eq('id', deliveryId);
            
            var { data: sub } = await supabaseClient
                .from('subscriptions')
                .select('meals_received')
                .eq('id', subscriptionId)
                .single();
            
            if (sub) {
                var newCount = (sub.meals_received || 0) + 1;
                await supabaseClient.from('subscriptions').update({ meals_received: newCount }).eq('id', subscriptionId);
            }
            successCount++;
        } catch (err) {
            console.error('提交失敗:', deliveryId, err);
            failCount++;
        }
    }
    
    if (submitBtn) {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
    
    if (failCount === 0) {
        showToast('全部配送已提交成功！共 ' + successCount + ' 筆', 'success');
    } else {
        showToast('提交完成：成功 ' + successCount + ' 筆，失敗 ' + failCount + ' 筆', 'warning');
    }
    
    tempDeliveredIds = [];
    loadDeliveriesPage();
    
    var dashboardPage = document.getElementById('page_dashboard');
    if (dashboardPage && dashboardPage.classList && dashboardPage.classList.contains('active')) {
        if (typeof loadDashboard === 'function') loadDashboard();
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

function showToast(message, type) {
    var toast = document.createElement('div');
    toast.className = 'toast-message';
    var iconClass = type === 'error' ? 'fa-exclamation-circle' : (type === 'warning' ? 'fa-exclamation-triangle' : 'fa-check-circle');
    var bgColor = type === 'error' ? '#e87a8a' : (type === 'warning' ? '#e8a878' : '#6fb87f');
    toast.innerHTML = '<i class="fas ' + iconClass + '"></i> ' + message;
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:' + bgColor + ';color:white;padding:12px 20px;border-radius:40px;z-index:2000;animation:slideIn 0.3s ease;';
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3000);
}