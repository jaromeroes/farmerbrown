# Builders Risk Submission API

## Endpoint
`PATCH https://farmerbrown-bi.calforce.pro/api/builders_risk_submissions/update_by_email`

## Authentication
`agent_api_key=3a8c4681-8dbe-4cdb-a8fb-20477cfdef88` as query parameter.

## How it works
Upserts a record by email — creates on first call, updates on subsequent calls. This means multiple checkpoints during a single call all update the same record instead of creating duplicates.

## Body Structure
```json
{
  "email": "caller@example.com",
  "builders_risk_submission": {
    "first_name": "John",
    "last_name": "Doe",
    "phone": "555-123-4567",
    "building_coverage": "500000",
    "construction_type": "Frame",
    ...
  }
}
```

## Required Fields
- `email` (top-level) — unique key for upsert
- `builders_risk_submission` (object) — all quote data in snake_case

## Rate Calculation (done in-prompt, not by API)
```
basePremium = buildingCoverage x constructionRate x deductibleModifier
feesAndTaxes = basePremium x 0.15
annualPremium = (basePremium + feesAndTaxes) x 1.30
```

## Construction Rates
- Frame: 0.00251
- Brick: 0.00242
- Masonry Non-Combustible: 0.002

## High-Risk Flags
near_coast, high_risk_fire_zone, claims_in_past_2_years, is_high_risk

## Legacy Endpoint (deprecated)
`POST https://farmerbrown.calforce.pro/api/builders_risk` — created duplicate records per checkpoint. Replaced by the PATCH endpoint above.
