# openLesson Plugin for Hermes Agent

Hermes agent plugin for the [openLesson](https://www.openlesson.academy) tutoring platform v2 API. Create learning plans, run multimodal Socratic tutoring sessions, ask the teaching assistant, and retrieve analytics — all from your agent.

## Install

```bash
hermes plugins install openlesson
```

Or via pip:

```bash
pip install hermes-plugin-openlesson
```

## Configuration

Set your API key as an environment variable:

```bash
export OPENLESSON_API_KEY="your-api-key"
```

Get a key from your [openLesson dashboard](https://www.openlesson.academy/dashboard).

## Tools

| Tool | Description |
|------|-------------|
| `openlesson_create_plan` | Create a structured learning plan for a topic |
| `openlesson_adapt_plan` | Modify an existing plan with natural language |
| `openlesson_plan_from_video` | Generate a plan from a YouTube video |
| `openlesson_start_session` | Start a tutoring session (standalone or plan-linked) |
| `openlesson_analyze` | Submit text/audio/image for Socratic analysis |
| `openlesson_pause_session` | Pause an active session |
| `openlesson_resume_session` | Resume a paused session |
| `openlesson_end_session` | End a session and get the report |
| `openlesson_ask` | Ask the teaching assistant a question |
| `openlesson_analytics` | Get user learning analytics |

## Hooks

- **`pre_llm_call`** — Injects active session context into every LLM turn so the model stays aware of the current tutoring session.

## Example

```
> Learn about quantum computing

Agent uses openlesson_create_plan to build a 14-day curriculum,
then openlesson_start_session to begin the first session.
The pre_llm_call hook keeps session context visible across turns.
```

## License

MIT
