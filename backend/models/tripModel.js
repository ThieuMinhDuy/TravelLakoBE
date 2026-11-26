import mongoose from 'mongoose';

const placeInScheduleSchema = mongoose.Schema({
  placeType: {
    type: String,
    required: [true, 'Thiếu loại địa điểm trong lịch trình'],
    enum: { values: ['Attraction', 'Hotel', 'Restaurant', 'Cafe'], message: 'Loại địa điểm không hợp lệ' },
  },
  placeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Thiếu địa điểm trong lịch trình'],
    refPath: 'schedule.places.placeType',
  },
  order: {
    type: Number,
    required: [true, 'Thiếu thứ tự địa điểm trong lịch trình'],
  },
  note: {
    type: String,
    default: '',
  },
  visited: {
    type: Boolean,
    default: false,
  },
  checkInTime: {
    type: Date,
  },
});

const dayScheduleSchema = mongoose.Schema({
  day: {
    type: Number,
    required: [true, 'Thiếu số thứ tự ngày trong lịch trình'],
  },
  date: {
    type: Date,
    required: [true, 'Thiếu ngày trong lịch trình'],
  },
  places: [placeInScheduleSchema],
});

const tripSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Vui lòng nhập tên chuyến đi'],
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
      required: [true, 'Vui lòng chọn thành phố'],
    },
    startDate: {
      type: Date,
      required: [true, 'Vui lòng chọn ngày bắt đầu'],
    },
    endDate: {
      type: Date,
      required: [true, 'Vui lòng chọn ngày kết thúc'],
    },
    budget: {
      type: Number,
      default: 0,
    },
    schedule: [dayScheduleSchema],
    diary: {
      notes: {
        type: String,
        default: '',
      },
      photos: {
        type: [String],
        default: [],
      },
    },
  },
  {
    timestamps: true,
  }
);

const Trip = mongoose.model('Trip', tripSchema);

export default Trip;
