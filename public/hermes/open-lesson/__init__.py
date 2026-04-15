"""openLesson Hermes agent plugin.

Provides 10 tools for the openLesson v2 tutoring API and a pre_llm_call hook
that injects active session context into every LLM turn.
"""

import json
import logging
from pathlib import Path

from . import schemas, tools

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Active session state — shared across tools and hooks
# ---------------------------------------------------------------------------

_active_session: dict = {"session_id": None, "topic": None}


# ---------------------------------------------------------------------------
# Wrapped handlers that track session state
# ---------------------------------------------------------------------------


def _start_session_wrapper(args: dict, **kwargs) -> str:
    """Start a session and track it as the active session."""
    result_json = tools.start_session(args, **kwargs)
    try:
        result = json.loads(result_json)
        if "error" not in result:
            session = result.get("session", {})
            _active_session["session_id"] = session.get("id")
            _active_session["topic"] = args.get("topic")
            logger.info("openLesson session started: %s", _active_session["session_id"])
    except (json.JSONDecodeError, KeyError):
        pass
    return result_json


def _end_session_wrapper(args: dict, **kwargs) -> str:
    """End a session and clear active session tracking."""
    result_json = tools.end_session(args, **kwargs)
    try:
        result = json.loads(result_json)
        if "error" not in result:
            logger.info("openLesson session ended: %s", _active_session["session_id"])
            _active_session["session_id"] = None
            _active_session["topic"] = None
    except (json.JSONDecodeError, KeyError):
        pass
    return result_json


# ---------------------------------------------------------------------------
# Hook: inject active session context before every LLM call
# ---------------------------------------------------------------------------


def _on_pre_llm_call(session_id, user_message, **kwargs):
    """Inject active openLesson session context if one is running."""
    if _active_session["session_id"]:
        return {
            "context": (
                f"[openLesson] Active tutoring session: "
                f"{_active_session['topic']} "
                f"(ID: {_active_session['session_id']})"
            )
        }
    return None


# ---------------------------------------------------------------------------
# Plugin registration entry point
# ---------------------------------------------------------------------------


def register(ctx):
    """Wire schemas to handlers and register hooks with Hermes."""

    # Plans
    ctx.register_tool(
        name="openlesson_create_plan",
        toolset="openlesson",
        schema=schemas.CREATE_PLAN,
        handler=tools.create_plan,
    )
    ctx.register_tool(
        name="openlesson_adapt_plan",
        toolset="openlesson",
        schema=schemas.ADAPT_PLAN,
        handler=tools.adapt_plan,
    )
    ctx.register_tool(
        name="openlesson_plan_from_video",
        toolset="openlesson",
        schema=schemas.PLAN_FROM_VIDEO,
        handler=tools.plan_from_video,
    )

    # Sessions (with state-tracking wrappers)
    ctx.register_tool(
        name="openlesson_start_session",
        toolset="openlesson",
        schema=schemas.START_SESSION,
        handler=_start_session_wrapper,
    )
    ctx.register_tool(
        name="openlesson_analyze",
        toolset="openlesson",
        schema=schemas.ANALYZE,
        handler=tools.analyze,
    )
    ctx.register_tool(
        name="openlesson_pause_session",
        toolset="openlesson",
        schema=schemas.PAUSE_SESSION,
        handler=tools.pause_session,
    )
    ctx.register_tool(
        name="openlesson_resume_session",
        toolset="openlesson",
        schema=schemas.RESUME_SESSION,
        handler=tools.resume_session,
    )
    ctx.register_tool(
        name="openlesson_end_session",
        toolset="openlesson",
        schema=schemas.END_SESSION,
        handler=_end_session_wrapper,
    )

    # Teaching assistant
    ctx.register_tool(
        name="openlesson_ask",
        toolset="openlesson",
        schema=schemas.ASK,
        handler=tools.ask_assistant,
    )

    # Analytics
    ctx.register_tool(
        name="openlesson_analytics",
        toolset="openlesson",
        schema=schemas.ANALYTICS,
        handler=tools.get_analytics,
    )

    # Hook
    ctx.register_hook("pre_llm_call", _on_pre_llm_call)

    # Bundled skill
    skills_dir = Path(__file__).parent / "skills"
    if skills_dir.exists():
        for child in sorted(skills_dir.iterdir()):
            skill_md = child / "SKILL.md"
            if child.is_dir() and skill_md.exists():
                ctx.register_skill(child.name, skill_md)
                logger.info("Registered openLesson skill: %s", child.name)

    logger.info("openLesson plugin registered (%d tools)", 10)
