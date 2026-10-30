// Recorta a foto no centro (quadrada) e reduz para 256px em JPEG: fica com ~20–40 KB,
// leve o bastante para guardar no banco e mostrar em todos os cubículos da equipe.
export async function reduzirFoto(arquivo: File, lado = 256): Promise<string> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem')
  const bitmap = await createImageBitmap(arquivo)
  const recorte = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = lado
  canvas.height = lado
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem')
  ctx.drawImage(
    bitmap,
    (bitmap.width - recorte) / 2,
    (bitmap.height - recorte) / 2,
    recorte,
    recorte,
    0,
    0,
    lado,
    lado,
  )
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}

// Logo da padaria: cabe num quadro de 320px sem cortar (mantém o formato) e guarda o fundo
// transparente (WebP; PNG nos navegadores que não geram WebP). Fica com ~10–80 KB.
export async function reduzirLogo(arquivo: File, lado = 320): Promise<string> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem')
  const bitmap = await createImageBitmap(arquivo)
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * escala))
  canvas.height = Math.max(1, Math.round(bitmap.height * escala))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const webp = canvas.toDataURL('image/webp', 0.9)
  const url = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
  if (url.length > 400_000) throw new Error('Essa imagem ficou grande demais. Tente uma versão mais simples da logo.')
  return url
}
