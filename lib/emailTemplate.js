function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMultiline(value) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

export function buildReminderEmail({
  title,
  subtitle,
  message,
  details,
  ctaUrl,
  ctaLabel,
  secondaryCtaUrl,
  secondaryCtaLabel,
}) {
  const detailRows = (details ?? [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-size: 12px; width: 120px;">${escapeHtml(
          item.label
        )}</td>
        <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 600;">${escapeHtml(
          item.value
        )}</td>
      </tr>`
    )
    .join("");

  return `
  <div style="background-color: #ffffff; padding: 24px; font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a;">
    <div style="max-width: 560px; margin: 0 auto; border: 1px solid #fed7aa; border-radius: 24px; padding: 24px;">
      <div style="display: inline-block; border: 1px solid #fb923c; color: #f97316; border-radius: 999px; padding: 4px 12px; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; font-weight: 700;">
        Reminder Rocket
      </div>
      <h1 style="margin: 16px 0 8px; font-size: 22px;">${escapeHtml(
        title
      )}</h1>
      <p style="margin: 0 0 16px; color: #475569; font-size: 14px;">${escapeHtml(
        subtitle
      )}</p>
      <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 18px; padding: 16px;">
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #0f172a;">
          ${formatMultiline(message)}
        </p>
      </div>
      <table style="width: 100%; margin: 16px 0; border-collapse: collapse;">
        ${detailRows}
      </table>
      ${
        ctaUrl
          ? `<a href="${escapeHtml(
              ctaUrl
            )}" style="display: inline-block; margin-top: 8px; background-color: #f97316; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 18px; border-radius: 999px;">${escapeHtml(
              ctaLabel ?? "Open Reminder Rocket"
            )}</a>`
          : ""
      }
      ${
        secondaryCtaUrl
          ? `<a href="${escapeHtml(
              secondaryCtaUrl
            )}" style="display: inline-block; margin-top: 8px; margin-left: 8px; border: 1px solid #fb923c; color: #f97316; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 18px; border-radius: 999px;">${escapeHtml(
              secondaryCtaLabel ?? "Upload receipt"
            )}</a>`
          : ""
      }
      <p style="margin-top: 20px; font-size: 11px; color: #94a3b8;">
        Stay on track and finish the mission.
      </p>
    </div>
  </div>`;
}
