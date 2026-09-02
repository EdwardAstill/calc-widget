import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ScientificCalculator } from '@/registry/scientific-calculator'
import '@fontsource-variable/geist'
import './generated.css'

const root = document.getElementById('root')

if (!root) throw new Error('Preview root was not found.')

createRoot(root).render(
  <StrictMode>
    <ScientificCalculator />
  </StrictMode>,
)
