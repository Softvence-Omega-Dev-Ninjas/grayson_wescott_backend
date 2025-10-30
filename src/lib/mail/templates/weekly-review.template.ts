export const weeklyReviewTemplate = (
  userName: string,
  review: string,
  adminName: string,
  adminEmail: string,
  formattedSentAt: string, // already formatted in service
  timezone: string,
) => {
  // small helper to escape HTML inside template values (avoid injecting raw content)
  const escapeHtml = (unsafe: string) =>
    unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const safeUserName = escapeHtml(userName || 'there');
  const safeAdminName = escapeHtml(adminName || 'Admin');
  const safeAdminEmail = escapeHtml(adminEmail || '');
  const safeReviewHtml = escapeHtml(review || '').replace(/\n/g, '<br/>');

  return `
  <div style="font-family: Arial, sans-serif; background-color: #f7f8fb; padding: 28px;">
    <div style="max-width: 680px; margin: auto; background: #fff; padding: 28px; border-radius: 8px; box-shadow: 0 6px 20px rgba(23,32,45,0.06);">
      <div style="text-align: center; margin-bottom: 18px;">
        <h2 style="margin:0; font-size:22px; color:#1f2937;">📋 Your Weekly Review</h2>
        <p style="color:#6b7280; margin:6px 0 0; font-size:13px;">Sent by ${safeAdminName} • ${escapeHtml(formattedSentAt)}</p>
      </div>

      <p style="font-size:15px; color:#374151; line-height:1.6;">
        Hi ${safeUserName},
      </p>

      <p style="font-size:15px; color:#374151; line-height:1.6;">
        You received the following weekly review from <strong>${safeAdminName}</strong> (${safeAdminEmail}). This review was recorded in your timezone: <em>${escapeHtml(timezone)}</em>.
      </p>

      <div style="margin:18px 0; padding:16px; border-radius:8px; background: #f3f4f6; border: 1px solid #e6e9ee;">
        <h4 style="margin:0 0 8px 0; font-size:14px; color:#111827;">Weekly Review</h4>
        <div style="font-size:14px; color:#111827; line-height:1.6;">
          ${safeReviewHtml || '<em>No review text provided.</em>'}
        </div>
      </div>

      <!-- Suggestions & actions -->
      <div style="margin-bottom: 18px;">
        <h4 style="margin:0 0 8px 0; font-size:14px; color:#111827;">Suggested next steps</h4>
        <ul style="margin:0; padding-left:18px; color:#374151; font-size:14px; line-height:1.6;">
          <li>Review the points above and implement any suggestions.</li>
          <li>If anything is unclear, reply to this message or contact the admin in-app for clarification.</li>
          <li>Track progress weekly to see improvements.</li>
        </ul>
      </div>


      <hr style="border:none; border-top:1px solid #eef2ff; margin: 20px 0;" />

      <p style="font-size:13px; color:#6b7280; margin:0;">
        If you believe this review was sent in error or you need assistance, reply to this email or contact support.
      </p>

      <p style="font-size:13px; color:#9ca3af; margin:8px 0 0; text-align:center;">
        © ${new Date().getFullYear()} Your Company. All rights reserved.
      </p>
    </div>
  </div>
  `;
};
