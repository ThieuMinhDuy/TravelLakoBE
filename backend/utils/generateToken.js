import jwt from 'jsonwebtoken';

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Option cookie `jwt` dùng chung cho cả lúc set và lúc xóa.
 * - Production (mọi NODE_ENV khác 'development'): FE và BE khác domain → bắt buộc sameSite 'none' + secure (HTTPS).
 * - Development: trình duyệt từ chối cookie sameSite 'none' khi không secure,
 *   nên dùng 'lax' để cookie vẫn hoạt động trên http://localhost.
 * Lưu ý: muốn xóa cookie thì option phải khớp với lúc set.
 */
const getJwtCookieOptions = () => {
  // Giữ đúng điều kiện cũ: mọi môi trường KHÁC 'development' đều coi như production
  const isDevelopment = process.env.NODE_ENV === 'development';
  return {
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: isDevelopment ? 'lax' : 'none',
  };
};

const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

  res.cookie('jwt', token, {
    ...getJwtCookieOptions(),
    maxAge: COOKIE_MAX_AGE,
  });

  return token;
};

/** Xóa cookie `jwt` (dùng khi đăng xuất) */
const clearTokenCookie = (res) => {
  res.clearCookie('jwt', getJwtCookieOptions());
};

export { clearTokenCookie };
export default generateToken;
