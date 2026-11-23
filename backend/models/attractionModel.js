import mongoose from 'mongoose';

const attractionSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vui lòng nhập tên địa điểm'],
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
      required: [true, 'Vui lòng chọn thành phố'],
    },
    description: {
      type: String,
      default: '',
    },
    images: {
      type: [String],
      default: [],
    },
    admissionFee: {
      type: Number,
      default: 0,
      min: [0, 'Giá vé không được âm'],
    },
    address: {
      type: String,
      default: '',
    },
    coordinates: {
      lat: {
        type: Number,
        required: [true, 'Vui lòng nhập vĩ độ (lat) của địa điểm'],
        min: [-90, 'Vĩ độ (lat) phải từ -90 đến 90'],
        max: [90, 'Vĩ độ (lat) phải từ -90 đến 90'],
      },
      lng: {
        type: Number,
        required: [true, 'Vui lòng nhập kinh độ (lng) của địa điểm'],
        min: [-180, 'Kinh độ (lng) phải từ -180 đến 180'],
        max: [180, 'Kinh độ (lng) phải từ -180 đến 180'],
      },
    },
    rating: {
      type: Number,
      default: 0,
    },
    numReviews: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Attraction = mongoose.model('Attraction', attractionSchema);

export default Attraction;
