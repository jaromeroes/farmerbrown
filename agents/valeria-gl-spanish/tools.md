# Sarah GL — VAPI Tool Definitions
These are the tools configured in VAPI for the Sarah General Liability assistant.

---

## 1. submit_gl_form

Submits contractor data to the Farmer Brown quote engine, which calls ISC and BTIS carriers to get real-time pricing. Returns quotes with premium amounts and payment plans.

### VAPI Tool Config
- **Type:** apiRequest
- **Method:** POST
- **URL:** `https://farmerbrown.calforce.pro/api/submit`
- **Tool ID:** TBD (create in VAPI)

### Body Schema
```json
{
  "type": "object",
  "required": ["firstName", "lastName", "email", "phone", "address", "city", "state", "zipCode", "grossReceipts", "workTypes"],
  "properties": {
    "firstName": { "type": "string" },
    "lastName": { "type": "string" },
    "email": { "type": "string" },
    "phone": { "type": "string", "description": "Format: (###) ###-####" },
    "companyName": { "type": "string" },
    "address": { "type": "string", "description": "Street address" },
    "city": { "type": "string" },
    "state": { "type": "string", "description": "2-letter state code" },
    "zipCode": { "type": "string" },
    "workTypes": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Array with one slug, e.g. ['electrical']"
    },
    "description": { "type": "string", "description": "Description of operations" },
    "grossReceipts": { "type": "string", "description": "Annual gross receipts, no commas (e.g. '350000')" },
    "subcontractingCosts": { "type": "string", "description": "Annual subcontracting costs" },
    "materialCosts": { "type": "string", "description": "Annual material costs" },
    "fieldEmployees": { "type": "string", "description": "Number of field employees" },
    "payroll": { "type": "string", "description": "Annual payroll excluding 1099 subs" },
    "yearsInBusiness": { "type": "string" },
    "yearsOfExperience": { "type": "string" },
    "entityType": { "type": "string", "description": "LLC, Sole Proprietor, Corporation, Partnership" },
    "commercialPercent": { "type": "string", "description": "e.g. '80%'" },
    "residentialPercent": { "type": "string", "description": "e.g. '20%'" },
    "newConstructionPercent": { "type": "string", "description": "e.g. '40%'" },
    "remodelPercent": { "type": "string", "description": "e.g. '60%'" },
    "exteriorPercent": { "type": "string", "description": "e.g. '30%'" },
    "interiorPercent": { "type": "string", "description": "e.g. '70%'" },
    "buildingsOver3Stories": { "type": "string", "description": "'Yes' or 'No'" },
    "heatingEquipment": { "type": "string", "description": "'Yes' or 'No'" },
    "quoteReason": { "type": "string" },
    "howDidYouHear": { "type": "string" },
    "smsConsent": { "type": "boolean" },
    "additionalQuotes": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Cross-sell interests, e.g. ['Workers Compensation', 'Commercial Auto']"
    },
    "locale": { "type": "string", "description": "Always 'en'" }
  }
}
```

### Response Schema
```json
{
  "success": true,
  "message": "Submission received",
  "calendlyResultUrl": "https://calendly.com/...",
  "isc": {
    "appId": "3949078",
    "transactionId": "17042730",
    "policyCost": "1301.79",
    "downPayment": "290.27",
    "monthlyPayment": "123.58",
    "numberOfPayments": "10",
    "error": null
  },
  "btis": {
    "success": true,
    "carrier": "clearspring",
    "submissionId": "QMGL2528984",
    "totalPremium": 3275,
    "paymentPlans": [
      { "key": 1, "value": "One Pay" },
      { "key": 4, "value": "Ten Pay" }
    ],
    "premiumBreakdown": {
      "premium": 3025,
      "earnedFees": 250,
      "taxes": 0,
      "brokerFee": 95,
      "installments": {
        "onePay": { "down": 3380, "monthly": 0 },
        "tenPay": { "down": 657.5, "monthly": 312.5 }
      }
    },
    "error": null
  }
}
```

**Notes:**
- ISC may return `policyCost` or `null` depending on classification support
- BTIS may return `success: false` with an error if no carrier matches
- Both can fail — treat as hard-to-place in that case
- The API also returns a `calendlyResultUrl` for scheduling

---

## 2. check_availability (global — shared)

Fetches available appointment slots from Calendly.

- **Tool ID:** `dd2504ab-c665-493f-915d-345b0696017f`
- **Type:** function (apiRequest GET)
- **URL:** `https://farmerbrown-bi.calforce.pro/api/calendly/available_times?agent_api_key=${CALFORCE_AGENT_KEY}`
- **Parameters:** timezone (enum of US timezones)
- **Returns:** UTC times for the next 6 days

---

## 3. book_appointment (global — shared)

Books a confirmed appointment via Calendly.

- **Tool ID:** `642280ea-5ea0-4d1e-a7fe-35439016de10`
- **Type:** function (apiRequest POST)
- **URL:** `https://farmerbrown-bi.calforce.pro/api/calendly/book_event?agent_api_key=${CALFORCE_AGENT_KEY}`
- **Parameters:** name, email, phone_number, timezone, start_time (ISO8601 UTC)

---

## 4. transfer_to_live_agent (global — shared)

Transfers the call to a live licensed insurance agent.

- **Tool ID:** `75d7c8f3-646e-4b44-9629-2baa2a2d81dd`
- **Type:** transferCall
- **Destination:** +18779600221
- **When:** caller asks for a person, or caller is frustrated after 2 attempts

---

## 5. end_call (VAPI built-in)

Terminates the call. Must be called after final goodbye.

---

## API Mapping Summary

| Tool Name | API Endpoint / Action | Method |
|-----------|----------------------|--------|
| `submit_gl_form` | `https://farmerbrown.calforce.pro/api/submit` | POST |
| `check_availability` | `https://farmerbrown-bi.calforce.pro/api/calendly/available_times?agent_api_key=...` | GET |
| `book_appointment` | `https://farmerbrown-bi.calforce.pro/api/calendly/book_event?agent_api_key=...` | POST |
| `transfer_to_live_agent` | SIP transfer to +18779600221 | transferCall |
