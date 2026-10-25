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
