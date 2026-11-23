import City from '../models/cityModel.js';
import { toSearchKey } from './text.js';

/**
 * Tìm thành phố theo tên, KHÔNG phân biệt hoa/thường và dấu ("Da Lat" khớp "Đà Lạt").
 * Số thành phố nhỏ (vài chục) nên lấy hết tên rồi so khớp trong bộ nhớ.
 * @param {string} name
 * @param {{ excludeId?: unknown }} [options] bỏ qua thành phố này (dùng khi đổi tên)
 * @returns {Promise<import('mongoose').Document | null>}
 */
const findCityByName = async (name, { excludeId } = {}) => {
  const key = toSearchKey(name);
  if (!key) return null;

  const cities = await City.find({}, 'name').lean();
  const match = cities.find(
    (c) => toSearchKey(c.name) === key && (!excludeId || String(c._id) !== String(excludeId))
  );
  return match ? City.findById(match._id) : null;
};

export default findCityByName;
