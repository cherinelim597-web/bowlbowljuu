// ============================================
// 時間工具函數 - 馬來西亞吉隆坡時間 (UTC+8)
// ============================================

// 馬來西亞時區
const MALAYSIA_TIMEZONE = 'Asia/Kuala_Lumpur';

// 獲取當前馬來西亞時間的 Date 對象
function getMalaysiaDate() {
    const now = new Date();
    const malaysiaTime = now.toLocaleString('en-US', { timeZone: MALAYSIA_TIMEZONE });
    return new Date(malaysiaTime);
}

// 格式化日期 (YYYY-MM-DD) - 用於數據庫存儲
function formatMalaysiaDate(date) {
    const d = date ? new Date(date) : getMalaysiaDate();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 格式化日期顯示 (YYYY/MM/DD)
function formatDisplayDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

// 格式化完整日期時間 (YYYY/MM/DD HH:MM:SS)
function formatFullDateTime(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// 獲取今天的日期字符串 (YYYY-MM-DD)
function getTodayString() {
    return formatMalaysiaDate();
}

// 獲取明天的日期字符串
function getTomorrowString() {
    const date = getMalaysiaDate();
    date.setDate(date.getDate() + 1);
    return formatMalaysiaDate(date);
}

// 獲取後天的日期字符串
function getDayAfterTomorrowString() {
    const date = getMalaysiaDate();
    date.setDate(date.getDate() + 2);
    return formatMalaysiaDate(date);
}

// 判斷日期是否為今天
function isToday(dateStr) {
    const today = getTodayString();
    const compareDate = formatMalaysiaDate(new Date(dateStr));
    return today === compareDate;
}

// 計算天數差
function daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// 獲取當前時間戳（馬來西亞時間）
function getMalaysiaTimestamp() {
    const date = getMalaysiaDate();
    return date.toISOString();
}