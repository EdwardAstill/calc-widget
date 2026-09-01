type MathMarkupProps = {
  mathml: string
  className?: string
}

export function MathMarkup({ mathml, className }: MathMarkupProps) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: mathml }}
    />
  )
}
