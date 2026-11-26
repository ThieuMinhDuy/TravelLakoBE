import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vui lòng nhập họ tên'],
    },
    email: {
      type: String,
      required: [true, 'Vui lòng nhập email'],
      unique: true,
    },
    password: {
      type: String,
      required: false,
    },
    authType: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    googleId: {
      type: String,
      default: null,
    },
    avatar: {
      type: String,
      default: '',
    },
    // Ảnh bìa trang cá nhân (URL ảnh đã upload qua POST /api/upload)
    coverImage: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      enum: { values: ['Nam', 'Nữ', 'Khác', ''], message: 'Giới tính không hợp lệ' },
      default: '',
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    travelPreferences: {
      type: [String],
      default: [],
    },
    favoriteBudget: {
      type: String,
      enum: { values: ['Tiết kiệm', 'Trung bình', 'Cao cấp', ''], message: 'Mức ngân sách không hợp lệ' },
      default: '',
    },
    isVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    // OTP không bao giờ được trả ra ngoài: mọi truy vấn mặc định không lấy các field này.
    // Chỗ nào cần đọc/ghi OTP thì dùng .select(OTP_SELECT) (utils/otp.js).
    // Lưu ý: không dùng .select('-otp') vì sẽ xung đột (Path collision) với select: false bên dưới.
    otp: {
      code: {
        type: String,
        default: null,
        select: false,
      },
      expiresAt: {
        type: Date,
        default: null,
        select: false,
      },
      // Số lần nhập sai mã hiện tại (quá giới hạn thì mã bị hủy)
      attempts: {
        type: Number,
        default: 0,
        select: false,
      },
      // Thời điểm gửi mã gần nhất (dùng cho cooldown gửi lại)
      lastSentAt: {
        type: Date,
        default: null,
        select: false,
      },
    },
    isAdmin: {
      type: Boolean,
      required: true,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password using bcrypt
userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

export default User;
