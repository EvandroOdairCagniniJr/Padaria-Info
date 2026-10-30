// Comprovante como arquivo de verdade: desenhado num canvas (imagem PNG) e embalado num PDF.
// Tudo no navegador, sem biblioteca extra e sem internet.
import { lojaDe, numeroComprovante, type Comprovante } from '@/features/pdv/comprovante'
import { coresComprovante } from '@/features/padaria/opcoesComprovante'
import { formatBRL, formatDataHora, formatQuantidade } from '@/lib/format'

const LARGURA = 420
const MARGEM = 28
const ESCALA = 2

const cores = {
  fundo: '#f5efe6',
  papel: '#ffffff',
  marca: '#9a5420',
  marcaClara: '#fbf3e8',
  texto: '#1c1917',
  suave: '#78716c',
  linha: '#e7e0d6',
  ok: '#15803d',
  okFundo: '#dcfce7',
}

// Usa a fonte do sistema da padaria (Geist), se já carregou; senão a padrão do aparelho.
const SANS = "'Geist Variable', 'Segoe UI', Roboto, Arial, sans-serif"

function brl(valor: number) {
  return formatBRL(valor).replace(/\s/g, ' ')
}

function fonte(tamanho: number, peso = 400) {
  return `${peso} ${tamanho}px ${SANS}`
}

// Quebra um texto na largura disponível (nomes de produto compridos).
function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number) {
  const linhas: string[] = []
  let atual = ''
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra
    if (atual && ctx.measureText(tentativa).width > largura) {
      linhas.push(atual)
      atual = palavra
    } else {
      atual = tentativa
    }
  }
  if (atual) linhas.push(atual)
  return linhas.length ? linhas : ['']
}

