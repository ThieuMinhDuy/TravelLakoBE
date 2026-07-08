import mongoose from 'mongoose';

const favoriteSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    itemType: {
      type: String,
      required: true,
      enum: ['Attraction', 'Hotel', 'Restaurant', 'Cafe'],
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'itemType',
    },
  },
  {
    timestamps: true,
  }
);

// Tránh việc 1 user lưu trùng 1 địa điểm nhiều lần trong bảng yêu thích
favoriteSchema.index({ user: 1, itemType: 1, itemId: 1 }, { unique: true });

const Favorite = mongoose.model('Favorite', favoriteSchema);

export default Favorite;
