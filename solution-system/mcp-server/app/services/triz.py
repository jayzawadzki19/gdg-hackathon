from functools import lru_cache

from pytriz import TRIZStore


@lru_cache(maxsize=1)
def get_store() -> TRIZStore:
    return TRIZStore()
