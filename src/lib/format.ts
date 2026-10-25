export function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatQuantidade(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

// Datas `date` do banco (YYYY-MM-DD) — interpretadas no fuso local, não em UTC.
export function formatData(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR')
}

export function formatDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// "agora", "há 5 min", "há 3 h", "há 2 dias" — para acompanhar a equipe.
export function tempoRelativo(iso: string | null) {
  if (!iso) return 'nunca'
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'ontem' : `há ${dias} dias`
}

// Data local de hoje em YYYY-MM-DD. Não usar `toISOString()`, que devolve a data em UTC
// (no Brasil, depois das 21h já seria "amanhã").
export function hojeISO() {
  return dataLocalISO(new Date())
}

export function adicionarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + dias)
  return dataLocalISO(d)
}

function dataLocalISO(d: Date) {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

// Início do dia local (hoje, ou `diasAtras` dias antes) como timestamp ISO, para filtrar por data/hora.
export function inicioDoDiaISO(diasAtras = 0) {
  const d = new Date()
  d.setDate(d.getDate() - diasAtras)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// O servidor já devolve mensagens prontas para o usuário (ver server/http.ts).
export function mensagemErro(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}
