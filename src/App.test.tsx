import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('hosts both approved calculator workspace columns', () => {
    render(<App />)

    expect(screen.getByLabelText(/scientific calculator workspace/i)).toBeVisible()
    expect(screen.getByRole('heading', { name: /shared relations/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /plot.*v2/i })).toBeDisabled()
  })
})
