# Scientific Calculator V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved browser-only V1 scientific calculator with a typed forgiving DSL, persistent shared relations, and real nonlinear symbolic solving in a Pyodide Web Worker.

**Architecture:** A shadcn-compatible React feature owns interaction and reducer state. Pure TypeScript modules parse source into a serializable AST, analyze it, and produce native MathML; a typed worker client sends only AST data to a trusted Python module that constructs SymPy objects recursively and returns presentation MathML. Bun renders the authored Markdown help during development and production builds.

**Tech Stack:** Bun 1.4, Vite 8, React 19, TypeScript 6, Vitest 4, Testing Library, native MathML, Lucide React, Pyodide 314, Python/SymPy, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-09-01-scientific-calculator-v1-design.md`

## Global Constraints

- Calculator and Relations ship in V1; Plot is visible, disabled, and labelled V2.
- Accept explicit and implicit multiplication; never require curly-brace notation.
- Treat all saved equation rows as constraints and bare expressions as queries in one real system.
- Enforce `equation count > distinct equation-variable count => overdefined`, including zero-variable equations.
- Preserve every finite discrete real solution; parameterized outcomes are underdetermined.
- Keep no-solution, underdetermined, overdefined, unresolved, unsupported, and runtime-error states distinct.
- Never execute user text as JavaScript or Python; recursively construct SymPy values from validated AST nodes.
- Run all SymPy work outside the browser main thread.
- Keep the feature independent of its demo host for later shadcn registry packaging.

## File Map

```text
src/calculator/dsl/                 AST, tokenizer, parser, analysis, MathML
src/calculator/solver/              protocol, preflight, Python, worker, client
src/calculator/components/          focused workspace components
src/calculator/model.ts             domain state types
src/calculator/reducer.ts           pure state transitions
src/calculator/operations.ts        operation insertion templates
src/calculator/ScientificCalculator.tsx  embeddable feature root
src/calculator/index.ts             registry-facing exports
src/App.tsx                         demo host only
src/styles.css                      design tokens and responsive layout
tests/python/test_solver.py         CPython solver contract suite
```

---

### Task 1: Scaffold a tested Vite application

**Files:**
- Create: `package.json`, `bun.lock`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `.oxlintrc.json`, `.gitignore`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/test/setup.ts`, `src/App.test.tsx`

**Interfaces:**
- Produces: Bun scripts `dev`, `build`, `lint`, `test:run`, and `typecheck`; a minimal `App` demo host.

- [ ] **Step 1: Scaffold and install pinned dependencies**

```bash
bun create vite . --template react-ts
bun add react@19.2.8 react-dom@19.2.8 lucide-react@1.39.0 pyodide@314.0.6
bun add -d typescript@6.0.3 vite@8.2.2 @vitejs/plugin-react@6.1.0 vitest@4.1.11 jsdom@30.0.1 @testing-library/react@16.3.3 @testing-library/jest-dom @testing-library/user-event oxlint
```

- [ ] **Step 2: Write and run the failing shell test**

```tsx
it("introduces the scientific workspace", () => {
  render(<App />)
  expect(screen.getByRole("heading", { name: /scientific calculator/i })).toBeVisible()
  expect(screen.getByRole("button", { name: /plot.*v2/i })).toBeDisabled()
})
```

```bash
npm run test:run -- src/App.test.tsx
# Expected: FAIL against the generated starter.
```

- [ ] **Step 3: Implement the smallest accessible host and test configuration**

```tsx
export default function App() {
  return <main className="app-shell"><h1>Scientific calculator</h1><button disabled aria-label="Plot — available in V2">Plot · V2</button></main>
}
```

- [ ] **Step 4: Verify and commit**

```bash
npm run test:run -- src/App.test.tsx
npm run typecheck
npm run lint
git add .
git commit -m "chore: scaffold calculator application"
```

### Task 2: Implement the forgiving TypeScript DSL

**Files:**
- Create: `src/calculator/dsl/ast.ts`, `tokenize.ts`, `parser.ts`, `parser.test.ts`

**Interfaces:**
- Produces: `ExpressionAst`, `RelationAst`, `BuiltinFunction`, `ParseError`, and `parseRelation(source: string): RelationAst`.

- [ ] **Step 1: Write tests for implicit multiplication, precedence, grouping, calls, and diagnostics**

