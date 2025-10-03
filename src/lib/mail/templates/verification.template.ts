export const verificationTemplate = (
  code: string,
  message: string,
  link: string,
) => `
<div style="font-family: Arial, sans-serif; background-color: #f4f4f7; padding: 30px;">
  <div style="max-width: 550px; margin: auto; background-color: #ffffff; padding: 35px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 25px;">
      <h2 style="color: #2c3e50; margin: 0; font-size: 24px;">🔑 Verify Your Account</h2>
    </div>

    <!-- Message -->
    <p style="font-size: 16px; color: #444; line-height: 1.6; margin-bottom: 25px;">
      ${message}
    </p>

    <!-- Verification Code -->
    <div style="text-align: center; margin-bottom: 25px;">
      <p style="font-size: 18px; color: #555; margin-bottom: 8px;">Your verification code:</p>
      <p style="font-size: 24px; font-weight: bold; color: #111; background-color: #f7f7f7; display: inline-block; padding: 12px 20px; border-radius: 6px; letter-spacing: 3px; border: 1px solid #ddd;">
        ${code}
      </p>
    </div>

    <!-- Verify Button -->
    <div style="text-align: center; margin-bottom: 25px;">
      <a href="${link}" style="display:inline-block; background-color:#007BFF; color:#ffffff; text-decoration:none; padding:14px 24px; border-radius:6px; font-size:16px; font-weight: bold;">
        Verify Account
      </a>
    </div>

    <!-- Link Fallback -->
    <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
      If the button above doesn’t work, copy and paste this link into your browser:
      <br>
      <a href="${link}" style="color:#007BFF; word-break: break-all;">${link}</a>
    </p>

    <!-- Footer -->
    <hr style="border:none; border-top:1px solid #eee; margin: 25px 0;">
    <p style="font-size: 13px; color: #999; text-align: center; margin: 0;">
      If you didn’t request this code, you can safely ignore this email.  
      <br>Need help? Contact our support team.
    </p>

  </div>
</div>
`;
