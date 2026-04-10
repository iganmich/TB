import hashlib
import hmac
import time
import asyncio
from decimal import Decimal
from urllib.parse import urlencode

import httpx

from config import settings

_rate_limit_until: float = 0
MAX_RPS = 8


async def _request(method: str, path: str, params: dict | None = None, body: dict | None = None, auth: bool = False) -> dict:
    global _rate_limit_until

    # Rate limit backoff
    now = time.time()
    if now < _rate_limit_until:
        wait = _rate_limit_until - now
        await asyncio.sleep(wait)

    url = f"{settings.PIONEX_BASE_URL}{path}"
    headers = {}

    # Add timestamp to params
    if params is None:
        params = {}
    params["timestamp"] = str(int(time.time() * 1000))

    if auth:
        # Sort params alphabetically for signature
        sorted_params = urlencode(sorted(params.items()))
        # Build signature string: METHOD + PATH?sorted_params [+ body]
        sig_string = f"{method}{path}?{sorted_params}"
        if body:
            import json
            body_str = json.dumps(body, separators=(",", ":"))
            sig_string += body_str
        else:
            body_str = None

        signature = hmac.new(
            settings.PIONEX_API_SECRET.encode(),
            sig_string.encode(),
            hashlib.sha256,
        ).hexdigest()

        headers["PIONEX-KEY"] = settings.PIONEX_API_KEY
        headers["PIONEX-SIGNATURE"] = signature

    async with httpx.AsyncClient(timeout=10) as client:
        if method == "GET":
            resp = await client.get(url, params=params, headers=headers)
        elif method == "POST":
            headers["Content-Type"] = "application/json"
            resp = await client.post(url, params=params, headers=headers, content=body_str if auth and body else None)
        elif method == "DELETE":
            headers["Content-Type"] = "application/json"
            resp = await client.request("DELETE", url, params=params, headers=headers, content=body_str if auth and body else None)
        else:
            raise ValueError(f"Unsupported method: {method}")

    if resp.status_code == 429:
        _rate_limit_until = time.time() + 60
        raise Exception("Rate limited by Pionex (429). Backing off 60s.")

    resp.raise_for_status()
    data = resp.json()

    if not data.get("result", True):
        raise Exception(f"Pionex API error: {data.get('message', 'unknown')}")

    return data


# --- Public endpoints ---

async def get_ticker(symbol: str = "MON_USDT") -> dict:
    """Get current price for a symbol. Returns {symbol, price, volume, ...}"""
    data = await _request("GET", "/api/v1/market/tickers", params={"symbol": symbol})
    tickers = data.get("data", {}).get("tickers", [])
    if not tickers:
        raise Exception(f"No ticker data for {symbol}")
    t = tickers[0]
    return {
        "symbol": t["symbol"],
        "price": Decimal(t["close"]),
        "volume": Decimal(t.get("amount", "0")),
    }


# --- Private endpoints ---

async def get_balances() -> dict[str, Decimal]:
    """Get account balances. Returns {currency: free_balance}."""
    data = await _request("GET", "/api/v1/account/balances", auth=True)
    balances = data.get("data", {}).get("balances", [])
    return {
        b["coin"]: Decimal(b["free"])
        for b in balances
        if Decimal(b["free"]) > 0
    }


async def place_order(
    symbol: str,
    side: str,
    order_type: str = "MARKET",
    size: str | None = None,
    amount: str | None = None,
    client_order_id: str | None = None,
) -> dict:
    """Place an order. Returns order data from Pionex."""
    body = {
        "symbol": symbol,
        "side": side,
        "type": order_type,
    }
    if size:
        body["size"] = size
    if amount:
        body["amount"] = amount
    if client_order_id:
        body["clientOrderId"] = client_order_id

    data = await _request("POST", "/api/v1/trade/order", body=body, auth=True)
    return data.get("data", {})


async def get_order(symbol: str, order_id: str) -> dict:
    """Get order status by orderId."""
    data = await _request("GET", "/api/v1/trade/order", params={"symbol": symbol, "orderId": order_id}, auth=True)
    return data.get("data", {})


async def cancel_order(symbol: str, order_id: str) -> dict:
    """Cancel an order."""
    body = {"symbol": symbol, "orderId": order_id}
    data = await _request("DELETE", "/api/v1/trade/order", body=body, auth=True)
    return data.get("data", {})


async def get_symbol_info(symbol: str = "MON_USDT") -> dict:
    """Get symbol trading rules (min order, precision, etc.)."""
    data = await _request("GET", "/api/v1/common/symbols")
    symbols = data.get("data", {}).get("symbols", [])
    for s in symbols:
        if s["symbol"] == symbol:
            return s
    raise Exception(f"Symbol {symbol} not found")