```ts
it.each(["2x", "2(x+1)", "(x+1)(x-1)", "2 sin(x)"])("parses %s", source => {
  expect(JSON.stringify(parseRelation(source))).toContain('"operator":"*"')
})
it("distinguishes equations and queries", () => {
  expect(parseRelation("2x+3=7").kind).toBe("equation")
  expect(parseRelation("factor(x^2-1)").kind).toBe("query")
})
it("binds exponentiation above unary minus", () => {
  expect(parseRelation("-x^2")).toMatchObject({ kind: "query", expression: { kind: "unary", operand: { kind: "binary", operator: "^" } } })
})
it("accepts braces without requiring them", () => expect(parseRelation("sqrt{x+1}")).toEqual(parseRelation("sqrt(x+1)")))
it("reports unknown calls and invalid arity with positions", () => {
  expect(() => parseRelation("mystery(x)")).toThrow(/Unknown function.*position/i)
  expect(() => parseRelation("diff(x)")).toThrow(/expects 2 arguments/i)
})
```

- [ ] **Step 2: Run the suite and confirm the missing-module failure**

```bash
npm run test:run -- src/calculator/dsl/parser.test.ts
```

- [ ] **Step 3: Define the closed AST and implement tokenizer plus recursive-descent parser**

```ts
export type RelationAst =
  | { kind: "equation"; left: ExpressionAst; right: ExpressionAst }
  | { kind: "query"; expression: ExpressionAst }

export function parseRelation(source: string): RelationAst {
  const parser = new Parser(tokenize(source))
  const left = parser.parseExpression()
  if (parser.match("equals")) {
    const right = parser.parseExpression()
    parser.expect("eof")
    return { kind: "equation", left, right }
  }
  parser.expect("eof")
  return { kind: "query", expression: left }
}
```

The parser recognizes allowlisted calls before implicit multiplication, inserts `binary("*")` nodes between adjacent primaries, validates arity, makes powers right-associative, and gives unary minus lower precedence than powers.

- [ ] **Step 4: Verify and commit**

```bash
npm run test:run -- src/calculator/dsl/parser.test.ts
npm run typecheck
git add src/calculator/dsl
git commit -m "feat: add forgiving calculator dsl"
```

### Task 3: Analyze and render the AST

**Files:**
- Create: `src/calculator/dsl/analyze.ts`, `analyze.test.ts`, `mathml.ts`, `mathml.test.ts`
- Create: `src/calculator/solver/preflight.ts`, `preflight.test.ts`

**Interfaces:**
- Produces: `collectFreeSymbols`, `collectEquationSymbols`, `toMathMl`, `relationToMathMl`, and `preflight`.

- [ ] **Step 1: Write failing tests for distinct symbols, the strict rule, and math output**

```ts
it("counts distinct equation variables but not query rows", () => {
  const rows = [parseRelation("x+y=2"), parseRelation("x-y=0"), parseRelation("x^2")]
  expect(collectEquationSymbols(rows)).toEqual(["x", "y"])
  expect(preflight(rows)).toMatchObject({ ok: true, equationCount: 2, variableCount: 2 })
})
it("rejects even one zero-variable equation", () => {
  expect(preflight([parseRelation("1=1")])).toMatchObject({ ok: false, status: "overdefined" })
})
it("renders implicit products and fractions", () => {
  expect(relationToMathMl(parseRelation("2x+1/3"))).toContain("<mfrac>")
})
```

- [ ] **Step 2: Run the focused tests and confirm failure**

```bash
bun run test:run -- src/calculator/dsl/analyze.test.ts src/calculator/dsl/mathml.test.ts src/calculator/solver/preflight.test.ts
```

- [ ] **Step 3: Implement exhaustive visitors and preflight**

```ts
export function preflight(relations: RelationAst[]): PreflightResult {
  const equationCount = relations.filter(row => row.kind === "equation").length
  const variableCount = collectEquationSymbols(relations).length
  return equationCount > variableCount
    ? { ok: false, status: "overdefined", equationCount, variableCount, message: `${equationCount} equations exceed ${variableCount} unknowns.` }
    : { ok: true, equationCount, variableCount }
}
```

Visitors handle every AST variant, bind calculus variable arguments correctly, parenthesize by precedence, and escape symbol text before generating presentation MathML.

- [ ] **Step 4: Verify and commit**

```bash
npm run test:run -- src/calculator/dsl src/calculator/solver/preflight.test.ts
git add src/calculator/dsl src/calculator/solver/preflight*
git commit -m "feat: analyze and render calculator ast"
```

### Task 4: Implement relation state and operation insertion

