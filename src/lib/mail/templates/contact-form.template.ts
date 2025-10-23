import { ContactForm } from '@prisma/client';

export const contactFormTemplate = (contact: ContactForm) => `
<div style="font-family: Arial, sans-serif; background-color: #f4f4f7; padding: 30px;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 35px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 25px;">
      <h2 style="color: #2c3e50; margin: 0; font-size: 24px;">📩 New Contact Form Submission</h2>
    </div>

    <!-- Contact Info -->
    <p style="font-size: 16px; color: #444; line-height: 1.6;">
      <strong>Name:</strong> ${contact.name}<br/>
      <strong>Email:</strong> ${contact.email}<br/>
      <strong>Phone:</strong> ${contact.phone}<br/>
      <strong>Message:</strong> ${contact.message}<br/>
      <strong>Street:</strong> ${contact.street || '-'}<br/>
      <strong>City:</strong> ${contact.city || '-'}<br/>
      <strong>Postcode:</strong> ${contact.postcode || '-'}
    </p>

    <!-- Footer -->
    <hr style="border:none; border-top:1px solid #eee; margin: 25px 0;">
    <p style="font-size: 13px; color: #999; text-align: center; margin: 0;">
      This email was generated automatically by your system.
    </p>
  </div>
</div>
`;
