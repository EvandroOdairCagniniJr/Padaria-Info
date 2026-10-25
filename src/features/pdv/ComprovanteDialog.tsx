import { Copy, FileDown, ImageDown, Loader2, MessageCircle, Printer, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  linkWhatsapp,
  normalizarWhatsapp,
  textoComprovante,
  type Comprovante,
} from '@/features/pdv/comprovante'
import {
  baixar,
  compartilhar,
  desenharComprovante,
  imagemComprovante,
  imprimir,
  pdfComprovante,
} from '@/features/pdv/comprovanteArquivo'

interface ComprovanteDialogProps {
  comprovante: Comprovante | null
  onClose: () => void
}

// Remontado a cada venda (key no PdvPage), então o campo de WhatsApp sempre começa vazio.
export function ComprovanteDialog({ comprovante, onClose }: ComprovanteDialogProps) {
  const [whatsapp, setWhatsapp] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [gerando, setGerando] = useState<string | null>(null)
  // Celular e Windows 11 abrem o "Compartilhar" do sistema com o arquivo.
  const podeCompartilhar = typeof navigator.canShare === 'function'

  useEffect(() => {
    if (!comprovante) return
    let ativo = true
    desenharComprovante(comprovante)
      .then((canvas) => ativo && setPrevia(canvas.toDataURL('image/png')))
      .catch(() => undefined)
    return () => {
      ativo = false
    }
  }, [comprovante])

  async function acao(nome: string, fazer: (c: Comprovante) => Promise<unknown>) {
    if (!comprovante || gerando) return
    setGerando(nome)
    try {
      await fazer(comprovante)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar o comprovante')
    } finally {
      setGerando(null)
    }
  }

  function enviarWhatsapp() {
    if (!comprovante) return
    const numero = normalizarWhatsapp(whatsapp)
    if (!numero) {
      setErro('Número inválido. Use DDD + número, ex: (11) 98765-4321')
      return
    }
    window.open(linkWhatsapp(numero, textoComprovante(comprovante)), '_blank', 'noopener')
    toast.success('WhatsApp aberto com o comprovante — é só tocar em enviar')
  }

  async function copiar() {
    if (!comprovante) return
    try {
      await navigator.clipboard.writeText(textoComprovante(comprovante))
      toast.success('Comprovante copiado')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  const icone = (nome: string, Icone: typeof FileDown) =>
    gerando === nome ? <Loader2 className="size-4 animate-spin" /> : <Icone className="size-4" />

  return (
    <Dialog open={Boolean(comprovante)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {comprovante?.segundaVia ? 'Comprovante — 2ª via' : 'Venda concluída'}
          </DialogTitle>
          <DialogDescription>
            Entregue o comprovante do jeito que o cliente preferir.
          </DialogDescription>
        </DialogHeader>

        {comprovante && (
          <div className="space-y-4">
            <div className="flex max-h-[42svh] justify-center overflow-y-auto rounded-lg bg-[#f5efe6] p-3">
              {previa ? (
                <img
                  src={previa}
                  alt="Prévia do comprovante"
                  className="h-auto w-full max-w-[300px] rounded-sm shadow-md"
                />
              ) : (
                <Loader2 className="my-16 size-6 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => acao('pdf', async (c) => baixar(await pdfComprovante(c)))}
              >
                {icone('pdf', FileDown)}
                Baixar PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => acao('imagem', async (c) => baixar(await imagemComprovante(c)))}
              >
                {icone('imagem', ImageDown)}
                Baixar imagem
              </Button>
              <Button variant="outline" onClick={() => acao('imprimir', imprimir)}>
                {icone('imprimir', Printer)}
                Imprimir
              </Button>
              {podeCompartilhar ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    acao('compartilhar', async (c) => {
                      const r = await compartilhar(await pdfComprovante(c))
                      if (r === 'baixado') toast.info('PDF baixado — anexe no WhatsApp do cliente')
                    })
                  }
                >
                  {icone('compartilhar', Share2)}
                  Compartilhar
                </Button>
              ) : (
                <Button variant="outline" onClick={copiar}>
                  <Copy className="size-4" />
                  Copiar texto
                </Button>
              )}
            </div>

            <form
              className="space-y-2 rounded-md border bg-muted/30 p-3"
              onSubmit={(e) => {
                e.preventDefault()
                enviarWhatsapp()
              }}
            >
              <Label htmlFor="whatsapp">Mandar no WhatsApp do cliente (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  id="whatsapp"
                  inputMode="tel"
                  placeholder="(11) 98765-4321"
                  value={whatsapp}
                  onChange={(e) => {
                    setWhatsapp(e.target.value)
                    setErro(null)
                  }}
                />
                <Button type="submit" variant="outline" disabled={!whatsapp.trim()}>
                  <MessageCircle className="size-4" />
                  Enviar
                </Button>
              </div>
              {erro ? (
                <p className="text-xs text-destructive">{erro}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Abre a conversa com o resumo do comprovante. Para mandar o PDF ou a imagem, baixe
                  e anexe na conversa{podeCompartilhar && ', ou use Compartilhar'}.
                </p>
              )}
            </form>
          </div>
        )}

        <DialogFooter>
          <Button className="w-full sm:w-auto sm:flex-1" onClick={onClose}>
            {comprovante?.segundaVia ? 'Fechar' : 'Nova venda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
