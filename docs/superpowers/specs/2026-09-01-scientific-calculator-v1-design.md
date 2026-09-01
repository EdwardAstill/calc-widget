# Scientific Calculator V1 Design

**Date:** 2026-09-01  
**Status:** Approved for implementation  
**Source of approval:** The accepted two-column mockup and the implementation brief in the referenced “Build Scientific Calculator Widget” conversation.

## Purpose

Build a browser-based scientific calculator that lets a user write readable calculator notation, save equations and expression queries as relations, and solve the entire saved set as one real-number system. V1 must support symbolic work and full nonlinear multivariable solving without requiring a server or a local Python installation.

## V1 Outcomes

- A persistent two-column workspace matching the approved layout.
- A forgiving calculator DSL backed by a typed TypeScript AST.
- A live rendered-mathematics preview for valid input and clear inline parser feedback for incomplete or invalid input.
- A shared relation list whose equation rows are constraints and whose bare-expression rows are queries.
- Real-domain solving through SymPy running in Pyodide inside a Web Worker.
- Results that distinguish solved, no-solution, underdetermined, overdefined, unresolved, unsupported, and runtime-error states.
- An operations panel for arithmetic, scientific functions, algebra, and calculus.
- Plot controls displayed but disabled and labelled as V2.
- A component structure that can later be wrapped as a shadcn registry item without rewriting the calculator domain.

## Non-goals

- Plot rendering or plot configuration.
- Complex-domain solutions.
- Units, matrices, statistics, probability, or numerical optimization.
- A native Python executable, server process, account system, persistence backend, or collaboration.
- Arbitrary Python or SymPy source execution from calculator input.
- Automatic parametric answers for underdetermined systems.

## Product Structure

The application has three conceptual surfaces. Calculator and Relations ship in V1; Plot remains an explicit V2 placeholder.

```text
Scientific Calculator
├── Calculator workspace  (V1)
├── Shared relations      (V1)
└── Plot workspace        (disabled, V2)
```

On desktop, Calculator and Relations remain side by side. On narrow screens they stack while preserving their order and independent scroll regions.

### Calculator column

1. Header and toolbar:
   - Clear editor
   - Add relation, or Save relation while editing
   - Calculate result
   - Plot (disabled, “V2”)
   - Help
2. DSL editor with a concise notation hint.
3. Live math preview.
4. Categorized operations panel.

### Relations column

1. Shared relation count and explanatory copy.
2. Relation rows in insertion order, each with:
   - disabled plot checkbox,
   - rendered relation,
   - Equation or Query badge,
   - Edit action,
   - Delete action.
3. Contextual result and diagnostics panel anchored at the bottom.

Editing a row copies its source into the editor and records the row ID. Saving then replaces that row in place; it never creates a duplicate. Clear exits edit mode. Deleting the row currently being edited also clears the editor.

## Visual Direction

The approved mockup is interpreted as an application workspace rather than a collection of disconnected cards. The shell uses a dark graphite canvas, warm off-white text, muted slate panels, thin borders, and one restrained cyan accent for focus, primary actions, and selected states. Mathematical previews use a serif math face while interface controls use a clean sans serif. The relation column has a visibly separate surface and the result panel remains easy to locate even when the list grows.

Accessibility requirements:

- Semantic buttons, labels, headings, and status regions.
- Keyboard-accessible editing and relation actions.
- Visible focus styles and sufficient contrast.
- Disabled plot controls expose an explanatory label and native disabled state.
- Live result changes use a polite status region; errors use an alert region.
- Motion respects `prefers-reduced-motion`.

## Application Architecture

```text
React application
├── UI components and reducer state
├── TypeScript DSL
│   ├── tokenizer
│   ├── parser
│   ├── AST analysis
│   └── math renderer/serializer
├── solver client
│   └── request IDs, lifecycle, cancellation-safe responses
└── Web Worker
    ├── Pyodide bootstrap
    ├── trusted Python solver module
    └── SymPy
```

The browser main thread owns UI state, parsing, validation, math display, and the stable solver request/response contract. The worker owns the expensive Python runtime and solving. Only validated AST-derived data crosses the worker boundary. User text is never passed to `eval`, `exec`, `sympify`, or an equivalent arbitrary-code path.

### Component boundaries

- `ScientificCalculator`: embeddable top-level feature component.
- `CalculatorToolbar`: editor actions and solver entry point.
- `DslEditor`: controlled source editor and parser diagnostics.
- `MathPreview`: KaTeX rendering from a generated math string.
- `OperationsPanel`: data-driven insertion buttons grouped by category.
- `RelationsPanel`: shared rows and empty state.
- `RelationRow`: rendered row plus edit/delete/V2 controls.
- `ResultPanel`: solver lifecycle, result sets, and diagnostics.
- `HelpDialog`: supported notation and examples.

