// Làm giàu dữ liệu địa điểm import từ OpenStreetMap bằng Gemini:
// viết mô tả tiếng Việt và gán giá tham khảo (khách sạn thêm số sao, nhà hàng thêm loại ẩm thực).
// Gemini lỗi / chưa cấu hình / trả dữ liệu sai thì trả null cho mục đó để caller dùng dữ liệu mẫu.
import { generateJson, isGeminiConfigured } from './gemini.js';

const DEFAULT_TIMEOUT_MS = 25000;

// Cấu hình prompt + khoảng giá hợp lệ cho từng loại (giá ngoài khoảng coi như Gemini trả sai)
const TYPE_CONFIG = {
  Hotel: {
    label: 'khách sạn / nơi lưu trú',
    priceHint: 'giá phòng tham khảo mỗi đêm',
    priceRange: [100000, 50000000],
    extraFields: { stars: { type: 'integer', description: 'Hạng sao ước tính từ 1 đến 5' } },
    extraRules: ['- stars: hạng sao ước tính từ 1 đến 5 (số nguyên).'],
  },
  Attraction: {
    label: 'điểm tham quan',
    priceHint: 'giá vé vào cửa tham khảo cho một người lớn (0 nếu miễn phí)',
    priceRange: [0, 5000000],
    extraFields: {},
    extraRules: [],
  },
  Restaurant: {
    label: 'nhà hàng / quán ăn',
    priceHint: 'chi phí trung bình tham khảo cho một người',
    priceRange: [10000, 10000000],
    extraFields: { cuisineType: { type: 'string', description: 'Loại ẩm thực' } },
    extraRules: ['- cuisineType: loại ẩm thực ngắn gọn bằng tiếng Việt, ví dụ "Ẩm thực Việt Nam", "Hải sản", "Lẩu", "Món Âu".'],
  },
  Cafe: {
    label: 'quán cà phê',
    priceHint: 'giá trung bình tham khảo của một đồ uống',
    priceRange: [5000, 1000000],
    extraFields: {},
    extraRules: [],
  },
};

const MAX_DESCRIPTION_LENGTH = 500;

/** Tên lấy từ OSM: bỏ xuống dòng và cắt ngắn trước khi đưa vào prompt */
const sanitizeName = (name) => String(name).replace(/\s+/g, ' ').trim().slice(0, 120);

const buildPrompt = (type, cityName, names) => {
  const cfg = TYPE_CONFIG[type];
  return [
    `Bạn là biên tập viên nội dung du lịch. Dưới đây là danh sách ${cfg.label} ở ${cityName}, Việt Nam, lấy từ OpenStreetMap.`,
    'Với mỗi mục, hãy trả về:',
    `- description: 1-2 câu tiếng Việt tự nhiên, hấp dẫn (tối đa 300 ký tự). Chỉ dựa vào tên, loại địa điểm và thành phố; KHÔNG bịa tiện nghi, giải thưởng, địa chỉ, năm thành lập hay số liệu cụ thể.`,
    `- price: ${cfg.priceHint}, đơn vị VNĐ, là số nguyên hợp lý với loại địa điểm này ở ${cityName}.`,
    ...cfg.extraRules,
    '- index: đúng số thứ tự của mục trong danh sách.',
    'Trả về một mảng JSON, mỗi mục trong danh sách đúng một phần tử.',
    '',
    'Danh sách:',
    ...names.map((name, i) => `${i}. ${sanitizeName(name)}`),
  ].join('\n');
};

const buildSchema = (type) => {
  const { extraFields } = TYPE_CONFIG[type];
  return {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        index: { type: 'integer' },
        description: { type: 'string' },
        price: { type: 'number' },
        ...extraFields,
      },
      required: ['index', 'description', 'price', ...Object.keys(extraFields)],
    },
  };
};

/** Kiểm tra 1 phần tử Gemini trả về; field nào sai thì bỏ (caller dùng dữ liệu mẫu cho field đó) */
const sanitizeItem = (type, raw) => {
  const [minPrice, maxPrice] = TYPE_CONFIG[type].priceRange;
  const result = {};

  if (typeof raw?.description === 'string' && raw.description.trim()) {
    result.description = raw.description.trim().slice(0, MAX_DESCRIPTION_LENGTH);
  }

  const price = Number(raw?.price);
  if (Number.isFinite(price) && price >= minPrice && price <= maxPrice) {
    result.price = Math.round(price / 1000) * 1000; // làm tròn đến nghìn đồng
  }

  if (type === 'Hotel') {
    const stars = Number(raw?.stars);
    if (Number.isInteger(stars) && stars >= 1 && stars <= 5) result.stars = stars;
  }

  if (type === 'Restaurant' && typeof raw?.cuisineType === 'string' && raw.cuisineType.trim()) {
    result.cuisineType = raw.cuisineType.trim().slice(0, 60);
  }

  // Chỉ coi là "AI viết" khi có ít nhất mô tả
  return result.description ? result : null;
};

const enrichType = async (type, cityName, names, timeoutMs) => {
  const output = await generateJson({
    prompt: buildPrompt(type, cityName, names),
    responseSchema: buildSchema(type),
    timeoutMs,
  });
  if (!Array.isArray(output)) throw new Error('Gemini không trả về mảng');

  const details = new Array(names.length).fill(null);
  for (const raw of output) {
    const index = Number(raw?.index);
    if (Number.isInteger(index) && index >= 0 && index < names.length && details[index] === null) {
      details[index] = sanitizeItem(type, raw);
    }
  }
  return details;
};

/**
 * Gọi Gemini song song, mỗi loại địa điểm 1 lần.
 *
 * @param {object} params
 * @param {string} params.cityName
 * @param {Record<string, string[]>} params.groups tên địa điểm mới theo loại, vd { Hotel: ['A', 'B'] }
 * @param {number} [params.timeoutMs]
 * @returns {Promise<{ details: Record<string, Array<object|null>>, failedTypes: string[], enabled: boolean }>}
 *   details[type][i] là dữ liệu AI cho groups[type][i], hoặc null nếu phải dùng dữ liệu mẫu.
 *   failedTypes: loại mà lần gọi Gemini bị lỗi (rỗng khi enabled = false vì không gọi).
 */
export const enrichImportedPlaces = async ({ cityName, groups, timeoutMs = DEFAULT_TIMEOUT_MS }) => {
  const details = {};
  const failedTypes = [];
  const types = Object.keys(groups).filter((type) => TYPE_CONFIG[type] && groups[type].length > 0);
  types.forEach((type) => (details[type] = new Array(groups[type].length).fill(null)));

  if (!isGeminiConfigured()) {
    // Không gọi Gemini: mọi mục dùng dữ liệu mẫu, enabled = false cho caller biết lý do
    return { details, failedTypes: [], enabled: false };
  }

  const results = await Promise.allSettled(
    types.map((type) => enrichType(type, cityName, groups[type], timeoutMs))
  );

  results.forEach((result, i) => {
    const type = types[i];
    if (result.status === 'fulfilled') {
      details[type] = result.value;
    } else {
      failedTypes.push(type);
      console.warn(`[Import Tool] Gemini lỗi khi làm giàu ${type}, dùng dữ liệu mẫu: ${result.reason?.message}`);
    }
  });

  return { details, failedTypes, enabled: true };
};
