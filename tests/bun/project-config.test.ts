import { describe, expect, test } from 'bun:test'

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await Bun.file(path).text()) as Record<string, unknown>
}

describe('project configuration', () => {
  test('uses Bun HTML entrypoints instead of Vite for the preview lifecycle', async () => {
    const pkg = await readJson('package.json')
    const scripts = pkg.scripts as Record<string, string>
    const dependencies = pkg.dependencies as Record<string, unknown> | undefined
    const devDependencies = pkg.devDependencies as Record<string, unknown> | undefined

    expect(scripts.dev).toContain('bun preview/index.html')
    expect(scripts.dev).toContain('generate:css')
    expect(scripts.build).toContain('bun build preview/index.html')
    expect(dependencies?.vite).toBeUndefined()
    expect(devDependencies?.vite).toBeUndefined()
    expect(devDependencies?.['@vitejs/plugin-react']).toBeUndefined()
    expect(devDependencies?.['bun-plugin-tailwind']).toBeUndefined()
    expect(devDependencies?.['@tailwindcss/cli']).toBe('4.2.1')
  })

  test('pins the default Base UI shadcn preset', async () => {
    const config = await readJson('components.json')

    expect(config.style).toBe('base-nova')
    expect(config.iconLibrary).toBe('lucide')
    expect(config.tailwind).toMatchObject({
      config: '',
      css: 'preview/globals.css',
      baseColor: 'neutral',
      cssVariables: true,
    })
    expect(config.rsc).toBe(false)
  })

  test('supports TypeScript 6 project type checking', async () => {
    const config = await readJson('tsconfig.json')
    const compilerOptions = config.compilerOptions as Record<string, unknown>

    expect(compilerOptions.ignoreDeprecations).toBe('6.0')
  })
})
