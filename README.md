# Scientific Calculator V1

A browser-only symbolic scientific calculator built with React and TypeScript. It combines every saved relation into one real-number system, renders live mathematics, and runs full nonlinear multivariable solving through SymPy in a Pyodide Web Worker.

V1 includes the Calculator and Shared Relations workspaces. Plot controls are intentionally visible but disabled for V2.

## Run locally

Requirements:

- Node.js 20.19 or newer
- npm
- An internet connection for the first calculation, when the worker downloads exact-version Pyodide and SymPy assets

```bash
npm install
npm run dev
```

Open the local address printed by Vite. The interface and parser load immediately; the first calculation takes longer while the Python engine starts. Later calculations reuse the running worker.

## Calculator notation

The editor accepts ordinary calculator syntax rather than requiring LaTeX:

| Purpose | Example |
| --- | --- |
| Implicit multiplication | `2x`, `2(x+1)`, `(x+1)(x-1)` |
| Equation constraint | `2x + 3 = 7` |
| Expression query | `x^2 + 1` |
| Scientific function | `sin(pi/2)`, `sqrt(2)`, `ln(e)` |
| Algebra operation | `simplify((x^2-1)/(x-1))`, `expand((x+1)^3)`, `factor(x^2-1)` |
| Calculus operation | `diff(x^3, x)`, `integrate(sin(x), x)`, `limit(sin(x)/x, x, 0)` |

Parentheses are standard. Braces are accepted as grouping for familiarity, but they are never required. `^` is exponentiation and function names are case-insensitive.

## Shared-relation behavior

- Every saved equation row is a constraint.
- Every saved bare expression is a query evaluated across each solution.
- Editing a row loads it into the editor; Save updates that row in place.
- Exact values are preserved, and every finite discrete real solution is returned.
- Symbolic algebra and calculus operations may return symbolic expressions.
- Parameterized results are reported as underdetermined instead of being presented as final answers.
- V1 deliberately classifies a system as overdefined when equation-row count is greater than distinct unknown-variable count—even if the extra equation is redundant.

The result panel distinguishes:

- **No real solution:** the real solution set was proven empty.
- **Underdetermined:** free degrees of freedom remain.
- **Overdefined:** the strict V1 row-count rule was triggered.
- **Unresolved:** the request is valid, but SymPy did not produce a decisive finite result.
- **Unsupported:** the notation is valid, but the requested feature is outside V1.
- **Solver error:** the Python runtime or worker could not complete the request; the panel offers a retry.

## Verification

Run the browser-side unit and component tests, static checks, lint, and production build:

```bash
npm run test:run
npm run typecheck
npm run lint
npm run build
```

The trusted Python solver also has an independent contract suite:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests/python/test_solver.py -q
```

## Architecture

```text
React workspace
├── TypeScript tokenizer, parser, AST analysis, and KaTeX generation
├── relation reducer and accessible UI components
└── typed solver client
    └── Web Worker
        └── Pyodide → trusted Python AST adapter → SymPy
```

Only validated AST objects cross the worker boundary. User input is never passed to JavaScript evaluation or Python `eval`, `exec`, or `sympify`. The Python adapter recursively constructs SymPy values through closed node and function dispatch tables.

The embeddable feature and its public exports live in `src/calculator/`; `src/App.tsx` is only the Vite demonstration host. That boundary is intended to become the source of a future shadcn registry item.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run test` | Run Vitest in watch mode |
| `npm run test:run` | Run tests once |
| `npm run typecheck` | Run the TypeScript project checks |
| `npm run lint` | Run Oxlint |
| `npm run build` | Create the production bundle in `dist/` |
| `npm run preview` | Preview the production bundle |

## V1 limits

V1 solves over the real numbers and supports scalar arithmetic, scientific functions, algebra operations, and single-variable calculus operations. Matrices, units, statistics, probability, optimization, persistence, accounts, collaboration, and plotting are outside this release.
