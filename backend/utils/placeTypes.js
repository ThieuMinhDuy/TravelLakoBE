// Loại địa điểm dùng chung cho yêu thích, đánh giá, lịch trình chuyến đi và API địa điểm
import mongoose from 'mongoose';
import Attraction from '../models/attractionModel.js';
import Hotel from '../models/hotelModel.js';
import Restaurant from '../models/restaurantModel.js';
import Cafe from '../models/cafeModel.js';

const PLACE_MODELS = { Attraction, Hotel, Restaurant, Cafe };

export const PLACE_TYPES = Object.keys(PLACE_MODELS);

export const INVALID_PLACE_TYPE_MESSAGE = 'Loại địa điểm không hợp lệ. Chỉ nhận: Attraction, Hotel, Restaurant, Cafe';
export const PLACE_NOT_FOUND_MESSAGE = 'Không tìm thấy địa điểm';

/** Tên Model chuẩn ('Hotel'...) từ giá trị gửi lên, không phân biệt hoa thường; không hợp lệ (kể cả không phải chuỗi) -> null */
export const matchPlaceType = (value) =>
  typeof value === 'string' ? PLACE_TYPES.find((type) => type.toLowerCase() === value.toLowerCase()) ?? null : null;

/** Mongoose Model theo loại địa điểm; không hợp lệ -> null */
export const getPlaceModel = (value) => PLACE_MODELS[matchPlaceType(value)] ?? null;

/** Địa điểm theo loại + ID; ID sai định dạng cũng coi như không tìm thấy (thay vì lỗi CastError) */
export const findPlace = (type, id) => {
  const Model = getPlaceModel(type);
  return Model && mongoose.isValidObjectId(id) ? Model.findById(id) : null;
};
