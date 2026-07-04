from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _get_project_root() -> Path:
    current = Path(__file__).parent
    while not (current / "uv.lock").exists() and not (current / "pyproject.toml").exists():
        if current.parent == current:
            return Path.cwd()
        current = current.parent
    return current


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
    )

    # ==========================================
    # MCP Server
    # ==========================================
    MCP_HOST: str = "localhost"
    MCP_PORT: int = 8000
    MCP_NAME: str = ""
    MCP_PUBLIC_URL: str = ""
    AUTH_ENABLED: bool = True

    @property
    def mcp_server_url(self) -> str:
        if self.MCP_PUBLIC_URL:
            return self.MCP_PUBLIC_URL
        return f"http://{self.MCP_HOST}:{self.MCP_PORT}"

    # ==========================================
    # File Paths
    # ==========================================
    PROJECT_ROOT: Path = _get_project_root()
    CONFIG_DIR: str = "config"
    DATA_DIR: str = "data"

    @property
    def config_path(self) -> Path:
        """Get absolute path to config directory."""
        path = Path(self.CONFIG_DIR)
        return path if path.is_absolute() else self.PROJECT_ROOT / path

    @property
    def data_path(self) -> Path:
        path = Path(self.DATA_DIR)
        return path if path.is_absolute() else self.PROJECT_ROOT / path


config = Config()
