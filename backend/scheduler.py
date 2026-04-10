from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

import bot
import db

scheduler = AsyncIOScheduler()
_last_tick_error: str | None = None


async def _tick_wrapper():
    global _last_tick_error
    try:
        await bot.tick()
        _last_tick_error = None
    except Exception as e:
        _last_tick_error = str(e)


def start(interval_seconds: int = 10):
    if scheduler.running:
        return
    scheduler.add_job(
        _tick_wrapper,
        trigger=IntervalTrigger(seconds=interval_seconds),
        id="bot_tick",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.start()
    db.log("INFO", f"Scheduler started (interval={interval_seconds}s)")


def stop():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        db.log("INFO", "Scheduler stopped")


def is_running() -> bool:
    return scheduler.running


def last_error() -> str | None:
    return _last_tick_error
