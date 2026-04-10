from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Pionex
    PIONEX_API_KEY: str = ""
    PIONEX_API_SECRET: str = ""
    PIONEX_BASE_URL: str = "https://api.pionex.com"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str

    # Dashboard auth
    DASHBOARD_API_KEY: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