**Files:**
- Create: `src/calculator/model.ts`, `reducer.ts`, `reducer.test.ts`, `operations.ts`, `operations.test.ts`

**Interfaces:**
- Produces: `Relation`, `CalculatorState`, `calculatorReducer`, `OPERATION_GROUPS`, and `applyInsertion`.

- [ ] **Step 1: Write failing reducer and insertion tests**

```ts
it("updates an edited row in place", () => {
  const added = reduce(initialState, save("r1", "x=1", 1))
  const saved = reduce(reduce(added, { type: "edit", id: "r1" }), save("unused", "x=2", 2))
  expect(saved.relations).toHaveLength(1)
  expect(saved.relations[0]).toMatchObject({ id: "r1", source: "x=2", createdAt: 1 })
})
it("ignores stale solver responses", () => {
  const pending = reduce(initialState, { type: "solve-started", requestId: "new" })
  expect(reduce(pending, { type: "solve-finished", requestId: "old", result: noSolution }).solver).toEqual(pending.solver)
})
it("inserts and selects an operation slot", () => {
  expect(applyInsertion("", { start: 0, end: 0 }, "diff(□, x)")).toEqual({ source: "diff(, x)", selection: { start: 5, end: 5 } })
})
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
npm run test:run -- src/calculator/reducer.test.ts src/calculator/operations.test.ts
```

- [ ] **Step 3: Implement pure state transitions and categorized templates**

```ts
export const OPERATION_GROUPS = [
  { name: "Arithmetic", items: ["(□)^2", "sqrt(□)", "(□)!"] },
  { name: "Scientific", items: ["sin(□)", "ln(□)", "pi"] },
  { name: "Algebra", items: ["simplify(□)", "expand(□)", "factor(□)"] },
  { name: "Calculus", items: ["diff(□, x)", "integrate(□, x)", "limit(□, x, 0)"] },
] as const
```

Add, edit, save, delete, clear, help, loading, and request-ID-checked result actions remain serializable and side-effect free.

- [ ] **Step 4: Verify and commit**

```bash
npm run test:run -- src/calculator/reducer.test.ts src/calculator/operations.test.ts
git add src/calculator/model.ts src/calculator/reducer* src/calculator/operations*
git commit -m "feat: add shared relation state"
```

### Task 5: Build the trusted SymPy solver

**Files:**
- Create: `src/calculator/solver/protocol.ts`, `solver.py`
- Create: `tests/python/test_solver.py`

**Interfaces:**
- Produces: the TypeScript discriminated `SolverResult`; Python `solve_payload(payload: dict) -> dict`.

- [ ] **Step 1: Write Python contract tests**

```py
def test_all_discrete_nonlinear_real_solutions():
    result = solve_payload(payload("x^2=1", "y=x^2"))
    assert result["status"] == "solved"
    assert [s["assignments"]["x"]["exact"] for s in result["solutions"]] == ["-1", "1"]

def test_distinct_empty_and_underdetermined_states():
    assert solve_payload(payload("x^2=-1"))["status"] == "no-solution"
    assert solve_payload(payload("x+y=1"))["status"] == "underdetermined"

def test_symbolic_query():
    result = solve_payload(payload("factor(x^2-1)"))
    assert result["solutions"][0]["queries"][0]["exact"] == "(x - 1)*(x + 1)"

def test_worker_repeats_strict_preflight():
    assert solve_payload(payload("x=1", "x=1"))["status"] == "overdefined"

def test_unresolved_and_unsupported_are_not_no_solution():
    assert classify_solution_set(sp.ConditionSet(sp.Symbol("x"), True, sp.S.Reals))["status"] == "unresolved"
    assert solve_payload({"relations": [{"kind": "query", "expression": {"kind": "matrix"}}]})["status"] == "unsupported"
```

- [ ] **Step 2: Run tests and confirm the missing solver failure**

```bash
python3 -m pytest tests/python/test_solver.py -q
```

- [ ] **Step 3: Implement recursive AST construction and result classification**

```py
def build_expr(node, symbols):
    kind = node.get("kind")
    if kind == "symbol":
        return symbols.setdefault(node["name"], sp.Symbol(node["name"], real=True))
    if kind == "constant":
        return {"pi": sp.pi, "e": sp.E}[node["name"]]
    if kind == "binary":
        left = build_expr(node["left"], symbols)
        right = build_expr(node["right"], symbols)
        return BINARY_DISPATCH[node["operator"]](left, right)
    if kind == "call":
        return build_allowed_call(node["name"], node["args"], symbols)
    raise UnsupportedFeature(f"Unsupported AST node: {kind}")
```