Domain modules have no React dependency. UI primitives live behind local shadcn-style components so later registry packaging can include them as explicit dependencies.

## State Model

```ts
type Relation = {
  id: string
  source: string
  ast: RelationAst
  createdAt: number
}

type CalculatorState = {
  source: string
  relations: Relation[]
  editingId: string | null
  solver: SolverState
  helpOpen: boolean
}
```

Parsed ASTs are stored with relation source so display and solving use the same accepted meaning. V1 state is session-local. A repository boundary will make future persistence additive rather than a reducer rewrite.

## DSL

### Design principles

- Familiar calculator notation is preferred over programming syntax.
- Multiplication may be explicit (`2*x`) or implicit (`2x`, `2(x+1)`, `(x+1)(x-1)`, `2 sin(x)`).
- Standard function calls accept parentheses. Braces are also accepted as grouping for familiarity, but LaTeX-style curly braces are never required.
- `^` means exponentiation.
- Whitespace is insignificant except that it can help separate adjacent tokens.
- Function and constant names are case-insensitive; user variables preserve their displayed spelling but are normalized for comparison.
- Built-in names cannot be used as unknown variables.

### Grammar

```text
relation     := expression ("=" expression)?
expression   := additive
additive     := multiplicative (("+" | "-") multiplicative)*
multiplicative := power (("*" | "/" | implicit-multiply) power)*
power        := unary ("^" power)?
unary        := ("+" | "-") unary | postfix
postfix      := primary ("!")*
primary      := number
              | identifier
              | function-call
              | "(" expression ")"
              | "{" expression "}"
function-call := function-name group ("," expression)*
group        := "(" expression-list ")" | "{" expression-list "}"
```

Exponentiation is right-associative. Unary minus has lower mathematical precedence than exponentiation, so `-x^2` means `-(x^2)`. Implicit multiplication has the same precedence as explicit multiplication. Function names are recognized from an allowlist, avoiding the ambiguity where `sin(x)` might otherwise mean four multiplied variables.

### Supported literals, constants, and functions

- Decimal and scientific-notation numbers.
- Constants: `pi`, `e`.
- Arithmetic: `+`, `-`, `*`, `/`, `^`, factorial.
- Scientific: `sqrt`, `abs`, `exp`, `ln`, `log`, `log10`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sinh`, `cosh`, `tanh`.
- Algebra: `simplify`, `expand`, `factor`.
- Calculus: `diff(expression, variable)`, `integrate(expression, variable)`, `limit(expression, variable, destination)`.

Algebra and calculus functions are query operations. They may produce symbolic expressions. Their arguments remain AST nodes and are serialized to a restricted structured payload for the worker.

### AST

```ts
type ExpressionAst =
  | { kind: "number"; value: string }
  | { kind: "symbol"; name: string }
  | { kind: "constant"; name: "pi" | "e" }
  | { kind: "unary"; operator: "+" | "-"; operand: ExpressionAst }
  | { kind: "binary"; operator: "+" | "-" | "*" | "/" | "^"; left: ExpressionAst; right: ExpressionAst; implicit?: boolean }
  | { kind: "factorial"; operand: ExpressionAst }
  | { kind: "call"; name: BuiltinFunction; args: ExpressionAst[] }

type RelationAst =
  | { kind: "equation"; left: ExpressionAst; right: ExpressionAst }
  | { kind: "query"; expression: ExpressionAst }
```

The parser returns source spans with diagnostics, while the persistent AST omits spans from its public serialization contract.

## Relation and Solver Semantics

All committed rows are processed together for one Calculate action.

- Equation rows are constraints.
- Bare-expression rows are queries evaluated against every discrete solution to the constraints.
- When there are equations but no queries, the result is the set of variable assignments.
- When there are queries but no equations, closed queries are evaluated or simplified; queries containing free variables are underdetermined unless the operation itself yields a closed symbolic result.
- Multiple discrete real solutions are all returned and remain grouped by solution.
- Duplicate mathematical solutions are removed without converting exact values to floats.
- Exact forms are primary; a numerical approximation may be displayed alongside when useful.

### Strict overdefined rule

Before invoking SymPy, count equation rows and the distinct unknown symbols occurring in equation rows. Built-in constants, function names, and bound calculus variables do not count as unknowns.

```text
equation row count > distinct equation-variable count => overdefined
```

This is an intentional V1 product rule, even when redundant equations would be mathematically consistent. Query rows do not affect the equation count. There is no zero-variable exception: any equation row with no unknowns is overdefined because its equation count is greater than its distinct unknown count.

### Underdetermined behavior

A system is underdetermined when SymPy returns a positive-dimensional or parameterized solution set, or when a query still has unresolved free symbols after applying a solution. V1 reports `underdetermined` with the relevant symbol names. It does not expose generated parameters as if they were final answers.

### Real domain and nonlinear solving

The worker builds SymPy expressions recursively from the structured AST using an explicit node/function dispatch table. Symbols are declared real. It uses exact SymPy values and set/solve APIs appropriate to the system, filters candidate assignments by realness and constraint satisfaction, and preserves all finite discrete solutions.

Because general symbolic nonlinear solving is undecidable, a valid request can remain unresolved. That outcome must not be presented as “no solution.”

## Worker Protocol

```ts
type SolverRequest = {
  id: string
  relations: SerializedRelationAst[]
}

