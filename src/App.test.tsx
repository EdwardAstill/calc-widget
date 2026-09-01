import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('introduces the scientific calculator workspace and keeps plotting disabled', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: /scientific calculator/i }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /plot.*v2/i })).toBeDisabled()
  })
})
