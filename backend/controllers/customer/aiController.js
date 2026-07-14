import asyncHandler from 'express-async-handler';
import City from '../../models/cityModel.js';
import Attraction from '../../models/attractionModel.js';
import Hotel from '../../models/hotelModel.js';
import Restaurant from '../../models/restaurantModel.js';
import Cafe from '../../models/cafeModel.js';
import Trip from '../../models/tripModel.js';
import Chat from '../../models/chatModel.js';

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
  const { cityId, startDate, endDate, budget, preferences, notes, isParse } = req.body;

  let chatRecord = null;
  if (isParse && req.user) {
    chatRecord = await Chat.findOne({ user: req.user._id });
  }

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

  // 1. Fetch places. If isParse is true, fetch all to make sure we can match whatever was chosen in chat.
  let hotels, attractions, restaurants, cafes;
  if (isParse) {
    hotels = await Hotel.find({ city: targetCity._id }).lean();
    attractions = await Attraction.find({ city: targetCity._id }).lean();
    restaurants = await Restaurant.find({ city: targetCity._id }).lean();
    cafes = await Cafe.find({ city: targetCity._id }).lean();
  } else {
    hotels = await Hotel.find({ city: targetCity._id }).sort({ rating: -1 }).limit(10).lean();
    attractions = await Attraction.find({ city: targetCity._id }).sort({ rating: -1 }).limit(10).lean();
    restaurants = await Restaurant.find({ city: targetCity._id }).sort({ rating: -1 }).limit(10).lean();
    cafes = await Cafe.find({ city: targetCity._id }).sort({ rating: -1 }).limit(10).lean();
  }

  // 2. Format places list for the AI prompt
  const formatPlaces = (list, type) => {
    return list.map(p => {
      let priceText = '';
      if (p.pricePerNight !== undefined) priceText = `, Giá phòng: ${p.pricePerNight}đ/đêm`;
      else if (p.admissionFee !== undefined) priceText = `, Vé vào: ${p.admissionFee}đ`;
      else if (p.price !== undefined) priceText = `, Giá trung bình: ${p.price}đ`;
      return `- [${type}] Tên: "${p.name}", ID: "${p._id}", Điểm đánh giá: ${p.rating || 5}/5, Chi tiết: "${p.description || ''}"${priceText}`;
    }).join('\n');
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

  // 3. Construct Prompts based on mode
  let systemPrompt = '';
  let userPrompt = '';

  if (isParse) {
    let conversationText = '';
    if (chatRecord) {
      conversationText = chatRecord.messages.map(m => `${m.role === 'user' ? 'Khách hàng' : 'AI'}: ${m.parts?.[0]?.text || ''}`).join('\n');
    }

    systemPrompt = `Bạn là một trợ lý ảo phân tích lịch trình du lịch thông minh cho ứng dụng TravelLako.
Nhiệm vụ của bạn là đọc và phân tích lịch trình du lịch dạng chữ (Markdown) được cung cấp bởi người dùng và trích xuất cấu trúc dữ liệu JSON chính xác khớp với hệ thống.

DANH SÁCH ĐỊA ĐIỂM THỰC TẾ TRONG HỆ THỐNG:
${placesListText}

CÁC YÊU CẦU QUAN TRỌNG:
1. Bạn phải đọc lịch trình chữ và đối chiếu tên các địa điểm xuất hiện trong lịch trình chữ với danh sách địa điểm thực tế của hệ thống ở trên để tìm ra đúng "placeId" và "placeType".
   - Ví dụ: Nếu trong lịch trình chữ ghi "Khách sạn Golden Holiday", hãy tìm khách sạn có tên tương tự trong danh sách thực tế ở trên để lấy ra đúng ID của nó.
   - Phân biệt rõ các loại placeType: 'Hotel', 'Attraction', 'Restaurant', 'Cafe'.
2. Sắp xếp lại lịch trình theo đúng thứ tự các ngày (day 1, 2...) và thứ tự các địa điểm (order 0, 1, 2...) tương tự như trong văn bản lịch trình.
3. Không tự ý thêm bớt hay chọn các địa điểm khác ngoài những gì có trong văn bản lịch trình chữ của người dùng.
4. Trích xuất chính xác số tiền ngân sách mà người dùng mong muốn từ lịch sử cuộc trò chuyện dưới đây. 
   - Tìm các cụm từ chỉ ngân sách (ví dụ: "ngân sách 4 triệu", "4tr", "4.000.000", "ngân sách 3 triệu"...) trong lịch sử chat để lấy giá trị số tương ứng (ví dụ: 4000000 hoặc 3000000) gán vào trường "estimatedTotalCost".
   - Nếu không tìm thấy bất kỳ thông tin ngân sách nào cụ thể trong lịch sử chat, hãy dùng giá trị mặc định là 4000000.

LỊCH SỬ CUỘC TRÒ CHUYỆN ĐỂ TRÍCH XUẤT NGÂN SÁCH:
${conversationText}`;

    userPrompt = `Dưới đây là nội dung lịch trình dạng chữ cần phân tích:\n${notes}`;
  } else {
    systemPrompt = `Bạn là một trợ lý ảo thiết lập lịch trình du lịch thông minh cho ứng dụng TravelLako.
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

    userPrompt = `Hãy thiết kế lịch trình ${duration} ngày tại thành phố ${targetCity.name}.
Sở thích: ${preferences || 'Không có yêu cầu đặc biệt'}
Ngân sách: ${budget || 'Trung bình'}
Lưu ý thêm từ tôi: ${notes || 'Không có lưu ý thêm'}`;
  }

  // 4. Request Gemini API using direct REST endpoint
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    res.status(500);
    throw new Error('Hệ thống chưa cấu hình API Key cho Trợ lý AI.');
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiApiKey}`;

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

// @desc    Conversational chat with Gemini AI
// @route   POST /api/ai/chat
// @access  Private
// @route   POST /api/ai/chat
// @access  Private
const chatWithAI = asyncHandler(async (req, res) => {
  const { message } = req.body;

  if (!message) {
    res.status(400);
    throw new Error('Vui lòng nhập tin nhắn của bạn.');
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    res.status(500);
    throw new Error('Gemini API key chưa được cấu hình ở file .env');
  }

  // 1. Fetch or create user's Chat document
  let chatRecord = await Chat.findOne({ user: req.user._id });
  if (!chatRecord) {
    chatRecord = new Chat({ user: req.user._id, messages: [] });
  }

  // 2. Search for city in message or recent DB history to select database places
  let targetCity = null;
  const citiesList = await City.find({});
  const dbHistoryText = chatRecord.messages.map(m => m.parts?.[0]?.text || '').join(' ');
  const allHistoryText = dbHistoryText + ' ' + message;
  const normalizedText = normalizeText(allHistoryText);

  for (const city of citiesList) {
    const normalizedCityName = normalizeText(city.name);
    if (normalizedText.includes(normalizedCityName)) {
      targetCity = city;
      break;
    }
  }

  let dbPlacesText = '';
  const availableCityNames = citiesList.map(c => c.name).join(', ');

  if (targetCity) {
    const hotels = await Hotel.find({ city: targetCity._id }).lean();
    const attractions = await Attraction.find({ city: targetCity._id }).lean();
    const restaurants = await Restaurant.find({ city: targetCity._id }).lean();
    const cafes = await Cafe.find({ city: targetCity._id }).lean();

    const formatPlaces = (list, type) => {
      return list.map(p => {
        let priceText = '';
        if (p.pricePerNight !== undefined) priceText = `, Giá phòng: ${p.pricePerNight}đ/đêm`;
        else if (p.admissionFee !== undefined) priceText = `, Vé vào: ${p.admissionFee}đ`;
        else if (p.price !== undefined) priceText = `, Giá trung bình: ${p.price}đ`;
        return `- [${type}] Tên: "${p.name}", Chi tiết: "${p.description || ''}"${priceText}`;
      }).join('\n');
    };

    const placesListText = [
      formatPlaces(hotels, 'Hotel'),
      formatPlaces(attractions, 'Attraction'),
      formatPlaces(restaurants, 'Restaurant'),
      formatPlaces(cafes, 'Cafe')
    ].filter(Boolean).join('\n\n');

    dbPlacesText = `Danh sách địa điểm thực tế tại thành phố ${targetCity.name} của hệ thống TravelLako:
${placesListText}

QUY TẮC CỰC KỲ QUAN TRỌNG:
- Bạn chỉ được phép gợi ý các địa điểm nằm trong danh sách thực tế của thành phố ${targetCity.name} ở trên.
- Tuyệt đối không tự bịa ra bất kỳ khách sạn, quán cafe, nhà hàng hay điểm du lịch nào khác nằm ngoài danh sách này.`;
  } else {
    dbPlacesText = `Hệ thống hiện tại chỉ có dữ liệu du lịch cho các thành phố sau: ${availableCityNames}.
Nếu người dùng hỏi hoặc yêu cầu gợi ý địa điểm ở bất kỳ thành phố nào khác ngoài danh sách trên, hãy lịch sự trả lời rằng hệ thống hiện chỉ hỗ trợ gợi ý và lên lịch trình cho các thành phố: ${availableCityNames}.`;
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiApiKey}`;

  const contents = [];

  // Build the contents array from the DB history
  chatRecord.messages.forEach(item => {
    contents.push({
      role: item.role === 'assistant' || item.role === 'model' ? 'model' : 'user',
      parts: item.parts.map(p => ({ text: p.text || '' }))
    });
  });

  // Push the current user message
  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  const requestBody = {
    contents,
    systemInstruction: {
      parts: [
        {
          text: `Bạn là một trợ lý du lịch ảo thân thiện tên là TravelLako.
Nhiệm vụ của bạn là trò chuyện, giải đáp thắc mắc và gợi ý các địa điểm du lịch, khách sạn, ẩm thực, quán cafe... cho người dùng.
Hãy trả lời một cách tự nhiên, lịch sự bằng Tiếng Việt.

QUY TẮC PHÂN BIỆT NHU CẦU:
1. Nếu người dùng chỉ hỏi thông thường hoặc yêu cầu gợi ý địa điểm đơn lẻ (ví dụ: "gợi ý quán cafe", "chỗ nào chơi ở Hà Nội", "tìm khách sạn đẹp", "gợi ý các địa điểm du lịch ở đây"...): Hãy trả lời và gợi ý trực tiếp danh sách các địa điểm phù hợp ngay lập tức (sử dụng dữ liệu thực tế hệ thống cung cấp dưới đây). TUYỆT ĐỐI KHÔNG hỏi các câu hỏi làm rõ về ngân sách hay số ngày đi của chuyến đi trong trường hợp này.
2. Chỉ khi người dùng thực sự yêu cầu "lập lịch trình", "lên lịch trình", "lên kế hoạch đi du lịch theo ngày" (hoặc có đề cập đến số ngày đi cụ thể): Bạn mới áp dụng quy tắc yêu cầu xác nhận Ngân sách và Số ngày đi (nếu thiếu) dưới đây trước khi lên lịch trình chi tiết.

QUY TẮC KHI LẬP LỊCH TRÌNH:
- Khi người dùng yêu cầu lập lịch trình du lịch, bạn bắt buộc phải biết rõ 2 thông tin quan trọng: Ngân sách dự kiến và Số ngày đi (độ dài chuyến đi).
- Nếu người dùng CHƯA cung cấp một trong hai thông tin này (Ngân sách hoặc Số ngày đi), bạn TUYỆT ĐỐI KHÔNG tự bịa ra thông tin mặc định hay lập lịch trình ngay. Thay vào đó, hãy lịch sự hỏi lại người dùng để xác nhận các thông tin còn thiếu này.
- Chỉ khi người dùng đã cung cấp đủ cả thông tin về Ngân sách và Số ngày đi, bạn mới tiến hành gợi ý lịch trình chi tiết theo từng ngày (gồm Sáng, Chiều, Tối) dưới dạng Markdown.
- Riêng Ngày bắt đầu chuyến đi không bắt buộc người dùng phải cung cấp, bạn không cần hỏi thông tin này.

QUY TẮC HIỂN THỊ GIÁ TIỀN (BẮT BUỘC):
- Khi gợi ý hay nhắc đến bất kỳ địa điểm nào trong câu trả lời (cho dù là gợi ý đơn lẻ hay khi lập lịch trình), bạn BẮT BUỘC phải ghi kèm giá tiền của địa điểm đó ngay bên cạnh tên địa điểm trong dấu ngoặc đơn. 
- Định dạng hiển thị bắt buộc:
  * Khách sạn: [Tên khách sạn] ([Giá phòng]đ/đêm) - Ví dụ: "Khách sạn Golden Holiday (1.200.000đ/đêm)".
  * Điểm tham quan: [Tên điểm tham quan] ([Vé vào]đ) - Ví dụ: "Chùa Cầu (0đ)" hoặc "Nhà cổ Phùng Hưng (30.000đ)".
  * Nhà hàng / Quán Cafe: [Tên địa điểm] ([Giá trung bình]đ) - Ví dụ: "Bánh mì Phượng (30.000đ)" hoặc "Nước Mót (15.000đ)".
- Tuyệt đối không tự ý lược bỏ thông tin giá tiền này trong mọi trường hợp.

Khi người dùng đã cung cấp đủ yêu cầu và bạn lập lịch trình, hãy phản hồi trực tiếp lịch trình chi tiết theo từng ngày ngay trong nội dung tin nhắn dưới dạng Markdown rõ ràng, thân thiện. Tuyệt đối không dẫn giải dài dòng hay giới thiệu/yêu cầu người dùng bấm nút nào trên giao diện cả.

DỮ LIỆU VÀ GIỚI HẠN GỢI Ý CỦA HỆ THỐNG:
${dbPlacesText}`
        }
      ]
    }
  };

  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        res.status(429);
        throw new Error('Trợ lý AI đang bận do vượt quá giới hạn yêu cầu (Quota Limit). Vui lòng thử lại sau ít phút!');
      }
      throw new Error(data.error?.message || 'Lỗi khi gọi Gemini API để chat.');
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Save to database
    chatRecord.messages.push({ role: 'user', parts: [{ text: message }] });
    chatRecord.messages.push({ role: 'model', parts: [{ text: reply }] });
    await chatRecord.save();

    res.status(200).json({ reply });
  } catch (error) {
    if (res.statusCode === 200) res.status(500);
    throw error;
  }
});

// @desc    Get chat history for current user
// @route   GET /api/ai/chat
// @access  Private
const getChatHistory = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ user: req.user._id });
  if (chat) {
    res.json(chat.messages || []);
  } else {
    res.json([]);
  }
});

// @desc    Clear chat history for current user
// @route   DELETE /api/ai/chat
// @access  Private
const clearChatHistory = asyncHandler(async (req, res) => {
  await Chat.deleteOne({ user: req.user._id });
  res.json({ message: 'Đã xóa lịch sử cuộc trò chuyện.' });
});

// @desc    Optimize existing trip itinerary using AI based on location coordinates (Batch request)
// @route   POST /api/ai/optimize/:tripId
// @access  Private
const optimizeExistingTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.tripId, user: req.user._id });
  if (!trip) {
    res.status(404);
    throw new Error('Chuyến đi không tồn tại hoặc bạn không có quyền chỉnh sửa.');
  }

  // If frontend already has optimizedSchedule, save it directly to avoid double Gemini calls
  if (req.body.preview === false && req.body.optimizedSchedule) {
    trip.schedule = req.body.optimizedSchedule;
    const updatedTrip = await trip.save();
    return res.status(200).json(updatedTrip);
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    res.status(500);
    throw new Error('Gemini API key chưa được cấu hình ở file .env');
  }

  // Pre-load all place coordinates for each day
  const scheduleData = [];
  for (const dayItem of trip.schedule) {
    const placesWithCoords = [];
    for (const place of dayItem.places) {
      let placeDetails = null;
      if (place.placeType === 'Hotel') {
        placeDetails = await Hotel.findById(place.placeId).lean();
      } else if (place.placeType === 'Attraction') {
        placeDetails = await Attraction.findById(place.placeId).lean();
      } else if (place.placeType === 'Restaurant') {
        placeDetails = await Restaurant.findById(place.placeId).lean();
      } else if (place.placeType === 'Cafe') {
        placeDetails = await Cafe.findById(place.placeId).lean();
      }

      if (placeDetails) {
        placesWithCoords.push({
          placeType: place.placeType,
          placeId: place.placeId.toString(),
          name: placeDetails.name,
          lat: placeDetails.coordinates.lat,
          lng: placeDetails.coordinates.lng,
          note: place.note || '',
          visited: place.visited || false,
          checkInTime: place.checkInTime
        });
      }
    }
    scheduleData.push({
      day: dayItem.day,
      date: dayItem.date,
      originalPlaces: dayItem.places,
      placesWithCoords
    });
  }

  // Build the batch text description
  let inputDaysText = '';
  scheduleData.forEach(dayData => {
    if (dayData.placesWithCoords.length > 1) {
      inputDaysText += `Ngày ${dayData.day}:\n`;
      dayData.placesWithCoords.forEach(p => {
        inputDaysText += `- [${p.placeType}] Tên: "${p.name}", placeId: "${p.placeId}", vĩ độ (lat): ${p.lat}, kinh độ (lng): ${p.lng}\n`;
      });
      inputDaysText += '\n';
    }
  });

  // If there are no days with multiple places, we don't need to call Gemini
  if (!inputDaysText.trim()) {
    return res.status(200).json(trip);
  }

  const systemPrompt = `Bạn là một trợ lý ảo tối ưu hóa lịch trình du lịch thông minh cho ứng dụng TravelLako.
Nhiệm vụ của bạn là nhận danh sách các ngày và địa điểm trong từng ngày kèm theo tọa độ kinh độ/vĩ độ của chúng.
Hãy sắp xếp lại thứ tự di chuyển (trả về giá trị order từ 0 tăng dần cho mỗi ngày độc lập) sao cho:
1. Quãng đường di chuyển tổng cộng giữa các điểm trong mỗi ngày là ngắn nhất và tối ưu nhất về địa lý.
2. Nếu trong ngày có địa điểm là Khách sạn (Hotel), hãy LUÔN đặt nó ở đầu tiên (order: 0) làm điểm xuất phát.
3. Đảm bảo nhịp điệu sinh hoạt (Day Rhythm) hợp lý: Không xếp hai nhà hàng ăn chính (Restaurant) liên tiếp nhau mà không có địa điểm tham quan (Attraction) ở giữa để giãn cách thời gian. Tuy nhiên, việc ăn xong đi cafe liền kề (Restaurant -> Cafe) thì được phép. Sắp xếp xen kẽ hoạt động tham quan và ẩm thực/nghỉ ngơi một cách khoa học.

Bạn phải trả về kết quả dưới dạng JSON khớp chính xác với cấu trúc JSON Schema yêu cầu.
TUYỆT ĐỐI không thay đổi hoặc làm mất bất kỳ placeId hay placeType nào đã cho trong dữ liệu đầu vào.

DANH SÁCH LỊCH TRÌNH CẦN SẮP XẾP:
${inputDaysText}`;

  const userPrompt = `Hãy tối ưu hóa thứ tự di chuyển cho lịch trình các ngày trên.
Lưu ý thêm từ người dùng: ${req.body.notes || 'Tối ưu hóa quãng đường di chuyển ngắn nhất.'}`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiApiKey}`;

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
          optimizedSchedule: {
            type: 'array',
            description: 'Danh sách lịch trình các ngày sau khi đã tối ưu',
            items: {
              type: 'object',
              properties: {
                day: { type: 'integer', description: 'Số thứ tự ngày' },
                optimizedPlaces: {
                  type: 'array',
                  description: 'Các địa điểm của ngày đó sau khi sắp xếp lại thứ tự',
                  items: {
                    type: 'object',
                    properties: {
                      placeId: { type: 'string', description: 'ID chính xác của địa điểm đã cho' },
                      placeType: { type: 'string', description: 'Loại địa điểm' },
                      order: { type: 'integer', description: 'Thứ tự mới sau khi tối ưu (0, 1, 2...)' },
                      note: { type: 'string', description: 'Ghi chú di chuyển hoặc lý do sắp xếp' }
                    },
                    required: ['placeId', 'placeType', 'order']
                  }
                }
              },
              required: ['day', 'optimizedPlaces']
            }
          }
        },
        required: ['optimizedSchedule']
      }
    }
  };

  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        res.status(429);
        throw new Error('Trợ lý AI đang bận do vượt quá giới hạn yêu cầu (Quota Limit). Vui lòng thử lại sau ít phút!');
      }
      throw new Error(data.error?.message || 'Lỗi khi gọi Gemini API để tối ưu.');
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const resultJson = JSON.parse(aiText);

    // Map the optimized days
    const optimizedDaysMap = new Map();
    resultJson.optimizedSchedule.forEach(od => {
      optimizedDaysMap.set(od.day, od.optimizedPlaces);
    });

    const finalSchedule = [];

    for (const dayData of scheduleData) {
      const optimizedPlacesList = optimizedDaysMap.get(dayData.day);
      if (optimizedPlacesList && dayData.placesWithCoords.length > 1) {
        const optimizedPlacesMap = new Map();
        optimizedPlacesList.forEach(op => {
          optimizedPlacesMap.set(op.placeId.toString(), op);
        });

        const reorderedPlaces = dayData.placesWithCoords.map(p => {
          const opt = optimizedPlacesMap.get(p.placeId.toString());
          return {
            placeType: p.placeType,
            placeId: p.placeId,
            order: opt ? opt.order : 99,
            note: opt && opt.note ? opt.note : p.note,
            visited: p.visited,
            checkInTime: p.checkInTime
          };
        }).sort((a, b) => a.order - b.order);

        // Normalize orders to be 0, 1, 2...
        reorderedPlaces.forEach((p, idx) => {
          p.order = idx;
        });

        finalSchedule.push({
          day: dayData.day,
          date: dayData.date,
          places: reorderedPlaces
        });
      } else {
        // Keep original places if not optimized
        finalSchedule.push({
          day: dayData.day,
          date: dayData.date,
          places: dayData.originalPlaces
        });
      }
    }

    if (req.body.preview) {
      res.status(200).json({ _id: trip._id, title: trip.title, city: trip.city, schedule: finalSchedule, preview: true });
    } else {
      trip.schedule = finalSchedule;
      const updatedTrip = await trip.save();
      res.status(200).json(updatedTrip);
    }

  } catch (err) {
    if (res.statusCode === 200) res.status(500);
    throw err;
  }
});

export {
  generateAISuggestion,
  chatWithAI,
  optimizeExistingTrip,
  getChatHistory,
  clearChatHistory
};
