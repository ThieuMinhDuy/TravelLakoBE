import { Resend } from 'resend';

const sendEmail = async ({ to, subject, html }) => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: 'TravelLako <onboarding@resend.dev>', // Email thử nghiệm mặc định của Resend
    to,
    subject,
    html,
  });
};

export default sendEmail;
