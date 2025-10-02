export const resetPasswordTemplate = (
  resetLink: string,
  message: string,
) => `
<div style="font-family: Arial, sans-serif; background-color: #f4f4f7; padding: 30px;">
  <div style="max-width: 550px; margin: auto; background-color: #ffffff; padding: 35px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 25px;">
      <h2 style="color: #2c3e50; margin: 0; font-size: 24px;">🔒 Password Reset Request</h2>
    </div>

    <!-- Message -->
    <p style="font-size: 16px; color: #444; line-height: 1.6; margin-bottom: 25px;">
      ${message}
    </p>

    <!-- Reset Button -->
    <div style="text-align: center; margin-bottom: 25px;">
      <a href="${resetLink}" style="display:inline-block; background-color:#DC3545; color:#ffffff; text-decoration:none; padding:14px 24px; border-radius:6px; font-size:16px; font-weight: bold;">
        Reset Password
      </a>
    </div>

    <!-- Link Fallback -->
    <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
      If the button above doesn’t work, copy and paste this link into your browser:
      <br>
      <a href="${resetLink}" style="color:#DC3545; word-break: break-all;">${resetLink}</a>
    </p>

    <!-- Footer -->
    <hr style="border:none; border-top:1px solid #eee; margin: 25px 0;">
    <p style="font-size: 13px; color: #999; text-align: center; margin: 0;">
      If you didn’t request a password reset, you can safely ignore this email.  
      <br>For assistance, contact our support team.
    </p>

  </div>
</div>
`;
