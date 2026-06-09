// supabase.js - 確認是這個配置
const SUPABASE_URL = "https://otvxjshpbldqnrdnmfsn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Li8pGTW9YrMwtRY-ICPkGQ_ceEBkAyt";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);