/**
 * Chuẩn hóa chuỗi để so khớp tên: bỏ dấu tiếng Việt, đ -> d, chữ thường, gộp khoảng trắng.
 * Ví dụ: "  Đà   Lạt " -> "da lat", "Da Lat" -> "da lat".
 * @param {unknown} value
 * @returns {string}
 */
export const toSearchKey = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
