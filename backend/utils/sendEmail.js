const sendEmail = async ({ to, subject, html }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || 'thieuminhduy84@gmail.com';

  if (!apiKey) {
    console.error('[Brevo Error]: BREVO_API_KEY is not configured in environment variables');
    throw new Error('Chưa cấu hình BREVO_API_KEY trong biến môi trường');
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'TravelLako',
          email: senderEmail,
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Brevo API Error]:', data);
      throw new Error(data.message || 'Không thể gửi email qua Brevo');
    }

    console.log(`[Email Sent via Brevo] Message ID: ${data.messageId} to ${to}`);
    return data;
  } catch (error) {
    console.error('[SendEmail Error]:', error);
    throw new Error(`Không thể gửi email xác thực: ${error.message}`);
  }
};

export default sendEmail;