`solve_payload` repeats preflight, declares real symbols, uses exact SymPy values, classifies an empty set only when proven empty, treats finite solutions as discrete, treats free parameters/positive-dimensional sets as underdetermined, and treats unevaluated solver output as unresolved. It validates and deduplicates every candidate, filters non-real values, and serializes exact, presentation-MathML, and optional approximate forms. Algebra/calculus calls use a closed dispatch table.

- [ ] **Step 4: Verify and commit**

```bash
python3 -m pytest tests/python/test_solver.py -q
git add src/calculator/solver/protocol.ts src/calculator/solver/solver.py tests/python/test_solver.py
git commit -m "feat: add real symbolic sympy solver"
```

### Task 6: Connect Pyodide through a typed worker client

**Files:**
- Create: `src/calculator/solver/solver.worker.ts`, `client.ts`, `client.test.ts`
- Modify: `src/vite-env.d.ts`

**Interfaces:**
- Produces: `createSolverClient(workerFactory?): SolverClient` with `solve`, `getSnapshot`, `subscribe`, `retry`, and `dispose`.

- [ ] **Step 1: Write failing fake-worker tests**

```ts
it("correlates responses and ignores stale ids", async () => {
  const fake = new FakeWorker()
  const client = createSolverClient(() => fake)
  const pending = client.solve([parseRelation("x=1")])
  fake.emitResult("stale", noSolution)
  fake.emitResult(fake.lastRequest.id, solved)
  await expect(pending).resolves.toEqual(solved)
})
it("exposes failure and retry lifecycle", () => {
  const client = createSolverClient(sequenceFactory(failingWorker, healthyWorker))
  failingWorker.emit({ type: "init-error", message: "offline" })
  expect(client.getSnapshot().phase).toBe("failed")
  client.retry()
  expect(client.getSnapshot().phase).toBe("loading")
})
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
npm run test:run -- src/calculator/solver/client.test.ts
```

- [ ] **Step 3: Implement worker bootstrap and the request-ID client**

```ts
import { loadPyodide } from "pyodide"
import solverSource from "./solver.py?raw"

const pyodide = await loadPyodide()
await pyodide.loadPackage("sympy")
pyodide.FS.writeFile("/calculator_solver.py", solverSource)
await pyodide.runPythonAsync("from calculator_solver import solve_payload")
postMessage({ type: "ready" })
```

The worker sends JSON through a fixed wrapper, destroys PyProxy objects in `finally`, and catches initialization/runtime failures. The client lazily starts the worker, ignores unknown IDs, settles every request once, terminates before retry, and releases requests/listeners on disposal.

- [ ] **Step 4: Verify and commit**

```bash
npm run test:run -- src/calculator/solver/client.test.ts
npm run typecheck
git add src/calculator/solver src/vite-env.d.ts
git commit -m "feat: run sympy in pyodide worker"
```

### Task 7: Build the calculator workspace UI

