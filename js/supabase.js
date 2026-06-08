// Supabase Configuration / Supabase 配置
const SUPABASE_URL = "https://otvxjshpbldqnrdnmfsn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Li8pGTW9YrMwtRY-ICPkGQ_ceEBkAyt";

// Initialize Supabase Client / 初始化 Supabase 客戶端
if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded / Supabase 庫未加載');
}

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// Verify initialization / 驗證初始化
console.log('Supabase client initialized / Supabase 客戶端已初始化');