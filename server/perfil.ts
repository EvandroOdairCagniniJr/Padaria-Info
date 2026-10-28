// Alterações de perfil (pela própria pessoa ou pelo dono) sempre passam por aqui:
// grava em usuarios e deixa o rastro em historico_perfil.
import { randomUUID } from 'node:crypto'
import type { RowDataPacket } from './db.ts'
import { transaction } from './db.ts'
import { HttpError } from './http.ts'
import { esquecerUsuario } from './cacheUsuarios.ts'

// Papel antes do cargo: numa promoção com os dois, o cargo novo é o que vai para o selo.
const camposRastreados = ['nome', 'papel', 'cargo', 'foto'] as const

export interface AlteracoesPerfil {
  nome?: string
  cargo?: string
  papel?: string
  foto?: string | null
  ativo?: boolean
  senha_hash?: string
  telefone?: string | null
  cpf?: string | null
  data_nascimento?: string | null
  data_admissao?: string | null
  turno?: string | null
  endereco?: object | null
  contato_emergencia?: object | null
  observacoes?: string | null
}

export async function alterarPerfil(
  usuarioId: string,
  alteradoPor: string,
  mudancas: AlteracoesPerfil,
) {
  const entradas = Object.entries(mudancas).filter(([, v]) => v !== undefined)
  if (entradas.length === 0) return

  // A pessoa mudou: o login dela é relido do banco na próxima requisição.
  esquecerUsuario(usuarioId)
  await transaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      'select padaria_id, nome, cargo, papel, foto from usuarios where id = ? for update',
      [usuarioId],
    )
    const antes = rows[0]
    if (!antes) throw new HttpError(404, 'Membro não encontrado')

    await conn.query(
      `update usuarios set ${entradas.map(([k]) => `"${k}" = ?`).join(', ')} where id = ?`,
      // Endereço e contato de emergência vão como JSON.
      [...entradas.map(([, v]) => (v && typeof v === 'object' ? JSON.stringify(v) : v)), usuarioId],
    )

    // Senha nova ou acesso desativado: os logins abertos dessa pessoa deixam de valer.
    if (mudancas.senha_hash !== undefined || mudancas.ativo === false) {
      await conn.query('update usuarios set sessao_versao = sessao_versao + 1 where id = ?', [usuarioId])
    }

    for (const campo of camposRastreados) {
      const novo = mudancas[campo]
      if (novo === undefined || novo === antes[campo]) continue
      // A foto em si não vai para o histórico (é grande); só o aviso de que mudou.
      const ehFoto = campo === 'foto'
      await conn.query(
        `insert into historico_perfil
           (id, padaria_id, usuario_id, campo, valor_antigo, valor_novo, alterado_por)
         values (?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          antes.padaria_id,
          usuarioId,
          campo,
          ehFoto ? null : antes[campo],
          ehFoto ? (novo ? 'nova' : null) : novo,
          alteradoPor,
        ],
      )
    }
  })
  esquecerUsuario(usuarioId)
}
