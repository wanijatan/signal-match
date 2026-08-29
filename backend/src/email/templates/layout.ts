export function emailLayout(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;background-color:#FAFAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#14161B;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #ECEAE3;border-radius:16px;padding:36px;">
            <tr>
              <td style="padding-bottom:24px;">
                <span style="font-size:15px;font-weight:700;letter-spacing:0.02em;color:#14161B;">SIGNAL</span>
                <span style="font-size:12px;color:#8A8D96;margin-left:6px;">by RightSignal</span>
              </td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;color:#33353D;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding-top:32px;border-top:1px solid #ECEAE3;margin-top:32px;font-size:12px;color:#9A9CA5;">
                You're receiving this because you have an active signal.
                <a href="{{stopMatchingUrl}}" style="color:#2F5EFF;">Stop matching me</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function button(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;padding:12px 22px;background:#14161B;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">${text}</a>`;
}
