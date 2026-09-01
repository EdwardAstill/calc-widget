import katex from 'katex'
import { useMemo } from 'react'

type MathMarkupProps = {
  latex: string
  className?: string
}

export function MathMarkup({ latex, className }: MathMarkupProps) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        throwOnError: false,
        strict: false,
        output: 'html',
      }),
    [latex],
  )

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
