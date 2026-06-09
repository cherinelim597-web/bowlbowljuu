// ============================================
// 本地認證系統（不使用 Supabase Auth）
// 只需要姓名，郵箱選填
// ============================================

// 生成簡短用戶ID
function generateUserId(name) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6);
    const cleanName = name.replace(/\s/g, '').toLowerCase().substring(0, 6);
    return `${cleanName}_${timestamp}_${random}`;
}

// 註冊功能
async function register() {
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    
    if (!fullName || fullName.trim() === '') {
        alert('Please enter your name / 請輸入您的姓名');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Creating account...';
    btn.disabled = true;
    
    try {
        // 檢查姓名是否已存在（簡單檢查，允許重名但會提示）
        const { data: existingUsers } = await supabaseClient
            .from('users')
            .select('full_name, email')
            .eq('full_name', fullName.trim());
        
        // 生成唯一 ID
        const userId = generateUserId(fullName);
        
        // 儲存用戶到 Supabase
        const { error: insertError } = await supabaseClient
            .from('users')
            .insert({
                id: userId,
                full_name: fullName.trim(),
                email: email || null,
                created_at: new Date()
            });
        
        if (insertError) {
            console.error('Insert error:', insertError);
            alert('Registration failed: ' + insertError.message);
            return;
        }
        
        alert('Registration successful! Please login / 註冊成功！請登入');
        location.href = "login.html";
        
    } catch (err) {
        console.error('Registration error:', err);
        alert('Registration failed, please try again');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 登入功能（只需要姓名）
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
        // 從 Supabase 查找用戶（按姓名，可選郵箱）
        let query = supabaseClient
            .from('users')
            .select('*')
            .eq('full_name', fullName.trim());
        
        // 如果填了郵箱，也匹配郵箱
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
        
        // 儲存登入狀態到 localStorage
        localStorage.setItem('currentUser', JSON.stringify({
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            phone: user.phone || '',
            address: user.address || ''
        }));
        
        // 檢查是否有訂閱
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