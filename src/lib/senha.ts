// Mesma regra do servidor (server/auth.ts, senhaSchema): 8+ caracteres, com letras e números.
export const REGRA_SENHA = 'Pelo menos 8 caracteres, com letras e números'

export function erroSenha(senha: string) {
  if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres'
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return 'A senha precisa ter letras e números'
  return null
}
