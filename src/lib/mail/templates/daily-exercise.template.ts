import { ProgramExercise } from '@prisma/client';

export const dailyExerciseTemplate = (
  userName: string,
  programTitle: string,
  exercises: ProgramExercise[],
) => `
<div style="font-family: Arial, sans-serif; background-color: #f4f4f7; padding: 30px;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 35px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 25px;">
      <h2 style="color: #2c3e50; margin: 0; font-size: 24px;">🏋️ Daily Exercise Reminder</h2>
    </div>

    <!-- Greeting -->
    <p style="font-size: 16px; color: #444; line-height: 1.6; margin-bottom: 15px;">
      Hi ${userName || 'there'},
    </p>

    <!-- Program Info -->
    <p style="font-size: 16px; color: #444; line-height: 1.6; margin-bottom: 15px;">
      Here’s your exercise plan for today in the <strong>"${programTitle}"</strong> program:
    </p>

    <!-- Exercise Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #f1f1f1;">
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">#</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Exercise</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Duration</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Sets/Reps</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Tempo</th>
          <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Video</th>
        </tr>
      </thead>
      <tbody>
        ${exercises
          .map(
            (ex, idx) => `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${idx + 1}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">
              <strong>${ex.title}</strong><br/>
              <small>${ex.description || ''}</small>
            </td>
            <td style="padding: 10px; border: 1px solid #ddd;">
              ${ex.duration ? ex.duration + ' min' : '-'}
            </td>
            <td style="padding: 10px; border: 1px solid #ddd;">
              ${ex.sets ? ex.sets : '-'} / ${ex.reps ? ex.reps : '-'}
            </td>
            <td style="padding: 10px; border: 1px solid #ddd;">
              ${ex.tempo || '-'}
            </td>
            <td style="padding: 10px; border: 1px solid #ddd;">
              ${
                ex.videoUrl
                  ? `<a href="${ex.videoUrl}" target="_blank" style="color:#3498db; text-decoration: none;">Watch</a>`
                  : '-'
              }
            </td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>

    <!-- Footer / Motivation -->
    <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 20px;">
      Keep up the great work! Completing your exercises daily helps you reach your fitness goals faster.
    </p>

    <hr style="border:none; border-top:1px solid #eee; margin: 25px 0;">

    <p style="font-size: 13px; color: #999; text-align: center; margin: 0;">
      Need help? Contact our support team anytime.
    </p>

  </div>
</div>
`;
