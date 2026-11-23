// Client gọi Gemini qua REST API (dùng chung cho các tính năng cần AI ở backend).
// Dùng header x-goog-api-key thay vì ?key= trên URL để key không lọt vào log của proxy.

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const GEMINI_MODEL = 'gemini-flash-lite-latest';

const getApiKey = () => (process.env.GEMINI_API_KEY || '').trim();

export const isGeminiConfigured = () => Boolean(getApiKey());

/**
 * Gọi Gemini và yêu cầu trả JSON đúng responseSchema.
 * Ném Error khi: thiếu API key, quá thời gian, HTTP lỗi (vd 429 hết hạn mức, 503 quá tải),
 * không có nội dung trả về hoặc JSON hỏng. Caller tự quyết định cách dự phòng.
 *
 * @param {object} options
 * @param {string} options.prompt
 * @param {object} options.responseSchema JSON schema (định dạng của Gemini)
 * @param {number} [options.timeoutMs=25000]
 * @param {number} [options.temperature=0.7]
 * @returns {Promise<unknown>} JSON đã parse
 */
export const generateJson = async ({ prompt, responseSchema, timeoutMs = 25000, temperature = 0.7 }) => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY chưa được cấu hình');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema, temperature },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Gemini HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    if (!text) {
      throw new Error(`Gemini không trả nội dung (finishReason: ${data?.candidates?.[0]?.finishReason || 'không rõ'})`);
    }
    return JSON.parse(text);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`Gemini quá thời gian chờ ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
