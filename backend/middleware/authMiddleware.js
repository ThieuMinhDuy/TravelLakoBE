import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import { httpError, ERROR_CODES } from '../utils/httpError.js';

const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Check for token in cookie
  if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  // 2. Fallback to Bearer token in Authorization header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      console.error(error);
      throw httpError(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn, vui lòng đăng nhập lại', ERROR_CODES.TOKEN_INVALID);
    }

    req.user = await User.findById(decoded.userId).select('-password');

    if (!req.user) {
      throw httpError(res, 401, 'Người dùng không tồn tại hoặc đã bị xóa!', ERROR_CODES.USER_NOT_FOUND);
    }

    if (req.user.isBlocked) {
      throw httpError(res, 403, 'Tài khoản của bạn đã bị khóa!', ERROR_CODES.ACCOUNT_BLOCKED);
    }

    next();
  } else {
    throw httpError(res, 401, 'Vui lòng đăng nhập để tiếp tục', ERROR_CODES.AUTH_REQUIRED);
  }
});

const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    throw httpError(res, 403, 'Bạn không có quyền quản trị', ERROR_CODES.NOT_ADMIN);
  }
};

export { protect, admin };