type SolverResponse =
  | { id: string; status: "solved"; variables: string[]; solutions: SolutionResult[]; queries: QueryResult[] }
  | { id: string; status: "no-solution"; message: string }
  | { id: string; status: "underdetermined"; symbols: string[]; message: string }
  | { id: string; status: "overdefined"; equationCount: number; variableCount: number; message: string }
  | { id: string; status: "unresolved"; message: string; detail?: string }
  | { id: string; status: "unsupported"; message: string; feature?: string }
  | { id: string; status: "error"; message: string }
```

Worker initialization emits a separate ready/error lifecycle event. The client holds at most one active logical calculation; stale responses are ignored by request ID. The UI shows that the first calculation downloads and starts the Python engine and may take longer.

## Error Handling

- Tokenizer/parser errors are immediate, source-specific, and do not call the worker.
- An empty editor cannot be saved.
- Calculate with no saved rows reports a local diagnostic.
- Overdefined is checked locally and repeated in the worker as a contract guard.
- `no-solution` means the real solution set was proven empty.
- `underdetermined` means constraints or a query leave free degrees of freedom.
- `unresolved` means the request was valid but SymPy could not produce a decisive finite result.
- `unsupported` means syntax was valid at the DSL layer but is outside the implemented solver capability.
- `error` is reserved for initialization, protocol, or unexpected runtime failures and includes a recovery action.

## Operations UI

Buttons insert text at the editor selection and preserve focus. Categories and initial templates are:

- Arithmetic: `+`, `-`, `×`, `÷`, power, square root, factorial, parentheses.
- Scientific: trigonometric, inverse trigonometric, hyperbolic, logarithmic, exponential, absolute value, `pi`, `e`.
- Algebra: `simplify(□)`, `expand(□)`, `factor(□)`.
- Calculus: `diff(□, x)`, `integrate(□, x)`, `limit(□, x, 0)`.

Templates select the first placeholder so typing replaces it. The UI never manufactures a relation automatically; the user explicitly saves editor content.

## Packaging

The initial repository is a Vite React TypeScript application. Feature code is arranged so a later shadcn registry export can copy the top-level component, local UI primitives, DSL modules, solver client, worker, styles, and declared package dependencies. The page shell is a demonstration host and is not imported by the calculator feature.

Pyodide and SymPy are loaded only by the worker. Heavy runtime assets are not part of the initial interactive React bundle. The application must present an initialization state and a retry path if runtime loading fails.

## Testing Strategy

### Unit tests

- Tokenization, implicit multiplication, precedence, grouping, function arity, and parser diagnostics.
- AST symbol collection, relation classification, strict overdefined counting, and serialization.
- Math output for precedence-sensitive ASTs.
- Reducer behavior for add/edit/delete/clear and stale solver responses.
- Solver-result status parsing and display formatting.

### Component tests

- Live preview and error display.
- Add then edit updates one row rather than duplicating it.
- Delete and clear behavior.
- Disabled V2 plot controls.
- Operation template insertion.
- Result panel states and accessible status semantics.
- A mocked worker protocol keeps component tests deterministic and fast.

### Worker/Python contract tests

The trusted Python solver logic is kept in an importable source module and tested in the available CPython environment when SymPy is present. Cases include:

- one linear solution,
- multiple discrete solutions,
- nonlinear multivariable solutions,
- no real solution,
- underdetermined system,
- strict overdefined rejection,
- symbolic algebra and calculus queries,
- unresolved/unsupported separation.

### Build verification

- Static typecheck.
- Lint.
- Unit and component test suite.
- Production Vite build.
- Browser smoke test of the built app, including responsive layout and worker initialization where network/runtime availability permits.

## Acceptance Criteria

1. The app runs locally from documented commands in a newly scaffolded repository.
2. The layout contains the approved two persistent work areas and disabled V2 plot affordances.
3. Input such as `2x + 3 = 7`, `(x+1)(x-1)`, and `sin(pi/2)` parses without LaTeX braces.
4. Saved equations and queries are calculated as one shared system.
5. Editing and saving changes the existing row without changing its identity or position.
6. Finite nonlinear real systems return every discrete solution found and exact values remain exact.
7. Overdefined, underdetermined, no-solution, unresolved, unsupported, and runtime-error outcomes are visibly distinct.
8. Algebra and calculus queries can return symbolic values.
9. Expensive solving never blocks the browser main thread.
10. Automated tests and the production build pass before completion is reported.
