import { describe, expect, test } from 'bun:test'
import { renderHelpMarkdown } from '../../scripts/render-help'

describe('renderHelpMarkdown', () => {
  test('uses Bun Markdown to produce semantic, filtered help markup', () => {
    const html = renderHelpMarkdown(
      '## Natural input\n\nTry **implicit multiplication** and `<script>bad()</script>`.',
    )

    expect(html).toContain('<h2>Natural input</h2>')
    expect(html).toContain('<strong>implicit multiplication</strong>')
    expect(html).not.toContain('<script>')
  })
})
