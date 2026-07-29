import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM        = 'BAD TCG <noreply@badtcg.com>'
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'contato@badtcg.com'

function fmtBRL(val) {
  const n = parseFloat(val) || 0
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function buildItemRows(items) {
  if (!Array.isArray(items) || items.length === 0) return ''
  return items.map(item => {
    const qty   = item.quantity  ?? 1
    const price = item.unitPrice ?? item.unit_price ?? 0
    const sub   = qty * price
    return `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #1e1e38;color:#f1f5f9;font-size:14px;">${item.name ?? 'Item'}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #1e1e38;color:#94a3b8;font-size:14px;text-align:center;">${qty}x</td>
        <td style="padding:10px 16px;border-bottom:1px solid #1e1e38;color:#94a3b8;font-size:14px;text-align:right;">${fmtBRL(price)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #1e1e38;color:#f1f5f9;font-size:14px;text-align:right;font-weight:600;">${fmtBRL(sub)}</td>
      </tr>`
  }).join('')
}

function buildCustomerEmailHtml({ orderId, customerName, items, total }) {
  const shortId  = (orderId || '').slice(-6).toUpperCase()
  const itemRows = buildItemRows(items)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>BAD TCG – Pedido Recebido</title>
</head>
<body style="margin:0;padding:0;background:#080810;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080810;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Purple top bar -->
          <tr>
            <td height="4" style="background:#7c3aed;border-radius:4px 4px 0 0;font-size:0;">&nbsp;</td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#111120;border-radius:0 0 16px 16px;overflow:hidden;">

              <!-- Header -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:36px 24px 28px;border-bottom:1px solid #1e1e38;">
                    <p style="margin:0 0 4px;font-size:24px;font-weight:900;color:#f1f5f9;letter-spacing:-0.5px;">⚡ BAD TCG</p>
                    <p style="margin:0;font-size:12px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;">badtcg.com</p>
                  </td>
                </tr>
              </table>

              <!-- Status badge -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:28px 24px 0;">
                    <span style="display:inline-block;background:#7c3aed20;border:1px solid #7c3aed60;color:#7c3aed;font-size:11px;font-weight:800;letter-spacing:1.5px;padding:6px 18px;border-radius:999px;text-transform:uppercase;">
                      📬 PEDIDO RECEBIDO
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Heading + text -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px 32px 0;text-align:center;">
                    <p style="margin:0 0 10px;font-size:22px;font-weight:800;color:#f1f5f9;">Olá, ${customerName || 'cliente'}! 👋</p>
                    <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">Recebemos seu pedido com sucesso! Em breve confirmaremos a disponibilidade dos itens.</p>
                  </td>
                </tr>
              </table>

              <!-- Order ID box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d1f;border:1px solid #1e1e38;border-radius:10px;">
                      <tr>
                        <td align="center" style="padding:14px 20px;">
                          <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;">Número do pedido</p>
                          <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:900;color:#7c3aed;letter-spacing:3px;">#${shortId}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Items table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0 32px;">
                <tr>
                  <td style="padding:0 0 8px;">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#94a3b8;text-transform:uppercase;">Itens do pedido</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 32px;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d1f;border:1px solid #1e1e38;border-radius:10px;overflow:hidden;">
                      <thead>
                        <tr style="background:#1e1e38;">
                          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Item</th>
                          <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Qtd</th>
                          <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Unitário</th>
                          <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemRows}
                      </tbody>
                      <tfoot>
                        <tr style="background:#1a1a30;">
                          <td colspan="3" style="padding:12px 16px;font-size:14px;font-weight:700;color:#f1f5f9;text-align:right;">Total</td>
                          <td style="padding:12px 16px;font-size:18px;font-weight:900;color:#7c3aed;text-align:right;">${fmtBRL(total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:28px 32px;">
                    <a href="https://badtcg.com/meus-pedidos"
                       style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.3px;">
                      Acompanhar pedido →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:20px 24px 32px;border-top:1px solid #1e1e38;">
                    <p style="margin:0;font-size:12px;color:#94a3b8;">BAD TCG · <a href="https://badtcg.com" style="color:#7c3aed;text-decoration:none;">badtcg.com</a></p>
                    <p style="margin:6px 0 0;font-size:11px;color:#4a4a6a;">Você recebeu este email porque fez um pedido na BAD TCG.</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildOwnerEmailHtml({ orderId, customerName, customerContact, customerEmail, items, total }) {
  const shortId  = (orderId || '').slice(-6).toUpperCase()
  const itemRows = buildItemRows(items)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>BAD TCG – Novo Pedido</title>
</head>
<body style="margin:0;padding:0;background:#080810;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080810;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Amber top bar -->
          <tr>
            <td height="4" style="background:#f59e0b;border-radius:4px 4px 0 0;font-size:0;">&nbsp;</td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#111120;border-radius:0 0 16px 16px;overflow:hidden;">

              <!-- Header -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:36px 24px 28px;border-bottom:1px solid #1e1e38;">
                    <p style="margin:0 0 4px;font-size:24px;font-weight:900;color:#f1f5f9;letter-spacing:-0.5px;">⚡ BAD TCG</p>
                    <p style="margin:0;font-size:12px;color:#f59e0b;letter-spacing:2px;text-transform:uppercase;">PAINEL DA LOJA</p>
                  </td>
                </tr>
              </table>

              <!-- Status badge -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:28px 24px 0;">
                    <span style="display:inline-block;background:#f59e0b20;border:1px solid #f59e0b60;color:#f59e0b;font-size:11px;font-weight:800;letter-spacing:1.5px;padding:6px 18px;border-radius:999px;text-transform:uppercase;">
                      🛎️ NOVO PEDIDO CHEGOU
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px 32px 0;text-align:center;">
                    <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#f1f5f9;">Pedido #${shortId}</p>
                    <p style="margin:0;font-size:14px;color:#94a3b8;">Um novo pedido chegou pela BadStore!</p>
                  </td>
                </tr>
              </table>

              <!-- Client info box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d1f;border:1px solid #1e1e38;border-radius:10px;">
                      <tr>
                        <td style="padding:16px 20px;border-bottom:1px solid #1e1e38;">
                          <p style="margin:0 0 2px;font-size:10px;font-weight:700;letter-spacing:1.5px;color:#94a3b8;text-transform:uppercase;">Cliente</p>
                          <p style="margin:0;font-size:15px;font-weight:700;color:#f1f5f9;">${customerName || '—'}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:16px 20px;border-bottom:1px solid #1e1e38;">
                          <p style="margin:0 0 2px;font-size:10px;font-weight:700;letter-spacing:1.5px;color:#94a3b8;text-transform:uppercase;">Contato</p>
                          <p style="margin:0;font-size:14px;color:#f1f5f9;">${customerContact || '—'}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:16px 20px;">
                          <p style="margin:0 0 2px;font-size:10px;font-weight:700;letter-spacing:1.5px;color:#94a3b8;text-transform:uppercase;">Email</p>
                          <p style="margin:0;font-size:14px;color:#f1f5f9;">${customerEmail || '—'}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Items table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0 32px;">
                <tr>
                  <td style="padding:0 0 8px;">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#94a3b8;text-transform:uppercase;">Itens do pedido</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 32px;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d1f;border:1px solid #1e1e38;border-radius:10px;overflow:hidden;">
                      <thead>
                        <tr style="background:#1e1e38;">
                          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Item</th>
                          <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Qtd</th>
                          <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Unitário</th>
                          <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemRows}
                      </tbody>
                      <tfoot>
                        <tr style="background:#1a1a30;">
                          <td colspan="3" style="padding:12px 16px;font-size:14px;font-weight:700;color:#f1f5f9;text-align:right;">Total</td>
                          <td style="padding:12px 16px;font-size:18px;font-weight:900;color:#f59e0b;text-align:right;">${fmtBRL(total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:28px 32px;">
                    <a href="http://localhost:5173/vendas"
                       style="display:inline-block;background:#f59e0b;color:#000000;font-size:14px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.3px;">
                      Ver no BadTracking →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:20px 24px 32px;border-top:1px solid #1e1e38;">
                    <p style="margin:0;font-size:12px;color:#94a3b8;">BAD TCG · <a href="https://badtcg.com" style="color:#f59e0b;text-decoration:none;">badtcg.com</a></p>
                    <p style="margin:6px 0 0;font-size:11px;color:#4a4a6a;">Notificação interna da loja.</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { orderId, customerName, customerEmail, customerContact, items, total } = req.body

    const shortId = (orderId || '').slice(-6).toUpperCase()

    const sends = []

    // Always send owner notification
    sends.push(
      resend.emails.send({
        from:    FROM,
        to:      OWNER_EMAIL,
        subject: `🛎️ Novo pedido #${shortId} – ${customerName || 'cliente'}`,
        html:    buildOwnerEmailHtml({ orderId, customerName, customerContact, customerEmail, items, total }),
      })
    )

    await Promise.allSettled(sends)

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[order-created]', e)
    return res.status(200).json({ ok: true })
  }
}
