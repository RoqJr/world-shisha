/**
 * Logo oficial (rosh com "WS"). A imagem é usada como máscara, então o logo
 * assume a cor do texto: branco no tema escuro e preto no tema claro.
 */
export default function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        height: size,
        width: Math.round((size * 353) / 384),
        maskImage: 'url(/logo-mask.png)',
        WebkitMaskImage: 'url(/logo-mask.png)',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}
