from app.services.triz import get_store

# ---------------------------------------------------------------------------
# Data / retrieval tools (sync)
# ---------------------------------------------------------------------------


def browse_contradiction_matrix(
    improving_params: list[int], preserving_params: list[int]
) -> str:
    """Look up Inventive Principles from the TRIZ contradiction matrix for given parameter IDs."""
    try:
        store = get_store()
        data = store.get_principles_from_matrix(
            improving_parameters=improving_params,
            preserving_parameters=preserving_params,
        )
        if not data:
            return "No Inventive Principles found for the given parameter combination."

        result = f"Found {len(data)} Inventive Principle(s) from TRIZ Matrix:\n\n"
        for i, p in enumerate(data, 1):
            result += f"{i}. {p.name} (ID: {p.id})\n   {p.description}\n\n"
            if p.rules:
                result += "   Rules:\n" + "".join(f"   • {r}\n" for r in p.rules) + "\n"
            if p.hints:
                result += "   Hints:\n" + "".join(f"   • {h}\n" for h in p.hints) + "\n"
            if p.examples:
                result += (
                    "   Examples:\n" + "".join(f"   • {e}\n" for e in p.examples) + "\n"
                )
        return result.strip()
    except Exception as e:
        return f"Error retrieving Inventive Principles: {e}"


def search_parameter(query: str, limit: int = 5) -> str:
    """Search TRIZ engineering parameters by semantic similarity to a query string."""
    try:
        store = get_store()
        results = store.search_parameters(query, top_k=limit)
        if not results:
            return "No parameters found."
        output = f"Found {len(results)} TRIZ parameter(s):\n\n"
        for r in results:
            output += f"• [{r.id}] {r.name}\n  {r.description}\n\n"
        return output.strip()
    except Exception as e:
        return f"Error searching parameters: {e}"


def search_principle(query: str, limit: int = 5) -> str:
    """Search TRIZ Inventive Principles by semantic similarity to a query string."""
    try:
        store = get_store()
        results = store.search_principles(query, top_k=limit)
        if not results:
            return "No principles found."
        output = f"Found {len(results)} Inventive Principle(s):\n\n"
        for r in results:
            output += f"• [{r.id}] {r.name}\n  {r.description}\n\n"
        return output.strip()
    except Exception as e:
        return f"Error searching principles: {e}"


def get_random_principles(limit: int = 5) -> str:
    """Return a random selection of TRIZ Inventive Principles."""
    try:
        store = get_store()
        principles = store.get_random_principles(count=limit)
        if not principles:
            return "No principles found."
        output = f"{len(principles)} random Inventive Principle(s):\n\n"
        for p in principles:
            output += f"• [{p.id}] {p.name}\n  {p.description}\n\n"
        return output.strip()
    except Exception as e:
        return f"Error retrieving random principles: {e}"


def get_principle_by_id(principle_id: int) -> str:
    """Retrieve a TRIZ Inventive Principle by its numeric ID (1–40)."""
    try:
        store = get_store()
        p = store.get_principle_by_id(principle_id)
        output = f"[{p.id}] {p.name}\n\n{p.description}\n\n"
        if p.rules:
            output += "Rules:\n" + "\n".join(f"• {r}" for r in p.rules) + "\n\n"
        if p.hints:
            output += "Hints:\n" + "\n".join(f"• {h}" for h in p.hints) + "\n\n"
        if p.examples:
            output += "Examples:\n" + "\n".join(f"• {e}" for e in p.examples)
        return output.strip()
    except Exception as e:
        return f"Error retrieving principle: {e}"


def get_parameter_by_id(parameter_id: int) -> str:
    """Retrieve a TRIZ engineering parameter by its numeric ID (1–39)."""
    try:
        store = get_store()
        p = store.get_parameter_by_id(parameter_id)
        output = f"[{p.id}] {p.name}\n\n{p.description}\n"
        if p.examples:
            output += "\nExamples:\n" + "\n".join(f"• {e}" for e in p.examples)
        return output.strip()
    except Exception as e:
        return f"Error retrieving parameter: {e}"
