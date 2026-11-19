/**
 * Escape các ký tự đặc biệt của RegExp trong chuỗi người dùng nhập,
 * để dùng an toàn trong `$regex` / `new RegExp(...)`.
 * VD: "Phở (Hà Nội)" -> "Phở \(Hà Nội\)"
 * @param {unknown} value
 * @returns {string}
 */
const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default escapeRegex;
