"""
State machine: WATCHING → BUYING → HOLDING → SELLING → WATCHING

WATCHING: Track local high as reference_price. When price drops 3% from reference → BUYING.
BUYING:   Market buy with amount=position_size USDT. Poll until filled → HOLDING.
HOLDING:  Update peak_price when price rises. When price drops 3% from peak → SELLING.
SELLING:  Market sell size=entry_size. Poll until filled. Calculate P&L → WATCHING.
"""

import time
from decimal import Decimal

import db
import pionex_client as px
from models import BotStatus, Order, OrderSide, Trade


async def tick() -> None:
    """Called every poll interval by the scheduler."""
    config = db.get_bot_config()
    if not config.enabled:
        return

    state = db.get_bot_state()
    symbol = config.symbol

    try:
        if state.status == BotStatus.WATCHING:
            await _watching(state, config, symbol)
        elif state.status == BotStatus.BUYING:
            await _buying(state, config, symbol)
        elif state.status == BotStatus.HOLDING:
            await _holding(state, config, symbol)
        elif state.status == BotStatus.SELLING:
            await _selling(state, config, symbol)
    except Exception as e:
        db.log("ERROR", f"tick error in {state.status}: {e}", {"status": state.status})
        raise


async def _watching(state, config, symbol: str) -> None:
    ticker = await px.get_ticker(symbol)
    price = ticker["price"]

    # Record price
    db.insert_price(symbol, price, ticker.get("volume"))

    ref = state.reference_price or price

    # Ratchet reference price up
    if price > ref:
        db.update_bot_state(reference_price=str(price))
        db.log("DEBUG", f"Reference price updated to {price}", {"price": str(price)})
        return

    # Check for dip
    dip_threshold = ref * (1 - config.dip_pct)
    if price <= dip_threshold:
        db.log("INFO", f"Dip detected: {price} <= {dip_threshold} (ref={ref})", {
            "price": str(price), "threshold": str(dip_threshold), "reference": str(ref),
        })
        # Place market buy
        client_order_id = f"BUY-{int(time.time() * 1000)}"
        result = await px.place_order(
            symbol=symbol,
            side="BUY",
            order_type="MARKET",
            amount=str(config.position_size),
            client_order_id=client_order_id,
        )
        order_id = result.get("orderId", "")
        db.insert_order(Order(
            pionex_order_id=order_id,
            client_order_id=client_order_id,
            symbol=symbol,
            side=OrderSide.BUY,
            amount=config.position_size,
            status="NEW",
        ))
        db.update_bot_state(status="BUYING", buy_order_id=order_id)
        db.log("INFO", f"Buy order placed: {order_id}", {"order_id": order_id, "amount": str(config.position_size)})
    else:
        db.update_bot_state(reference_price=str(ref))


async def _buying(state, config, symbol: str) -> None:
    if not state.buy_order_id:
        db.log("ERROR", "BUYING state but no buy_order_id, resetting to WATCHING")
        db.update_bot_state(status="WATCHING", buy_order_id=None)
        return

    order_data = await px.get_order(symbol, state.buy_order_id)
    status = order_data.get("status", "")

    if status in ("FILLED", "CLOSED"):
        filled_size = Decimal(str(order_data.get("filledSize", "0")))
        filled_amount = Decimal(str(order_data.get("filledAmount", "0")))
        avg_price = Decimal(str(order_data.get("avgPrice", "0")))

        db.update_order(
            state.buy_order_id,
            filled_size=str(filled_size),
            filled_amount=str(filled_amount),
            avg_price=str(avg_price),
            status="FILLED",
        )

        # Open trade record
        db.insert_trade(Trade(
            buy_order_id=state.buy_order_id,
            symbol=symbol,
            entry_price=avg_price,
            size=filled_size,
        ))

        db.update_bot_state(
            status="HOLDING",
            entry_price=str(avg_price),
            entry_size=str(filled_size),
            peak_price=str(avg_price),
            buy_order_id=None,
        )
        db.log("INFO", f"Buy filled: {filled_size} @ {avg_price}", {
            "size": str(filled_size), "price": str(avg_price), "amount": str(filled_amount),
        })
    elif status in ("CANCELED", "REJECTED", "EXPIRED"):
        db.update_order(state.buy_order_id, status=status)
        db.update_bot_state(status="WATCHING", buy_order_id=None)
        db.log("WARN", f"Buy order {status}: {state.buy_order_id}")


