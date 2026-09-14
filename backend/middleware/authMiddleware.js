import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';

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
      res.status(401);
      throw new Error('Not authorized, token failed');
    }

    req.user = await User.findById(decoded.userId).select('-password');

    if (!req.user) {
      res.status(401);
      throw new Error('Người dùng không tồn tại hoặc đã bị xóa!');
    }

    if (req.user.isBlocked) {
      res.status(403);
      throw new Error('Tài khoản của bạn đã bị khóa!');
    }

    next();
  } else {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403);
    throw new Error('Not authorized as an admin');
  }
};

export { protect, admin };
