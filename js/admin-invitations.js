// ============================================
// 邀請記錄管理模組
// ============================================

// ADMIN_EMAIL 已在 admin-common.js 中定義

// 獎勵配置
const REWARDS_CONFIG = [
    { invites: 2, type: 'discount', plan: '1month', discount: 20, description: '1 Month Plan 20% OFF' },
    { invites: 5, type: 'discount', plan: '1month', discount: 35, description: '1 Month Plan 35% OFF' },
    { invites: 8, type: 'discount', plan: '1month', discount: 50, description: '1 Month Plan 50% OFF' },
    { invites: 10, type: 'special', plan: '3month', discount: 20, description: '3 Month Plan 20% OFF + Mystery Gift' },
    { invites: 20, type: 'ultimate', description: 'Partnership Opportunity' }
];

async function loadInvitationsPage() {
    const container = document.getElementById('page_invitations');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // 獲取所有用戶（排除管理員）
        const { data: users, error } = await supabaseClient
            .from('users')
            .select('*')
            .not('email', 'eq', ADMIN_EMAIL)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!users || users.length === 0) {
            container.innerHTML = '<div class="table-container"><p>暫無用戶</p></div>';
            return;
        }
        
        // 獲取每個用戶的邀請數據
        const userInvitationData = [];
        for (const user of users) {
            // 獲取使用該用戶邀請碼註冊的人數
            const { data: invitedUsers } = await supabaseClient
                .from('users')
                .select('id, created_at')
                .eq('referred_by', user.id);
            
            const invitedCount = invitedUsers?.length || 0;
            
            // 獲取該用戶已兌換的獎勵
            const { data: redemptions } = await supabaseClient
                .from('reward_redemptions')
                .select('*')
                .eq('user_id', user.id);
            
            // 計算達標情況
            const achievedRewards = [];
            const nextReward = { invites: null, description: null };
            
            for (const reward of REWARDS_CONFIG) {
                if (invitedCount >= reward.invites) {
                    const isRedeemed = redemptions?.some(r => r.reward_invites === reward.invites);
                    achievedRewards.push({
                        ...reward,
                        isRedeemed: isRedeemed,
                        redeemedAt: redemptions?.find(r => r.reward_invites === reward.invites)?.created_at
                    });
                } else if (!nextReward.invites || reward.invites < nextReward.invites) {
                    nextReward.invites = reward.invites;
                    nextReward.description = reward.description;
                    nextReward.needed = reward.invites - invitedCount;
                }
            }
            
            userInvitationData.push({
                ...user,
                invitedCount,
                achievedRewards,
                nextReward,
                redemptions
            });
        }
        
        container.innerHTML = `
            <div class="table-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                    <h3>📋 邀請記錄管理 (共 ${users.length} 人)</h3>
                    <div>
                        <button class="btn-small" onclick="exportInvitationData()" style="background: #2d6a4f; margin-right: 10px;">
                            <i class="fas fa-download"></i> 導出數據
                        </button>
                        <button class="btn-small" onclick="refreshInvitationsPage()" style="background: #4a7cff;">
                            <i class="fas fa-sync-alt"></i> 刷新
                        </button>
                    </div>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; min-width: 1200px;">
                        <thead>
                            <tr>
                                <th>用戶信息</th>
                                <th>邀請人數</th>
                                <th>下一個里程碑</th>
                                <th>已解鎖獎勵</th>
                                <th>兌換狀態</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="invitationsTableBody"></tbody>
                    </table>
                </div>
            </div>
        `;
        
        const tbody = document.getElementById('invitationsTableBody');
        tbody.innerHTML = userInvitationData.map(user => {
            // 生成獎勵標籤
            const rewardsHtml = user.achievedRewards.map(reward => {
                let rewardText = '';
                if (reward.type === 'discount') {
                    rewardText = `${reward.discount}% OFF (${reward.plan === '1month' ? '1 Month' : '3 Month'})`;
                } else if (reward.type === 'special') {
                    rewardText = `🎁 20% OFF + Gift`;
                } else {
                    rewardText = `💎 Partnership`;
                }
                return `<div class="reward-tag">${rewardText}</div>`;
            }).join('');
            
            // 生成兌換狀態
            const redemptionHtml = user.achievedRewards.map(reward => {
                const status = reward.isRedeemed ? '✅ 已兌換' : '⏳ 待兌換';
                const statusClass = reward.isRedeemed ? 'badge-active' : 'badge-pending';
                const redeemBtn = !reward.isRedeemed ? `<button class="btn-small" style="margin-top: 5px; background: #c8a15e;" onclick="markRewardAsRedeemed('${user.id}', ${reward.invites})">手動標記</button>` : '';
                return `
                    <div style="margin-bottom: 8px;">
                        <span class="badge ${statusClass}">${status}</span>
                        ${redeemBtn}
                    </div>
                `;
            }).join('');
            
            // 計算進度條
            let progressHtml = '';
            if (user.nextReward.invites) {
                const progressPercent = (user.invitedCount / user.nextReward.invites) * 100;
                progressHtml = `
                    <div style="width: 100px; background: #1e2a3a; border-radius: 10px; height: 6px; margin-top: 8px;">
                        <div style="width: ${progressPercent}%; background: #c8a15e; border-radius: 10px; height: 6px;"></div>
                    </div>
                    <small>還差 ${user.nextReward.needed} 人</small>
                `;
            } else {
                progressHtml = '<small>🎉 已達最高里程碑</small>';
            }
            
            return `
                <tr>
                    <td>
                        <strong>${escapeHtml(user.full_name || 'N/A')}</strong><br>
                        <small style="color:#8a9abb;">ID: ${user.id.substring(0, 8)}...</small><br>
                        <small>📧 ${escapeHtml(user.email || 'N/A')}</small>
                    </td>
                    <td style="text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: #c8a15e;">${user.invitedCount}</div>
                        <small>${user.invitedCount === 1 ? 'person' : 'people'}</small>
                    </td>
                    <td>
                        <strong>${user.nextReward.invites ? `${user.nextReward.invites} 人` : '🏆 已完成'}</strong>
                        <div>${user.nextReward.description || '所有獎勵已解鎖'}</div>
                        ${progressHtml}
                    </td>
                    <td>
                        <div class="rewards-container">${rewardsHtml || '<small class="text-muted">—</small>'}</div>
                    </td>
                    <td>
                        <div class="redemption-container">${redemptionHtml || '<small class="text-muted">—</small>'}</div>
                    </td>
                    <td>
                        <button class="btn-icon" onclick="viewUserInvitationDetail('${user.id}')" title="查看詳情">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="sendRewardReminder('${user.id}', '${escapeHtml(user.full_name)}', ${user.invitedCount})" title="發送提醒">
                            <i class="fas fa-bell"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Invitations page error:', err);
        container.innerHTML = '<div class="table-container"><p>加載失敗</p></div>';
    }
}

// 查看用戶邀請詳情
async function viewUserInvitationDetail(userId) {
    const { data: user } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    const { data: invitedUsers } = await supabaseClient
        .from('users')
        .select('full_name, email, created_at')
        .eq('referred_by', userId)
        .order('created_at', { ascending: false });
    
    const { data: redemptions } = await supabaseClient
        .from('reward_redemptions')
        .select('*')
        .eq('user_id', userId);
    
    const invitedCount = invitedUsers?.length || 0;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <h3><i class="fas fa-user-friends"></i> 邀請詳情 - ${escapeHtml(user?.full_name)}</h3>
            <hr style="margin: 15px 0; border-color: #1e2a3a;">
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
                <div style="text-align: center; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 16px;">
                    <div style="font-size: 32px; font-weight: 700; color: #c8a15e;">${invitedCount}</div>
                    <div style="font-size: 12px; color: #8a9abb;">總邀請人數</div>
                </div>
                <div style="text-align: center; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 16px;">
                    <div style="font-size: 32px; font-weight: 700; color: #c8a15e;">${redemptions?.length || 0}</div>
                    <div style="font-size: 12px; color: #8a9abb;">已兌換獎勵</div>
                </div>
                <div style="text-align: center; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 16px;">
                    <div style="font-size: 32px; font-weight: 700; color: #c8a15e;">${invitedCount * 10}</div>
                    <div style="font-size: 12px; color: #8a9abb;">累計獎勵 (RM)</div>
                </div>
            </div>
            
            <h4>📋 已解鎖獎勵</h4>
            <div id="rewardListModal" style="margin-bottom: 20px;">
                ${generateRewardListForModal(REWARDS_CONFIG, invitedCount, redemptions)}
            </div>
            
            <h4>👥 邀請的用戶列表</h4>
            <div style="max-height: 300px; overflow-y: auto;">
                ${invitedUsers && invitedUsers.length > 0 ? invitedUsers.map(u => `
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span>${escapeHtml(u.full_name)}</span>
                        <span style="color: #8a9abb; font-size: 12px;">${new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                `).join('') : '<div style="text-align: center; padding: 20px; color: #8a9abb;">暫無邀請記錄</div>'}
            </div>
            
            <div style="margin-top: 20px;">
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">關閉</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function generateRewardListForModal(rewardsConfig, invitedCount, redemptions) {
    return rewardsConfig.map(reward => {
        const isAchieved = invitedCount >= reward.invites;
        const isRedeemed = redemptions?.some(r => r.reward_invites === reward.invites);
        
        let statusText = '';
        let statusClass = '';
        
        if (!isAchieved) {
            statusText = `🔒 未解鎖 (還差 ${reward.invites - invitedCount} 人)`;
            statusClass = 'badge-expired';
        } else if (isRedeemed) {
            statusText = '✅ 已兌換';
            statusClass = 'badge-active';
        } else {
            statusText = '🎯 待兌換';
            statusClass = 'badge-pending';
        }
        
        let rewardText = '';
        if (reward.type === 'discount') {
            rewardText = `${reward.discount}% OFF (${reward.plan === '1month' ? '1個月' : '3個月'})`;
        } else if (reward.type === 'special') {
            rewardText = `20% OFF + 神秘禮物`;
        } else {
            rewardText = `💎 入股資格`;
        }
        
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div>
                    <strong>邀請 ${reward.invites} 人</strong><br>
                    <small>${rewardText}</small>
                </div>
                <span class="badge ${statusClass}">${statusText}</span>
            </div>
        `;
    }).join('');
}

