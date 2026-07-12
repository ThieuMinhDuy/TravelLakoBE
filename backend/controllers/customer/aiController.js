import asyncHandler from 'express-async-handler';
import City from '../../models/cityModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';
import Trip from '../../models/tripModel.js';

// Helper function to normalize text (remove Vietnamese accents and convert to lowercase)
const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
};

// @desc    Generate trip schedule suggestion using Gemini AI
// @route   POST /api/ai/suggest
// @access  Private
const generateAISuggestion = asyncHandler(async (req, res) => {
  const { cityId, startDate, endDate, budget, preferences, notes } = req.body;

  let targetCity = null;
  if (cityId) {
    targetCity = await City.findById(cityId);
  } else {
    // Attempt to extract city name from notes or prompt
    const textToSearch = notes || '';
    if (!textToSearch) {
      res.status(400);
      throw new Error('Vui lòng cung cấp cityId hoặc nhập lời nhắn có tên thành phố để trợ lý tìm kiếm.');
    }
    const citiesList = await City.find({});
    const normalizedText = normalizeText(textToSearch);
    
    // Find a city whose name exists in the normalizedText
    for (const city of citiesList) {
      const normalizedCityName = normalizeText(city.name);
      if (normalizedText.includes(normalizedCityName)) {
        targetCity = city;
        break;
      }
    }
  }

  if (!targetCity) {
    const citiesList = await City.find({}, 'name');
    const availableCityNames = citiesList.map(c => c.name).join(', ');
    res.status(400);
    throw new Error(`Không tìm thấy thành phố nào tương thích. Các thành phố được hỗ trợ hiện tại: ${availableCityNames}`);
  }

  // 1. Fetch top 10 places of each category in the city
  const hotels = await Hotel.find({ city: targetCity._id }).sort({ rating: -1 }).limit(10).lean();
  const attractions = await Attraction.find({ city: targetCity._id }).sort({ rating: -1 }).limit(10).lean();
  const restaurants = await Restaurant.find({ city: targetCity._id }).sort({ rating: -1 }).limit(10).lean();
  const cafes = await Cafe.find({ city: targetCity._id }).sort({ rating: -1 }).limit(10).lean();

  // 2. Format places list for the AI prompt
  const formatPlaces = (list, type) => {
    return list.map(p => `- [${type}] Tên: "${p.name}", ID: "${p._id}", Điểm đánh giá: ${p.rating || 5}/5, Chi tiết: "${p.description || ''}"${p.admissionFee !== undefined ? `, Vé vào: ${p.admissionFee}đ` : ''}${p.priceRange ? `, Giá: ${p.priceRange}` : ''}`).join('\n');
  };

  const placesListText = [
    formatPlaces(hotels, 'Hotel'),
    formatPlaces(attractions, 'Attraction'),
    formatPlaces(restaurants, 'Restaurant'),
    formatPlaces(cafes, 'Cafe')
  ].filter(Boolean).join('\n\n');

  // Calculate duration
  const start = new Date(startDate || Date.now());
  const end = new Date(endDate || Date.now() + 2 * 24 * 60 * 60 * 1000); // Default 3 days
  const duration = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1);

  // 3. Construct System Prompt & User instructions
  const systemPrompt = `Bạn là một trợ lý ảo thiết lập lịch trình du lịch thông minh cho ứng dụng TravelLako.
Nhiệm vụ của bạn là lập lịch trình du lịch cho người dùng tại thành phố "${targetCity.name}" trong vòng ${duration} ngày.
Bạn CHỈ ĐƯỢC PHÉP chọn các địa điểm từ danh sách thực tế của hệ thống cung cấp dưới đây. TUYỆT ĐỐI không tự tạo ra tên địa điểm mới hoặc ID giả.
Các địa điểm phải khớp chính xác thuộc tính "placeType" và "placeId" của chúng.

DANH SÁCH ĐỊA ĐIỂM THỰC TẾ:
${placesListText}

Quy tắc sắp xếp:
- Ngày đầu tiên nên bắt đầu bằng việc nhận phòng khách sạn (Hotel) nếu có khách sạn được gợi ý.
- Mỗi ngày chỉ nên có tối đa 3-4 địa điểm hoạt động (bao gồm tham quan Attraction, ăn uống Restaurant/Cafe) xếp theo thứ tự thời gian hợp lý (order từ 0 tăng dần).
- Đảm bảo lịch trình đáp ứng tốt nhất sở thích "${preferences || 'Tổng hợp'}" và phân khúc ngân sách "${budget || 'Trung bình'}".
- Ước tính tổng chi phí toàn bộ chuyến đi "estimatedTotalCost" (bao gồm giá phòng khách sạn tham khảo, vé vào cửa các điểm du lịch, và chi phí ăn uống ước lượng cho ${duration} ngày).`;

  const userPrompt = `Hãy thiết kế lịch trình ${duration} ngày tại thành phố ${targetCity.name}.
Sở thích: ${preferences || 'Không có yêu cầu đặc biệt'}
Ngân sách: ${budget || 'Trung bình'}
Lưu ý thêm từ tôi: ${notes || 'Không có lưu ý thêm'}`;

  // 4. Request Gemini API using direct REST endpoint
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    res.status(500);
    throw new Error('Hệ thống chưa cấu hình API Key cho Trợ lý AI.');
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: systemPrompt },
          { text: userPrompt }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          suggestedTitle: { type: 'string', description: 'Tên gợi ý hấp dẫn cho chuyến đi' },
          estimatedTotalCost: { type: 'number', description: 'Ước tính tổng chi phí cho toàn bộ chuyến đi bằng VNĐ' },
          schedule: {
            type: 'array',
            description: 'Danh sách lịch trình các ngày',
            items: {
              type: 'object',
              properties: {
                day: { type: 'integer', description: 'Số thứ tự ngày (1, 2, ...)' },
                places: {
                  type: 'array',
                  description: 'Các địa điểm tham quan/ăn uống/khách sạn trong ngày',
                  items: {
                    type: 'object',
                    properties: {
                      placeType: { type: 'string', enum: ['Hotel', 'Attraction', 'Restaurant', 'Cafe'] },
                      placeId: { type: 'string', description: 'Chuỗi ID (_id) chính xác của địa điểm đã cho ở trên' },
                      order: { type: 'integer', description: 'Thứ tự đi trong ngày (0, 1, 2...)' },
                      note: { type: 'string', description: 'Lời khuyên hoặc gợi ý hoạt động của trợ lý AI tại địa điểm này' }
                    },
                    required: ['placeType', 'placeId', 'order', 'note']
                  }
                }
              },
              required: ['day', 'places']
            }
          }
        },
        required: ['suggestedTitle', 'estimatedTotalCost', 'schedule']
      }
    }
  };

  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        res.status(429);
        throw new Error('Trợ lý AI đang bận do vượt quá giới hạn yêu cầu (Quota Limit). Vui lòng thử lại sau ít phút!');
      }
      throw new Error(data.error?.message || 'Có lỗi xảy ra khi kết nối tới Gemini API.');
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) {
      throw new Error('Trợ lý AI không phản hồi kết quả hợp lệ.');
    }

    const resultJson = JSON.parse(aiText);
    res.status(200).json({
      success: true,
      city: {
        _id: targetCity._id,
        name: targetCity.name,
        image: targetCity.image
      },
      ...resultJson
    });

  } catch (error) {
    if (res.statusCode === 200) {
      res.status(500);
    }
    throw new Error(error.message || 'Lỗi trong quá trình xử lý đề xuất AI.');
  }
});

// @desc    Optimize existing trip itinerary using AI based on location coordinates
// @route   POST /api/ai/optimize/:tripId
// @access  Private
const optimizeExistingTrip = asyncHandler(async (req, res) => {
  // Placeholder for Sprint 3
  res.status(501).json({ message: 'Optimize API is not implemented yet. Comming in Sprint 3!' });
});

export {
  generateAISuggestion,
  optimizeExistingTrip
};
