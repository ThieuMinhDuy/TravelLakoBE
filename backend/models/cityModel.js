import mongoose from 'mongoose';

const citySchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vui lòng nhập tên thành phố'],
      unique: true,
    },
    description: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    coordinates: {
      lat: {
        type: Number,
        required: [true, 'Vui lòng nhập vĩ độ (lat) của thành phố'],
        min: [-90, 'Vĩ độ (lat) phải từ -90 đến 90'],
        max: [90, 'Vĩ độ (lat) phải từ -90 đến 90'],
      },
      lng: {
        type: Number,
        required: [true, 'Vui lòng nhập kinh độ (lng) của thành phố'],
        min: [-180, 'Kinh độ (lng) phải từ -180 đến 180'],
        max: [180, 'Kinh độ (lng) phải từ -180 đến 180'],
      },
    },
  },
  {
    timestamps: true,
  }
);

const City = mongoose.model('City', citySchema);

export default City;
