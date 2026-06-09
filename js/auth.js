// ============================================
// 本地認證系統（不使用 Supabase Auth）
// 邀請碼可選填，新用戶自動生成邀請碼
// ============================================

// 生成唯一邀請碼（6位字母數字混合）
function generateInvitationCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// 生成簡短用戶ID
function generateUserId(name) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6);
    const cleanName = name.replace(/\s/g, '').toLowerCase().substring(0, 6);
    return `${cleanName}_${timestamp}_${random}`;
}

// 驗證邀請碼（檢查是否存在且未被使用）
async function validateInvitationCode(code) {
    if (!code || code.trim() === '') {
        return { valid: true, isUsed: false }; // 沒有邀請碼也可以註冊
    }
    
    const { data, error } = await supabaseClient
        .from('invitation_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('status', 'active')
        .maybeSingle();
    
    if (error) {
        console.error('Validation error:', error);
        return { valid: false, error: error.message };
    }
    
    if (!data) {
        return { valid: false, error: 'Invalid invitation code' };
    }
    
    return { valid: true, data: data, isUsed: false };
}

// 使用邀請碼（標記為已使用）
async function useInvitationCode(code, userId, userName) {
    if (!code || code.trim() === '') return;
    
    const { error } = await supabaseClient
        .from('invitation_codes')
        .update({
            used_by: userId,
            used_at: new Date(),
            status: 'used'
        })
        .eq('code', code.toUpperCase());
    
    if (error) {
        console.error('Error using invitation code:', error);
    }
}

// 為新用戶生成唯一的邀請碼（確保不重複）
async function generateUniqueInvitationCode(userId) {
    let code = generateInvitationCode();
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (!isUnique && attempts < maxAttempts) {
        // 檢查 users 表中是否已存在該邀請碼
        const { data: existingUser } = await supabaseClient
            .from('users')
            .select('invitation_code')
            .eq('invitation_code', code)
            .maybeSingle();
        
        // 檢查 invitation_codes 表中是否已存在
        const { data: existingCode } = await supabaseClient
            .from('invitation_codes')
            .select('code')
            .eq('code', code)
            .maybeSingle();
        
        if (!existingUser && !existingCode) {
            isUnique = true;
        } else {
            code = generateInvitationCode();
            attempts++;
        }
    }
    
    return code;
}

// 儲存新用戶的邀請碼
async function saveUserInvitationCode(userId, code) {
    const { error } = await supabaseClient
        .from('invitation_codes')
        .insert({
            code: code,
            created_by: userId,
            status: 'active',
            created_at: new Date()
        });
    
    if (error) {
        console.error('Error saving invitation code:', error);
        return false;
    }
    
    // 同時更新 users 表
    const { error: updateError } = await supabaseClient
        .from('users')
        .update({ invitation_code: code })
        .eq('id', userId);
    
    if (updateError) {
        console.error('Error updating user invitation code:', updateError);
        return false;
    }
    
    return true;
}

// 註冊功能
async function register() {
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const invitationCode = document.getElementById('invitationCode').value;
    
    if (!fullName || fullName.trim() === '') {
        alert('Please enter your name / 請輸入您的姓名');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Creating account...';
    btn.disabled = true;
    
    try {
        // 1. 檢查姓名是否已存在
        const { data: existingUsers } = await supabaseClient
            .from('users')
            .select('full_name')
            .eq('full_name', fullName.trim());
        
        if (existingUsers && existingUsers.length > 0) {
            alert('This name is already taken. Please use a different name / 該姓名已被使用');
            return;
        }
        
        // 2. 驗證邀請碼（如果有填寫）
        let referrerId = null;
        if (invitationCode && invitationCode.trim() !== '') {
            const validation = await validateInvitationCode(invitationCode);
            if (!validation.valid) {
                alert('Invalid invitation code: ' + validation.error);
                return;
            }
            referrerId = validation.data.created_by;
        }
        
        // 3. 生成用戶ID和邀請碼
        const userId = generateUserId(fullName);
        const userInvitationCode = await generateUniqueInvitationCode(userId);
        
        // 4. 儲存用戶到 Supabase
        const { error: insertError } = await supabaseClient
            .from('users')
            .insert({
                id: userId,
                full_name: fullName.trim(),
                email: email || null,
                invitation_code: userInvitationCode,
                used_invitation_code: invitationCode || null,
                referred_by: referrerId,
                created_at: new Date()
            });
        
        if (insertError) {
            console.error('Insert error:', insertError);
            alert('Registration failed: ' + insertError.message);
            return;
        }
        
        // 5. 儲存邀請碼到 invitation_codes 表
        await saveUserInvitationCode(userId, userInvitationCode);
        
        // 6. 如果有使用邀請碼，標記為已使用
        if (invitationCode && invitationCode.trim() !== '') {
            await useInvitationCode(invitationCode, userId, fullName);
        }
        
        const message = `Registration successful!\n\nYour invitation code is: ${userInvitationCode}\n\nShare this code to invite friends!\n\n註冊成功！您的邀請碼是：${userInvitationCode}`;
        alert(message);
        location.href = "login.html";
        
    } catch (err) {
        console.error('Registration error:', err);
        alert('Registration failed, please try again');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 登入功能
async function login() {
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    
    if (!fullName || fullName.trim() === '') {
        alert('Please enter your name / 請輸入您的姓名');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Logging in...';
    btn.disabled = true;
    
    try {
        let query = supabaseClient
            .from('users')
            .select('*')
            .eq('full_name', fullName.trim());
        
        if (email && email.trim() !== '') {
            query = query.eq('email', email.trim());
        }
        
        const { data: users, error } = await query;
        
        if (error) {
            alert('Login failed: ' + error.message);
            return;
        }
        
        if (!users || users.length === 0) {
            alert('User not found. Please register first / 用戶不存在，請先註冊');
            return;
        }
        
        const user = users[0];
        
        localStorage.setItem('currentUser', JSON.stringify({
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            phone: user.phone || '',
            address: user.address || '',
            invitation_code: user.invitation_code || ''
        }));
        
        const { data: subscription } = await supabaseClient
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();
        
        if (subscription) {
            location.href = "dashboard.html";
        } else {
            location.href = "onboarding.html";
        }
        
    } catch (err) {
        console.error('Login error:', err);
        alert('Login failed, please try again');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 登出功能
function logout() {
    localStorage.removeItem('currentUser');
    location.href = 'login.html';
}

// 獲取當前登入用戶
function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}

// 檢查是否已登入
function checkAuth() {
    const user = getCurrentUser();
    const publicPages = ['login.html', 'register.html', 'index.html', 'admin-login.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (!user && !publicPages.includes(currentPage)) {
        location.href = 'login.html';
    }
    return user;
}