# General Liability Quote API

## Endpoint
`POST https://farmerbrown.calforce.pro/api/submit`

## How it works
Submits contractor data to the Farmer Brown quote engine. The backend forwards the data to two insurance carriers (ISC and BTIS) and returns real-time quotes with premium pricing and payment plans.

No authentication required (no API key).

## Request Body (camelCase)
```json
{
  "firstName": "Maria",
  "lastName": "Garcia",
  "email": "contractor@example.com",
  "phone": "(305) 555-1234",
  "companyName": "Garcia Electric LLC",
  "address": "742 Evergreen Terrace",
  "city": "Houston",
  "state": "TX",
  "zipCode": "77001",
  "workTypes": ["electrical"],
  "description": "Residential and light commercial electrical work",
  "grossReceipts": "350000",
  "subcontractingCosts": "50000",
  "materialCosts": "80000",
  "fieldEmployees": "3",
  "payroll": "120000",
  "yearsInBusiness": "10",
  "yearsOfExperience": "12",
  "entityType": "LLC",
  "commercialPercent": "20%",
  "residentialPercent": "80%",
  "newConstructionPercent": "40%",
  "remodelPercent": "60%",
  "exteriorPercent": "30%",
  "interiorPercent": "70%",
  "buildingsOver3Stories": "No",
  "heatingEquipment": "No",
  "quoteReason": "New policy",
  "howDidYouHear": "Google",
  "smsConsent": true,
  "additionalQuotes": ["Workers Compensation"],
  "locale": "en"
}
```

## Required Fields
- firstName, lastName, email, phone
- address, city, state, zipCode
- grossReceipts
- workTypes (array with at least one slug)

## Field Reference

### Contact
| Field | Type | Description |
|-------|------|-------------|
| firstName | string | First name |
| lastName | string | Last name |
| email | string | Email address |
| phone | string | Phone in (###) ###-#### format |
| companyName | string | Company name / DBA |

### Business Profile
| Field | Type | Description |
|-------|------|-------------|
| workTypes | array | Array with one slug string (e.g. ["electrical"]) |
| description | string | Description of operations |
| yearsInBusiness | string | Number |
| yearsOfExperience | string | Number |
| entityType | string | LLC, Sole Proprietor, Corporation, Partnership |

### Financials
| Field | Type | Description |
|-------|------|-------------|
| grossReceipts | string | USD amount, no commas (e.g. "350000") |
| subcontractingCosts | string | USD amount |
| materialCosts | string | USD amount |
| fieldEmployees | string | Number |
| payroll | string | USD amount (excluding 1099 subs) |

### Work Mix (percentages with "%" suffix)
| Field | Type | Description |
|-------|------|-------------|
| commercialPercent | string | e.g. "80%" |
| residentialPercent | string | e.g. "20%" |
| newConstructionPercent | string | e.g. "40%" |
| remodelPercent | string | e.g. "60%" |
| exteriorPercent | string | e.g. "30%" |
| interiorPercent | string | e.g. "70%" |

### Address
| Field | Type | Description |
|-------|------|-------------|
| address | string | Street address |
| city | string | City |
| state | string | 2-letter state code |
| zipCode | string | ZIP code |

### Risk & Other
| Field | Type | Description |
|-------|------|-------------|
| buildingsOver3Stories | string | "Yes" or "No" |
| heatingEquipment | string | "Yes" or "No" |
| quoteReason | string | Why they're shopping |
| howDidYouHear | string | Marketing attribution |
| smsConsent | boolean | SMS opt-in |
| additionalQuotes | array | Cross-sell interests (e.g. ["Workers Compensation"]) |
| locale | string | Always "en" |

## Response
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
    "paymentPlans": [{"key": 1, "value": "One Pay"}, {"key": 4, "value": "Ten Pay"}],
    "premiumBreakdown": {
      "premium": 3025,
      "earnedFees": 250,
      "taxes": 0,
      "brokerFee": 95,
      "installments": {
        "onePay": {"down": 3380, "monthly": 0},
        "tenPay": {"down": 657.5, "monthly": 312.5}
      }
    },
    "error": null
  }
}
```

## Carriers
- **ISC** — returns policyCost with payment plan details
- **BTIS** (via marketplace.btisinc.com) — returns totalPremium with premium breakdown and multiple payment options. Only supports certain classifications; returns `success: false` when no carrier matches.

## Known workTypes slugs
- `roofing_repair_residential` (confirmed from real form submission)
- `electrical` (confirmed via API test)
- Others TBD — need to confirm with Tyler

## Notes
- This is the same endpoint used by the farmerbrown.com/instant-insurance-quote-isc/ web form
- No API key required
- Both carriers may fail for certain classifications — handle gracefully
