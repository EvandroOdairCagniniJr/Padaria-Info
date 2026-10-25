// Envio de e-mails (código de "Esqueci minha senha") por SMTP, configurado no .env.
// Sem SMTP configurado, o código aparece no terminal do servidor para não travar o uso.
import nodemailer from 'nodemailer'

const host = process.env.SMTP_HOST
const porta = Number(process.env.SMTP_PORT ?? 587)
const remetente = process.env.SMTP_FROM || process.env.SMTP_USER

const transporte = host
  ? nodemailer.createTransport({
      host,
      port: porta,
      // 465 = conexão já criptografada; 587 = STARTTLS.
      secure: porta === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null

function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export async function enviarCodigoSenha(
  para: string,
  nome: string,
  codigo: string,
  padaria: string,
) {
  if (!transporte) {
    console.warn(
      `\n[e-mail] SMTP não configurado no .env — código de recuperação de ${para}: ${codigo}\n`,
    )
    return
  }
  const saudacao = nome ? `Olá, ${nome.split(' ')[0]}!` : 'Olá!'
  await transporte.sendMail({
    from: { name: padaria, address: remetente! },
    to: para,
    subject: `${codigo} é o seu código de acesso — ${padaria}`,
    text:
      `${saudacao}\n\nSeu código para entrar no sistema da ${padaria} é: ${codigo}\n\n` +
      'Ele vale por 15 minutos. Se você não pediu este código, ignore este e-mail — ' +
      'sua senha continua a mesma.',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;color:#3b2a1d">
        <h2 style="margin:0 0 12px">${escapar(padaria)}</h2>
        <p>${escapar(saudacao)}</p>
        <p>Use o código abaixo para entrar no sistema:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#fbefdc;
                  border-radius:12px;padding:16px;text-align:center;margin:16px 0">${codigo}</p>
        <p style="font-size:13px;color:#7a6552">
          O código vale por 15 minutos. Se você não pediu este código, ignore este e-mail —
          sua senha continua a mesma.
        </p>
      </div>`,
  })
}
