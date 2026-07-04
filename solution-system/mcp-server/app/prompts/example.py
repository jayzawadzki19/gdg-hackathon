def summarize(text: str, style: str = "concise") -> str:
    """Generate a summarisation prompt."""
    styles = {
        "concise": "Summarise the following text as briefly as possible",
        "detailed": "Write a detailed summary of the following text",
        "bullet": "Summarise the following text as a bullet-point list",
    }
    instruction = styles.get(style, styles["concise"])
    return f"{instruction}:\n\n{text}"
