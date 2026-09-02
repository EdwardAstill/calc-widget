from pathlib import Path
import sys

import sympy as sp

sys.path.insert(
    0,
    str(Path(__file__).parents[2] / "registry" / "scientific-calculator" / "solver"),
)

from solver import classify_solution_set, solve_payload


def number(value):
    return {"kind": "number", "value": str(value)}


def symbol(name):
    return {"kind": "symbol", "name": name}


def constant(name):
    return {"kind": "constant", "name": name}


def binary(operator, left, right):
    return {"kind": "binary", "operator": operator, "left": left, "right": right}


def unary(operator, operand):
    return {"kind": "unary", "operator": operator, "operand": operand}


def call(name, *args):
    return {"kind": "call", "name": name, "args": list(args)}


def equation(left, right):
    return {"kind": "equation", "left": left, "right": right}


def query(expression):
    return {"kind": "query", "expression": expression}


def payload(*relations):
    return {"relations": list(relations)}


def test_returns_all_discrete_nonlinear_real_solutions():
    x_squared = binary("^", symbol("x"), number(2))
    result = solve_payload(
        payload(
            equation(x_squared, number(1)),
            equation(symbol("y"), x_squared),
            query(symbol("x")),
        )
    )

    assert result["status"] == "solved"
    assert result["variables"] == ["x", "y"]
    assert [solution["assignments"]["x"]["exact"] for solution in result["solutions"]] == ["-1", "1"]
    assert [solution["assignments"]["y"]["exact"] for solution in result["solutions"]] == ["1", "1"]
    assert [solution["queries"][0]["exact"] for solution in result["solutions"]] == ["-1", "1"]


def test_separates_no_real_solution_and_underdetermined():
    no_real = solve_payload(
        payload(
            equation(
                binary("^", symbol("x"), number(2)),
                unary("-", number(1)),
            )
        )
    )
    underdetermined = solve_payload(
        payload(
            equation(
                binary("+", symbol("x"), symbol("y")),
                number(1),
            )
        )
    )

    assert no_real["status"] == "no-solution"
    assert underdetermined["status"] == "underdetermined"
    assert underdetermined["symbols"] == ["x", "y"]


def test_symbolic_algebra_and_calculus_queries_remain_symbolic():
    polynomial = binary(
        "-",
        binary("^", symbol("x"), number(2)),
        number(1),
    )
    result = solve_payload(
        payload(
            query(call("factor", polynomial)),
            query(call("diff", binary("^", symbol("x"), number(3)), symbol("x"))),
        )
    )

    assert result["status"] == "solved"
    assert result["solutions"][0]["queries"][0]["exact"] == "(x - 1)*(x + 1)"
    assert result["solutions"][0]["queries"][1]["exact"] == "3*x**2"


def test_closed_scientific_query_is_evaluated_exactly():
    result = solve_payload(
        payload(query(call("sin", binary("/", constant("pi"), number(2)))))
    )

    assert result["status"] == "solved"
    assert result["solutions"][0]["queries"][0]["exact"] == "1"


def test_display_values_include_native_presentation_mathml():
    result = solve_payload(payload(query(call("sqrt", number(2)))))

    assert result["status"] == "solved"
    value = result["solutions"][0]["queries"][0]
    assert value["mathml"] == "<msqrt><mn>2</mn></msqrt>"
    assert "katex" not in value["mathml"].lower()


def test_bare_query_with_a_free_symbol_is_underdetermined():
    result = solve_payload(payload(query(binary("^", symbol("x"), number(2)))))

    assert result["status"] == "underdetermined"
    assert result["symbols"] == ["x"]


def test_repeats_the_strict_overdefined_rule_in_the_solver():
    duplicate = equation(symbol("x"), number(1))
    result = solve_payload(payload(duplicate, duplicate))
    constant_equation = solve_payload(payload(equation(number(1), number(1))))

    assert result["status"] == "overdefined"
    assert result["equationCount"] == 2
    assert result["variableCount"] == 1
    assert constant_equation["status"] == "overdefined"


def test_unresolved_and_unsupported_are_not_reported_as_no_solution():
    x = sp.Symbol("x", real=True)
    unresolved = classify_solution_set(
        sp.ConditionSet(x, sp.Eq(sp.sin(x), x), sp.S.Reals),
        [x],
    )
    unsupported = solve_payload(
        payload(query({"kind": "matrix", "rows": [[number(1)]]}))
    )

    assert unresolved["status"] == "unresolved"
    assert unsupported["status"] == "unsupported"


def test_classifies_nested_sets_returned_by_nonlinsolve():
    periodic = solve_payload(payload(equation(call("sin", symbol("x")), number(0))))
    impossible = solve_payload(
        payload(equation(call("sqrt", symbol("x")), unary("-", number(1))))
    )
    identity = solve_payload(payload(equation(symbol("x"), symbol("x"))))

    assert periodic["status"] == "unresolved"
    assert impossible["status"] == "no-solution"
    assert identity["status"] == "underdetermined"
    assert identity["symbols"] == ["x"]


def test_query_only_complex_results_are_outside_the_real_domain():
    result = solve_payload(
        payload(query(call("sqrt", unary("-", number(1)))))
    )

    assert result["status"] == "unsupported"
    assert result["feature"] == "complex-domain"


def test_constrained_queries_cannot_return_complex_values():
    result = solve_payload(
        payload(
            equation(symbol("x"), unary("-", number(1))),
            query(call("sqrt", symbol("x"))),
        )
    )

    assert result["status"] == "unsupported"
    assert result["feature"] == "complex-domain"


def test_closed_undefined_query_values_are_not_reported_as_solved():
    result = solve_payload(
        payload(query(binary("/", number(0), number(0))))
    )

    assert result["status"] == "unsupported"
    assert result["feature"] == "undefined-domain"
