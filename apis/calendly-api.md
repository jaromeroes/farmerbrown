# Calendly API Documentation

## Base URL
```
https://farmerbrown-bi.calforce.pro/api
```

## Authentication
All endpoints require `agent_api_key=3a8c4681-8dbe-4cdb-a8fb-20477cfdef88` as query parameter.

---

## Endpoints

### 1. Get Supported Timezones
`GET /calendly/timezones`

### 2. Get Available Times
`GET /calendly/available_times`
- Query: `timezone` (optional, default: UTC)
- Returns available slots for next 6 days

### 3. Book Event
`POST /calendly/book_event`
- Required: `name` (or `first_name`+`last_name`), `email`, `start_time`
- Optional: `timezone`, `phone_number`

## Notes
- Timezone is case-sensitive
- Start times in ISO8601 format
- Attribution tracked as `utm_source: "ai_agent_sarah"`
