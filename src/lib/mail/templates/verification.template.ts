export const verificationTemplate = (
  code: string,
  message: string,
  link: string,
) => `
<div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
  <div style="max-width: 500px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h3 style="color: #333; margin-bottom: 15px;">Welcome!</h3>
    <p style="font-size: 16px; color: #555; margin-bottom: 20px;">${message}</p>
    <p style="font-size: 20px; font-weight: bold; color: #000; background-color: #f0f0f0; display: inline-block; padding: 10px 15px; border-radius: 4px; letter-spacing: 2px;">
      ${code}
    </p>
    <div style="margin: 20px 0;">
      <a href="${link}" style="display:inline-block; background-color:#007BFF; color:#fff; text-decoration:none; padding:12px 20px; border-radius:6px; font-size:16px;">
        Verify Account
      </a>
    </div>
    <p style="font-size: 14px; color: #888; margin-top: 20px;">If you did not request this code, please ignore this email.</p>
  </div>
</div>
`;
