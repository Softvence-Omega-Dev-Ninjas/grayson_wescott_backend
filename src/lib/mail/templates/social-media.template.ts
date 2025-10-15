export const socialLoginWithOtpTemplate = (
  link: string,
  otp: string,
  message: string,
  provider: string,
) => `
<div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
  <div style="max-width: 500px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <h3 style="color: #333; margin-bottom: 15px;">Social Login Request</h3>
    
    <p style="font-size: 16px; color: #555; margin-bottom: 15px;">
      ${message}
    </p>
    
    <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
      Your OTP: <strong>${otp}</strong>
    </p>
    
    <div style="margin: 20px 0;">
      <a href="${link}" style="display:inline-block; background-color:#DC3545; color:#fff; text-decoration:none; padding:12px 20px; border-radius:6px; font-size:16px;">
        Login with ${provider}
      </a>
    </div>
    
    <p style="font-size: 14px; color: #888; margin-top: 20px;">
      If you did not request a social login, please ignore this email.
    </p>
  </div>
</div>
`;
