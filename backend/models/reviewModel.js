import mongoose from 'mongoose';

const reviewSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    itemType: {
      type: String,
      required: [true, 'Thiếu loại địa điểm'],
      enum: { values: ['Attraction', 'Hotel', 'Restaurant', 'Cafe'], message: 'Loại địa điểm không hợp lệ' },
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Thiếu địa điểm được đánh giá'],
      refPath: 'itemType',
    },
    rating: {
      type: Number,
      required: [true, 'Vui lòng chọn số sao'],
      min: [1, 'Số sao phải từ 1 đến 5'],
      max: [5, 'Số sao phải từ 1 đến 5'],
    },
    comment: {
      type: String,
      required: [true, 'Vui lòng nhập nội dung đánh giá'],
    },
  },
  {
    timestamps: true,
  }
);

const Review = mongoose.model('Review', reviewSchema);

export default Review;
