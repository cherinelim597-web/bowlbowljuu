// Register Function / 註冊功能
async function register() {
    const fullName = document.getElementById('fullName').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Form validation / 表單驗證
    if (!fullName || !phone || !email || !password) {
        alert('Please fill in all fields / 請填寫所有欄位');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters / 密碼長度至少需要6個字元');
        return;
    }
    
    // Phone validation (Taiwan format) / 電話驗證（台灣格式）
    const phoneClean = phone.replace(/\D/g, '');
    if (phoneClean.length < 9 || phoneClean.length > 10) {
        alert('Please enter a valid phone number / 請輸入有效的電話號碼');
        return;
    }
    
    // Show loading state / 顯示載入狀態
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Creating account... / 註冊中...';
    btn.disabled = true;
    
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    phone: phone
                }
            }
        });
        
        if (error) {
            if (error.message === 'User already registered') {
                alert('Email already registered / 此電子郵件已註冊');
            } else {
                alert(error.message);
            }
            return;
        }
        
        // Save profile to database / 儲存個人資料到資料庫
        const { error: profileError } = await supabaseClient
            .from('profiles')
            .insert({
                id: data.user.id,
                full_name: fullName,
                phone: phone,
                email: email,
                created_at: new Date()
            });
        
        if (profileError) {
            console.error('Profile error / 個人資料錯誤:', profileError);
        }
        
        alert('Registration successful! Please login / 註冊成功！請登入');
        location.href = "login.html";
        
    } catch (err) {
        console.error('Registration error / 註冊錯誤:', err);
        alert('Registration failed, please try again / 註冊失敗，請稍後再試');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Login Function / 登入功能
async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        alert('Please enter email and password / 請填寫電子郵件和密碼');
        return;
    }
    
    // Show loading state / 顯示載入狀態
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Logging in... / 登入中...';
    btn.disabled = true;
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            if (error.message === 'Invalid login credentials') {
                alert('Invalid email or password / 電子郵件或密碼錯誤');
            } else {
                alert(error.message);
            }
            return;
        }
        
        location.href = "dashboard.html";
        
    } catch (err) {
        console.error('Login error / 登入錯誤:', err);
        alert('Login failed, please try again / 登入失敗，請稍後再試');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}