async def _holding(state, config, symbol: str) -> None:
    ticker = await px.get_ticker(symbol)
    price = ticker["price"]

    db.insert_price(symbol, price, ticker.get("volume"))

    peak = state.peak_price or price

    # Ratchet peak up
    if price > peak:
        db.update_bot_state(peak_price=str(price))
        db.log("DEBUG", f"Peak price updated to {price}")
        return

    # Check trailing stop
    stop_threshold = peak * (1 - config.trail_pct)
    if price <= stop_threshold:
        db.log("INFO", f"Trailing stop hit: {price} <= {stop_threshold} (peak={peak})", {
            "price": str(price), "threshold": str(stop_threshold), "peak": str(peak),
        })
        # Place market sell
        client_order_id = f"SELL-{int(time.time() * 1000)}"
        result = await px.place_order(
            symbol=symbol,
            side="SELL",
            order_type="MARKET",
            size=str(state.entry_size),
            client_order_id=client_order_id,
        )
        order_id = result.get("orderId", "")
        db.insert_order(Order(
            pionex_order_id=order_id,
            client_order_id=client_order_id,
            symbol=symbol,
            side=OrderSide.SELL,
            size=state.entry_size,
            status="NEW",
        ))
        db.update_bot_state(status="SELLING", sell_order_id=order_id)
        db.log("INFO", f"Sell order placed: {order_id}", {"order_id": order_id, "size": str(state.entry_size)})
    else:
        db.update_bot_state(peak_price=str(peak))


async def _selling(state, config, symbol: str) -> None:
    if not state.sell_order_id:
        db.log("ERROR", "SELLING state but no sell_order_id, resetting to WATCHING")
        db.update_bot_state(
            status="WATCHING", sell_order_id=None, entry_price=None,
            entry_size=None, peak_price=None, reference_price=None,
        )
        return

    order_data = await px.get_order(symbol, state.sell_order_id)
    status = order_data.get("status", "")

    if status in ("FILLED", "CLOSED"):
        filled_size = Decimal(str(order_data.get("filledSize", "0")))
        filled_amount = Decimal(str(order_data.get("filledAmount", "0")))
        avg_price = Decimal(str(order_data.get("avgPrice", "0")))

        db.update_order(
            state.sell_order_id,
            filled_size=str(filled_size),
            filled_amount=str(filled_amount),
            avg_price=str(avg_price),
            status="FILLED",
        )

        # Calculate P&L
        entry_amount = state.entry_price * state.entry_size
        exit_amount = avg_price * filled_size
        pnl_usdt = exit_amount - entry_amount
        pnl_pct = (pnl_usdt / entry_amount * 100) if entry_amount else Decimal("0")

        # Close trade
        db.close_trade(
            buy_order_id=state.buy_order_id or "",
            sell_order_id=state.sell_order_id,
            exit_price=avg_price,
            pnl_usdt=pnl_usdt,
            pnl_pct=pnl_pct,
        )

        # Reset to WATCHING
        db.update_bot_state(
            status="WATCHING",
            reference_price=str(avg_price),
            peak_price=None,
            entry_price=None,
            entry_size=None,
            buy_order_id=None,
            sell_order_id=None,
        )
        db.log("INFO", f"Sell filled: {filled_size} @ {avg_price} | P&L: {pnl_usdt:.2f} USDT ({pnl_pct:.2f}%)", {
            "size": str(filled_size), "price": str(avg_price), "pnl_usdt": str(pnl_usdt), "pnl_pct": str(pnl_pct),
        })
    elif status in ("CANCELED", "REJECTED", "EXPIRED"):
        db.update_order(state.sell_order_id, status=status)
        # Stay in HOLDING — we still have the position
        db.update_bot_state(status="HOLDING", sell_order_id=None)
        db.log("WARN", f"Sell order {status}: {state.sell_order_id}, reverting to HOLDING")