**Files:**
- Create: `src/calculator/components/{CalculatorToolbar,DslEditor,MathPreview,OperationsPanel,RelationsPanel,RelationRow,ResultPanel,HelpDialog}.tsx`
- Create: `src/calculator/ScientificCalculator.tsx`, `ScientificCalculator.test.tsx`, `index.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `ScientificCalculator({ solverClient? })` and public exports from `src/calculator/index.ts`.

- [ ] **Step 1: Write failing integrated component tests**

```tsx
it("edits without duplicating a relation", async () => {
  render(<ScientificCalculator solverClient={fakeClient} />)
  await addRelation("2x+3=7")
  await user.click(screen.getByRole("button", { name: /edit 2x\+3=7/i }))
  await replaceEditor("2x=4")
  await user.click(screen.getByRole("button", { name: /save relation/i }))
  expect(screen.getAllByTestId("relation-row")).toHaveLength(1)
})
it("shows preview, parser feedback, and disabled V2 controls", async () => {
  render(<ScientificCalculator solverClient={fakeClient} />)
  expect(screen.getByRole("button", { name: /plot.*v2/i })).toBeDisabled()
  await replaceEditor("sin(pi/2)")
  expect(screen.getByLabelText(/rendered math preview/i)).toHaveTextContent("sin")
  await replaceEditor("(")
  expect(screen.getByRole("alert")).toBeVisible()
})
it("submits every row and renders all returned solutions", async () => {
  render(<ScientificCalculator solverClient={fakeClient} />)
  await addRelation("x^2=1")
  await addRelation("x")
  await user.click(screen.getByRole("button", { name: /calculate result/i }))
  expect(fakeClient.solve).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ kind: "equation" }), expect.objectContaining({ kind: "query" })]))
  expect(await screen.findByText(/2 solutions/i)).toBeVisible()
})
it.each([
  ["no-solution", /no real solution/i],
  ["underdetermined", /underdetermined/i],
  ["overdefined", /overdefined/i],
  ["unresolved", /could not resolve/i],
  ["unsupported", /not supported/i],
  ["error", /solver error/i],
])("renders a distinct %s state", async (status, title) => {
  fakeClient.setResult(resultFixture(status))
  render(<ScientificCalculator solverClient={fakeClient} />)
  await addRelation("x")
  await user.click(screen.getByRole("button", { name: /calculate result/i }))
  expect(await screen.findByText(title)).toBeVisible()
})
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
npm run test:run -- src/calculator/ScientificCalculator.test.tsx
```

- [ ] **Step 3: Implement focused components and orchestration**

```tsx
return (
  <section className="calculator-workspace" aria-label="Scientific calculator workspace">
    <div className="calculator-column">
      <CalculatorToolbar {...toolbarProps} />
      <DslEditor {...editorProps} />
      <MathPreview parsed={parsed} />
      <OperationsPanel onInsert={insertOperation} />
    </div>
    <RelationsPanel {...relationsProps}><ResultPanel solver={state.solver} /></RelationsPanel>
    <HelpDialog {...helpProps} />
  </section>
)
```

Calculate performs preflight before invoking the worker. Native MathML is produced only from validated AST data or trusted SymPy values. Every result status gets distinct copy and semantics. Buttons insert at the current selection. The Help dialog is authored as Markdown and rendered by Bun with HTML filtering enabled.

- [ ] **Step 4: Implement the approved visual system**

```css
.calculator-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(22rem, .85fr);
  min-height: min(78vh, 58rem);
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 1.5rem;
  background: var(--surface-1);
}
@media (max-width: 860px) {
  .calculator-workspace { grid-template-columns: 1fr; }
  .relations-column { border-left: 0; border-top: 1px solid var(--line); }
}
```

Complete the graphite/warm-white palette, cyan focus/primary accent, semantic status colors, relation/result scrolling, visible focus, disabled contrast, and reduced-motion behavior.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:run
npm run typecheck
git add src/calculator src/styles.css
git commit -m "feat: build scientific calculator workspace"
```

### Task 8: Integrate, document, and verify production

**Files:**
- Modify: `src/App.tsx`, `src/App.test.tsx`
- Create: `README.md`

**Interfaces:**
- Produces: runnable demo, usage guide, and verified V1 handoff.

- [ ] **Step 1: Write and run the failing integration test**

```tsx
it("hosts both approved workspace columns", () => {
  render(<App />)
  expect(screen.getByLabelText(/scientific calculator workspace/i)).toBeVisible()
  expect(screen.getByRole("heading", { name: /shared relations/i })).toBeVisible()
})
```

```bash
npm run test:run -- src/App.test.tsx
```

- [ ] **Step 2: Render the feature and write the concrete run/notation guide**

```tsx
import { ScientificCalculator } from "./calculator"
export default function App() { return <main className="app-shell"><ScientificCalculator /></main> }
```

Document prerequisites, install/dev/test/build commands, first Pyodide startup, supported examples, every result status, V1 limits, and future registry boundaries.

- [ ] **Step 3: Run every automated gate**

```bash
npm run test:run
python3 -m pytest tests/python/test_solver.py -q
npm run typecheck
npm run lint
npm run build
```

- [ ] **Step 4: Browser-smoke the built feature**

```bash
npm run dev -- --host 127.0.0.1
```

Check desktop and narrow layout, keyboard focus, add/edit/delete, disabled Plot V2, `2x+3=7` plus query `x`, `x^2=1` returning both roots, `x^2=-1` as no-solution, `x+y=1` as underdetermined, and `factor(x^2-1)` as symbolic output.

- [ ] **Step 5: Review scope and commit the handoff**

```bash
rg -n "console\\.(log|debug)|plot[^\n]*(enabled|onClick)" src README.md docs || true
git status --short
git add src/App.tsx src/App.test.tsx README.md package.json bun.lock
git commit -m "docs: finish calculator demo and usage"
```
