import mongoose from 'mongoose';

const cafeSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    images: {
      type: [String],
      default: [],
    },
    price: {
      type: Number,
      default: 0,
    },
    address: {
      type: String,
      default: '',
    },
    coordinates: {
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
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

const Cafe = mongoose.model('Cafe', cafeSchema);

export default Cafe;