// 手動標記獎勵為已兌換
async function markRewardAsRedeemed(userId, rewardInvites) {
    if (!confirm(`確定標記「邀請 ${rewardInvites} 人」的獎勵為已兌換？`)) return;
    
    const { error } = await supabaseClient
        .from('reward_redemptions')
        .insert({
            user_id: userId,
            reward_invites: rewardInvites,
            reward_type: 'discount',
            status: 'redeemed',
            created_at: new Date(),
            redeemed_at: new Date()
        });
    
    if (error) {
        showToast('標記失敗: ' + error.message, 'error');
    } else {
        showToast('已標記為已兌換！');
        loadInvitationsPage();
    }
}

// 發送獎勵提醒
async function sendRewardReminder(userId, userName, invitedCount) {
    // 找出下一個未達標的獎勵
    let nextReward = null;
    for (const reward of REWARDS_CONFIG) {
        if (invitedCount < reward.invites) {
            nextReward = reward;
            break;
        }
    }
    
    if (!nextReward) {
        alert(`${userName} 已達成所有里程碑！`);
        return;
    }
    
    const remaining = nextReward.invites - invitedCount;
    const message = `🎉 ${userName}，您還差 ${remaining} 人就可以解鎖 ${nextReward.description}！繼續邀請朋友吧！`;
    
    if (confirm(`發送提醒給 ${userName}？\n\n${message}`)) {
        // 這裡可以集成郵件或推送通知
        // 目前先記錄到 console
        console.log(`Reminder sent to ${userName}: ${message}`);
        alert(`提醒已發送！（演示模式）`);
        showToast(`提醒已發送給 ${userName}`, 'success');
    }
}

// 導出邀請數據
async function exportInvitationData() {
    const { data: users } = await supabaseClient
        .from('users')
        .select('*')
        .not('email', 'eq', ADMIN_EMAIL);
    
    const csvData = [];
    csvData.push(['用戶名', '郵箱', '邀請人數', '已兌換獎勵', '累計獎勵(RM)', '註冊時間']);
    
    for (const user of users) {
        const { data: invitedUsers } = await supabaseClient
            .from('users')
            .select('id')
            .eq('referred_by', user.id);
        
        const invitedCount = invitedUsers?.length || 0;
        
        const { data: redemptions } = await supabaseClient
            .from('reward_redemptions')
            .select('*')
            .eq('user_id', user.id);
        
        csvData.push([
            user.full_name || 'N/A',
            user.email || 'N/A',
            invitedCount,
            redemptions?.length || 0,
            invitedCount * 10,
            user.created_at
        ]);
    }
    
    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invitation_records_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('導出成功');
}

function refreshInvitationsPage() {
    loadInvitationsPage();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}