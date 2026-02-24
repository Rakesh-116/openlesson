# openLesson Agent API Skill for ElizaOS

You are an ElizaOS agent that can interact with the openLesson tutoring platform via API.

## Overview

openLesson is a tutoring system that uses audio-based dialogue to help users learn by asking questions rather than giving answers. This skill enables your ElizaOS agent to act as a personal tutor using openLesson.

## ElizaOS Integration

Your ElizaOS agent can leverage openLesson to provide tutoring through the Agent API:
- Generate personalized learning plans as directed graphs
- Start tutoring sessions
- Analyze audio to detect reasoning gaps

## Important: No Browser Tool Required

You do not need a browser tool. You only need shell tools (e.g., curl) to make API calls to openLesson.

## Important: Audio-Only System

**CRITICAL**: The openLesson platform is **audio-only**. The analyze endpoint accepts ONLY audio input, NOT text. 
- Always convert speech to base64-encoded audio before calling the analyze endpoint
- Supported formats: webm, mp4, ogg
- Do not send text to the analyze endpoint - it will be rejected

## Authentication

Include your API key in the Authorization header:
```
Authorization: Bearer YOUR_API_KEY
```

API keys can be generated from the user's dashboard at `/dashboard`.

## Bash Command Patterns

When running API calls as shell commands, use this pattern to avoid JSON escaping issues:

### Generate Learning Plan

```bash
TOPIC="Machine Learning"
DAYS=30
API_KEY="sk_YOUR_API_KEY"
bash -c "printf '{\"topic\":\"$TOPIC\",\"days\":$DAYS}' | curl -X POST 'https://openlesson.academy/api/agent/plan' -H 'Authorization: Bearer $API_KEY' -H 'Content-Type: application/json' --data-binary @-"
```

### Start Session

```bash
PLAN_NODE_ID="node-uuid"
PROBLEM="Explain gradient descent"
API_KEY="sk_YOUR_API_KEY"
bash -c "printf '{\"plan_node_id\":\"$PLAN_NODE_ID\",\"problem\":\"$PROBLEM\"}' | curl -X POST 'https://openlesson.academy/api/agent/session/start' -H 'Authorization: Bearer $API_KEY' -H 'Content-Type: application/json' --data-binary @-"
```

### Analyze Audio

```bash
SESSION_ID="session-uuid"
AUDIO_BASE64="$(base64 -w0 audio.webm)"
AUDIO_FORMAT="webm"
API_KEY="sk_YOUR_API_KEY"
bash -c "printf '{\"session_id\":\"$SESSION_ID\",\"audio_base64\":\"$AUDIO_BASE64\",\"audio_format\":\"$AUDIO_FORMAT\"}' | curl -X POST 'https://openlesson.academy/api/agent/session/analyze' -H 'Authorization: Bearer $API_KEY' -H 'Content-Type: application/json' --data-binary @-"
```

## Response Handling

### Plan Generation Response
Returns:
- `planId`: UUID of created plan
- `topic`: The topic requested
- `days`: Plan duration
- `nodes`: Array of learning nodes
- `pricing`: Cost breakdown

### Session Start Response
Returns:
- `sessionId`: UUID of new session
- `problem`: The problem/topic
- `status`: "active"

### Audio Analysis Response
Returns:
- `sessionId`: The session ID
- `gapScore`: Number 0-1 indicating reasoning gap severity
- `signals`: Array of detected reasoning signals
- `followUpQuestion`: Suggested Socratic question
- `requiresFollowUp`: Boolean

## Error Codes

- `400`: Bad request - missing or invalid parameters
- `401`: Invalid or inactive API key
- `402`: Payment required - see x402 payment flow
- `500`: Server error

## Payment (x402 Protocol)

If a request returns 402, you need to:
1. Get payment requirements from `/api/agent/payment-requirements`
2. Process payment via x402 client
3. Retry request with `x402-payment` header

## Best Practices for ElizaOS

1. **Always use audio**: The system requires audio input for analysis
2. **Check payment status**: Handle 402 responses gracefully
3. **Store session IDs**: Keep track of session IDs for follow-up questions
4. **Parse responses**: Extract `followUpQuestion` from analyze responses to ask the user
5. **Rate limiting**: The API is rate-limited to 100 requests/minute per key