// Desenha o comprovante e devolve a altura usada. Roda duas vezes: a primeira só mede
// (desenhar = false) para saber o tamanho do papel.
function desenhar(
  ctx: CanvasRenderingContext2D,
  c: Comprovante,
  desenhar: boolean,
  logo: HTMLImageElement | null = null,
) {
  const esq = MARGEM
  const dir = LARGURA - MARGEM
  const util = dir - esq
  let y = 0

  function texto(
    t: string,
    x: number,
    tamanho: number,
    opcoes: { peso?: number; cor?: string; alinhar?: CanvasTextAlign } = {},
  ) {
    if (!desenhar) return
    ctx.font = fonte(tamanho, opcoes.peso)
    ctx.fillStyle = opcoes.cor ?? cores.texto
    ctx.textAlign = opcoes.alinhar ?? 'left'
    ctx.fillText(t, x, y)
  }

  function separador(tracejado = true) {
    if (desenhar) {
      ctx.strokeStyle = cores.linha
      ctx.lineWidth = 1
      ctx.setLineDash(tracejado ? [5, 4] : [])
      ctx.beginPath()
      ctx.moveTo(esq, y)
      ctx.lineTo(dir, y)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  function linhaInfo(rotulo: string, valor: string, destaque = false) {
    y += 22
    texto(rotulo, esq, 13, { cor: cores.suave })
    texto(valor, dir, 13, { peso: destaque ? 700 : 500, alinhar: 'right' })
  }

  // Cabeçalho: faixa com a marca da padaria (endereço comprido quebra em mais linhas).
  const loja = lojaDe(c)
  const ver = loja.opcoes.mostrar
  const corMarca = coresComprovante[loja.opcoes.cor].hex
  ctx.font = fonte(11)
  const linhasLoja = loja.linhas.flatMap((l) => quebrar(ctx, l, util))
  const alturaFaixa = 96 + linhasLoja.length * 16
  if (desenhar) {
    ctx.fillStyle = corMarca
    ctx.fillRect(0, 0, LARGURA, alturaFaixa)
    if (logo) {
      // Logo da padaria num círculo branco, inteira (sem cortar), no lugar da inicial.
      const raio = 24
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(LARGURA / 2, 34, raio, 0, Math.PI * 2)
      ctx.fill()
      const caixa = raio * 1.5
      const escala = Math.min(caixa / logo.naturalWidth, caixa / logo.naturalHeight)
      const w = logo.naturalWidth * escala
      const h = logo.naturalHeight * escala
      ctx.save()
      ctx.beginPath()
      ctx.arc(LARGURA / 2, 34, raio - 1, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(logo, LARGURA / 2 - w / 2, 34 - h / 2, w, h)
      ctx.restore()
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.arc(LARGURA / 2, 34, 20, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  y = 34
  if (!logo) {
    if (desenhar) ctx.textBaseline = 'middle'
    texto(loja.nome.trim().charAt(0).toUpperCase() || 'P', LARGURA / 2, 20, {
      peso: 700,
      cor: '#fff',
      alinhar: 'center',
    })
    if (desenhar) ctx.textBaseline = 'alphabetic'
  }
  y = 80
  texto(loja.nome, LARGURA / 2, 20, { peso: 700, cor: '#fff', alinhar: 'center' })
  for (const dado of linhasLoja) {
    y += 16
    texto(dado, LARGURA / 2, 11, { cor: 'rgba(255,255,255,0.85)', alinhar: 'center' })
  }
  y = alturaFaixa

  // Título, selo de pagamento confirmado e o valor em destaque.
  y += 34
  texto(c.segundaVia ? `${loja.opcoes.titulo} · 2ª via` : loja.opcoes.titulo, LARGURA / 2, 15, {
    peso: 600,
    alinhar: 'center',
  })
  y += 18
  if (desenhar && ver.selo) {
    const selo = 'Pagamento confirmado'
    ctx.font = fonte(12, 600)
    const w = ctx.measureText(selo).width + 34
    const x = (LARGURA - w) / 2
    ctx.fillStyle = cores.okFundo
    ctx.beginPath()
    ctx.roundRect(x, y, w, 24, 12)
    ctx.fill()
    // Visto desenhado (sem emoji, que alguns aparelhos não mostram).
    ctx.strokeStyle = cores.ok
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + 11, y + 12)
    ctx.lineTo(x + 15, y + 16)
    ctx.lineTo(x + 22, y + 8)
    ctx.stroke()
    ctx.fillStyle = cores.ok
    ctx.textAlign = 'left'
    ctx.fillText(selo, x + 27, y + 16.5)
  }
  y += (ver.selo ? 24 : 0) + 46
  texto(brl(c.total), LARGURA / 2, 34, { peso: 700, alinhar: 'center' })

  // Detalhes da venda.
  y += 22
  separador()
  linhaInfo('Data e hora', formatDataHora(c.quando))
  if (ver.numero) linhaInfo('Nº do comprovante', numeroComprovante(c))
  linhaInfo('Forma de pagamento', c.formaPagamento)
  if (c.recebido != null) {
    linhaInfo('Valor recebido', brl(c.recebido))
    linhaInfo('Troco', brl(c.recebido - c.total))
  }
  if (ver.atendente && c.atendente) linhaInfo('Atendente', c.atendente)

  // Itens.
  y += 20
  separador()
  y += 26
  texto('ITENS', esq, 11, { peso: 600, cor: cores.suave })
  ctx.font = fonte(14, 500)
  for (const item of c.itens) {
    const subtotal = brl(item.quantidade * item.precoUnitario)
    ctx.font = fonte(14, 500)
    const largNome = util - ctx.measureText(subtotal).width - 16
    const linhasNome = quebrar(ctx, item.nome, largNome)
    y += 22
    texto(linhasNome[0], esq, 14, { peso: 500 })
    texto(subtotal, dir, 14, { peso: 500, alinhar: 'right' })
    for (const resto of linhasNome.slice(1)) {
      y += 18
      texto(resto, esq, 14, { peso: 500 })
    }
    if (ver.detalhe_itens) {
      y += 17
      texto(
        `${formatQuantidade(item.quantidade)} ${item.unidade} × ${brl(item.precoUnitario)}`,
        esq,
        12,
        { cor: cores.suave },
      )
    }
    if (item.desconto) {
      y += 17
      texto(item.promocao ?? 'Desconto', esq, 12, { cor: cores.ok })
      texto(`− ${brl(item.desconto)}`, dir, 12, { cor: cores.ok, alinhar: 'right' })
    }
  }

  // Total.
  y += 18
  separador(false)
  if (ver.resumo) {
    // Resumo: quantos itens e, havendo desconto, o subtotal antes dele.
    const qtd = c.itens.length
    y += 24
    texto(`${qtd} ${qtd === 1 ? 'item' : 'itens'}`, esq, 13, { cor: cores.suave })
    if (c.descontos) {
      texto(`Subtotal ${brl(c.total + c.descontos)}`, dir, 13, { cor: cores.suave, alinhar: 'right' })
    }
  }
  if (c.descontos) {
    y += 24
    texto('Você economizou', esq, 13, { peso: 600, cor: cores.ok })
    texto(`− ${brl(c.descontos)}`, dir, 13, { peso: 600, cor: cores.ok, alinhar: 'right' })
  }
  y += 30
  texto('Total', esq, 16, { peso: 700 })
  texto(brl(c.total), dir, 18, { peso: 700, alinhar: 'right' })

  // Rodapé.
  y += 30
  separador()
  y += 26
  texto(loja.mensagem || 'Obrigado pela preferência!', LARGURA / 2, 13, {
    peso: 600,
    alinhar: 'center',
  })
  // Recado extra do dono (Wi-Fi, Instagram, encomendas...), quebrado na largura do cupom.
  if (loja.opcoes.mensagem_extra) {
    ctx.font = fonte(12)
    for (const linha of quebrar(ctx, loja.opcoes.mensagem_extra, util)) {
      y += 17
      texto(linha, LARGURA / 2, 12, { cor: cores.texto, alinhar: 'center' })
    }
  }
  y += 18
  texto('Documento sem valor fiscal', LARGURA / 2, 11, { cor: cores.suave, alinhar: 'center' })
  y += 28
  return y
}

// Borda serrilhada embaixo, como papel de cupom destacado.
function serrilhar(ctx: CanvasRenderingContext2D, altura: number) {
  const dente = 10
  ctx.fillStyle = cores.fundo
  ctx.beginPath()
  ctx.moveTo(0, altura)
  for (let x = 0; x <= LARGURA; x += dente) {
    ctx.lineTo(x + dente / 2, altura - dente / 2)
    ctx.lineTo(x + dente, altura)
  }
  ctx.lineTo(LARGURA, altura + 1)
  ctx.lineTo(0, altura + 1)
  ctx.fill()
}

// Logo da padaria pronta para o canvas; se não carregar, o comprovante sai com a inicial.
function carregarLogo(src: string | null | undefined) {
  if (!src) return Promise.resolve(null)
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function desenharComprovante(c: Comprovante) {
  // Espera a fonte para a medida bater com o desenho.
  await document.fonts?.load(fonte(14, 500)).catch(() => undefined)
  const medidor = document.createElement('canvas').getContext('2d')
  if (!medidor) throw new Error('Não foi possível gerar o comprovante')
  const altura = Math.ceil(desenhar(medidor, c, false))

  const canvas = document.createElement('canvas')
  canvas.width = LARGURA * ESCALA
  canvas.height = altura * ESCALA
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível gerar o comprovante')
  ctx.scale(ESCALA, ESCALA)
  ctx.fillStyle = cores.papel
  ctx.fillRect(0, 0, LARGURA, altura)
  desenhar(ctx, c, true, await carregarLogo(lojaDe(c).logo))
  serrilhar(ctx, altura)
  return canvas
}

function nomeArquivo(c: Comprovante, extensao: string) {
  return `comprovante-${numeroComprovante(c)}.${extensao}`
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar o arquivo'))),
      tipo,
      qualidade,
    ),
  )
}

export async function imagemComprovante(c: Comprovante) {
  return new File(
    [await paraBlob(await desenharComprovante(c), 'image/png')],
    nomeArquivo(c, 'png'),
    {
      type: 'image/png',
    },
  )
}

// PDF de uma página do tamanho do comprovante, com a imagem em JPEG dentro.
export async function pdfComprovante(c: Comprovante) {
  const canvas = await desenharComprovante(c)
  const jpeg = new Uint8Array(await (await paraBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer())
  // 1 px de tela = 0,75 pt no PDF.
  const larguraPt = (LARGURA * 0.75).toFixed(2)
  const alturaPt = ((canvas.height / ESCALA) * 0.75).toFixed(2)
  const desenho = `q ${larguraPt} 0 0 ${alturaPt} 0 0 cm /Im0 Do Q`

  const partes: (string | Uint8Array)[] = []
  const posicoes: number[] = []
  let tamanho = 0
  const enc = new TextEncoder()
  function add(parte: string | Uint8Array) {
    const bytes = typeof parte === 'string' ? enc.encode(parte) : parte
    partes.push(bytes)
    tamanho += bytes.length
  }
  function objeto(corpo: () => void) {
    posicoes.push(tamanho)
    add(`${posicoes.length} 0 obj\n`)
    corpo()
    add('\nendobj\n')
  }

  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  objeto(() => add('<< /Type /Catalog /Pages 2 0 R >>'))
  objeto(() => add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'))
  objeto(() =>
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${larguraPt} ${alturaPt}] ` +
        '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
    ),
  )
  objeto(() => {
    add(
      `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    )
    add(jpeg)
    add('\nendstream')
  })
  objeto(() => add(`<< /Length ${desenho.length} >>\nstream\n${desenho}\nendstream`))
  objeto(() => add(`<< /Title (Comprovante ${numeroComprovante(c)}) /Producer (Coffee Break) >>`))

  const inicioXref = tamanho
  add(`xref\n0 ${posicoes.length + 1}\n0000000000 65535 f \n`)
  for (const p of posicoes) add(`${String(p).padStart(10, '0')} 00000 n \n`)
  add(
    `trailer\n<< /Size ${posicoes.length + 1} /Root 1 0 R /Info ${posicoes.length} 0 R >>\n` +
      `startxref\n${inicioXref}\n%%EOF`,
  )
  return new File(partes as BlobPart[], nomeArquivo(c, 'pdf'), { type: 'application/pdf' })
}

export function baixar(arquivo: File) {
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement('a')
  link.href = url
  link.download = arquivo.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// Celular (e Windows 11): abre o "Compartilhar" do sistema com o arquivo (WhatsApp, e-mail...).
// Onde não dá, baixa o arquivo.
export async function compartilhar(arquivo: File) {
  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: 'Comprovante de venda' })
      return 'compartilhado' as const
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelado' as const
    }
  }
  baixar(arquivo)
  return 'baixado' as const
}

// Imprime o comprovante (impressora de cupom 80 mm ou A4) numa janela invisível.
export async function imprimir(c: Comprovante) {
  const canvas = await desenharComprovante(c)
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const janela = iframe.contentWindow
  if (!doc || !janela) return
  doc.open()
  doc.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Comprovante ${numeroComprovante(c)}</title>
    <style>@page { size: 80mm auto; margin: 3mm; } body { margin: 0; } img { width: 100%; }</style>
    </head><body><img src="${canvas.toDataURL('image/png')}"></body></html>`)
  doc.close()
  const img = doc.querySelector('img')
  const pronto = () => {
    janela.focus()
    janela.print()
    setTimeout(() => iframe.remove(), 60_000)
  }
  if (img && !img.complete) img.addEventListener('load', pronto, { once: true })
  else pronto()
}
