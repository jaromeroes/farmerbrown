# Jennifer — VAPI Tool Definitions
These are the three tools configured in VAPI for the Jennifer assistant.

---

## 1. submit_quote

Submits or updates a builders risk insurance quote by email. Uses PATCH to upsert — the same record is updated on every call (matched by email), so progressive data capture works without creating duplicates.

### VAPI Tool Config
- **Type:** apiRequest
- **Method:** PATCH
- **URL:** `https://farmerbrown-bi.calforce.pro/api/builders_risk_submissions/update_by_email?agent_api_key=3a8c4681-8dbe-4cdb-a8fb-20477cfdef88`

### Body Schema
```json
{
  "type": "object",
  "required": ["email", "builders_risk_submission"],
  "properties": {
    "email": { "type": "string", "description": "Email address — unique key for upsert" },
    "builders_risk_submission": {
      "type": "object",
      "properties": {
        "first_name": { "type": "string" },
        "last_name": { "type": "string" },
        "phone": { "type": "string" },
        "company_name": { "type": "string" },
        "user_type": { "type": "string", "description": "Owner, Builder, or Both" },
        "form_of_business": { "type": "string", "description": "LLC, Individual, Association, Corporation, or Joint Venture" },
        "builder_name": { "type": "string" },
        "builder_city_state": { "type": "string" },
        "building_street": { "type": "string" },
        "building_city": { "type": "string" },
        "building_state": { "type": "string", "description": "2-letter state code" },
        "building_zip": { "type": "string" },
        "building_type": { "type": "string" },
        "construction_type": { "type": "string", "description": "Frame, Brick, or Masonry Non-Combustible" },
        "number_of_stories": { "type": "string" },
        "has_basement": { "type": "string", "description": "Yes or No" },
        "square_footage": { "type": "string" },
        "project_type": { "type": "string", "description": "New Construction or Remodel" },
        "coverage_date": { "type": "string", "description": "YYYY-MM-DD" },
        "building_coverage": { "type": "string", "description": "USD amount e.g. 500000" },
        "deductible": { "type": "string", "description": "$5,000, $2,500, or $1,000" },
        "deductible_label": { "type": "string" },
        "near_coast": { "type": "string", "description": "Yes or No" },
        "high_risk_fire_zone": { "type": "string", "description": "Yes or No" },
        "claims_in_past_2_years": { "type": "string", "description": "Yes or No" },
        "project_already_started": { "type": "string", "description": "Yes or No" },
        "project_start_date": { "type": "string", "description": "YYYY-MM-DD" },
        "expected_complete_date": { "type": "string", "description": "YYYY-MM-DD" },
        "percent_complete": { "type": "string" },
        "work_already_completed_description": { "type": "string" },
        "is_high_risk": { "type": "boolean" },
        "sms_consent": { "type": "boolean" },
        "existing_structure_value": { "type": "string" },
        "renovation_value": { "type": "string" },
        "square_footage_after_renovation": { "type": "string" },
        "structure_condition": { "type": "string" },
        "work_being_done": { "type": "string" },
        "work_description": { "type": "string" },
        "provide_social_security": { "type": "string" },
        "social_security_number": { "type": "string" }
      }
    }
  }
}
```

---

## 2. check_availability

Fetches available appointment slots from Calendly. Used before offering appointment times to the caller.

### VAPI Tool Config
```json
{
  "type": "function",
  "function": {
    "name": "check_availability",
    "description": "Get available appointment slots for the next 6 days. Call this before offering appointment times. Present 2-3 options to the caller naturally.",
    "parameters": {
      "type": "object",
      "properties": {
        "timezone": {
          "type": "string",
          "description": "Caller's timezone ID (e.g. America/Chicago). Ask the caller if unsure.",
          "enum": [
            "America/Los_Angeles",
            "America/Denver",
            "America/Chicago",
            "America/New_York",
            "America/Anchorage",
            "America/Phoenix",
            "America/St_Johns",
            "Pacific/Honolulu",
            "UTC"
          ]
        }
      },
      "required": ["timezone"]
    }
  },
  "server": {
    "url": "https://farmerbrown-bi.calforce.pro/api/calendly/available_times?agent_api_key=3a8c4681-8dbe-4cdb-a8fb-20477cfdef88",
    "method": "GET"
  }
}
```

**Note:** The API returns times in UTC. The agent converts them to the caller's timezone when presenting options.

---

## 3. book_appointment

Books a confirmed appointment via Calendly. Called after the caller selects a time slot.

### VAPI Tool Config
```json
{
  "type": "function",
  "function": {
    "name": "book_appointment",
    "description": "Book an appointment with a licensed agent. Call after the caller picks a time from the available slots. Confirm the booking to the caller with day, time, and email.",
    "parameters": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "description": "Full name of the caller" },
        "email": { "type": "string", "description": "Email address" },
        "phone_number": { "type": "string", "description": "Phone number" },
        "timezone": {
          "type": "string",
          "description": "Caller's timezone ID",
          "enum": [
            "America/Los_Angeles",
            "America/Denver",
            "America/Chicago",
            "America/New_York",
            "America/Anchorage",
            "America/Phoenix",
            "America/St_Johns",
            "Pacific/Honolulu",
            "UTC"
          ]
        },
        "start_time": { "type": "string", "description": "Selected appointment time in ISO8601 format (e.g. 2026-03-25T14:00:00Z)" }
      },
      "required": ["name", "email", "start_time"]
    }
  },
  "server": {
    "url": "https://farmerbrown-bi.calforce.pro/api/calendly/book_event?agent_api_key=3a8c4681-8dbe-4cdb-a8fb-20477cfdef88",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
```

---

## 4. transfer_to_live_agent

Transfers the call to a live licensed insurance agent at +18779600221. VAPI handles the SIP transfer automatically.

### VAPI Tool Config
```json
{
  "type": "transferCall",
  "function": {
    "name": "transfer_to_live_agent",
    "description": "Transfer the caller to a live licensed insurance agent. Use when: (1) the caller says 'live agent' or asks to speak to a person, (2) the caller seems frustrated or confused after two attempts, (3) the conversation is not progressing well. Before transferring, always call submit_quote silently with all data collected so far.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": []
    }
  },
  "destinations": [
    {
      "type": "number",
      "number": "+18779600221",
      "message": "Of course, let me connect you with one of our licensed agents right now."
    }
  ]
}
```

---

## API Mapping Summary

| Tool Name | API Endpoint / Action | Method |
|-----------|----------------------|--------|
| `submit_quote` | `https://farmerbrown.calforce.pro/api/builders_risk` | POST |
| `check_availability` | `https://farmerbrown-bi.calforce.pro/api/calendly/available_times?agent_api_key=...` | GET |
| `book_appointment` | `https://farmerbrown-bi.calforce.pro/api/calendly/book_event?agent_api_key=...` | POST |
| `transfer_to_live_agent` | SIP transfer to +18779600221 | transferCall |
