// ============================================
// 本地認證系統（不使用 Supabase Auth）
// ============================================

// 註冊功能
async function register() {
    const fullName = document.getElementById('fullName').value;
    const phone = document.getElementById('phone').value;
    const address = document.getElementById('address').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!fullName || !phone || !address || !email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Creating account...';
    btn.disabled = true;
    
    try {
        // 檢查郵箱是否已存在
        const { data: existingUsers } = await supabaseClient
            .from('users')
            .select('email')
            .eq('email', email);
        
        if (existingUsers && existingUsers.length > 0) {
            alert('Email already registered');
            return;
        }
        
        // 生成唯一 ID
        const userId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        
        // 儲存用戶到 Supabase
        const { error: insertError } = await supabaseClient
            .from('users')
            .insert({
                id: userId,
                full_name: fullName,
                phone: phone,
                address: address,
                email: email,
                password: btoa(password), // 簡單編碼（正式環境請用更安全的方式）
                created_at: new Date()
            });
        
        if (insertError) {
            console.error('Insert error:', insertError);
            alert('Registration failed: ' + insertError.message);
            return;
        }
        
        alert('Registration successful! Please login');
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
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Logging in...';
    btn.disabled = true;
    
    try {
        // 從 Supabase 驗證用戶
        const { data: users, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password', btoa(password));
        
        if (error) {
            alert('Login failed: ' + error.message);
            return;
        }
        
        if (!users || users.length === 0) {
            alert('Invalid email or password');
            return;
        }
        
        const user = users[0];
        
        // 儲存登入狀態到 localStorage
        localStorage.setItem('currentUser', JSON.stringify({
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            phone: user.phone,
            address: user.address
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