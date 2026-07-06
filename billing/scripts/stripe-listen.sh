#!/usr/bin/env bash
# Forward Stripe webhook events to the local dev server.
# Requires the Stripe CLI to be installed (https://stripe.com/docs/stripe-cli).
#
# Usage:
#   npm run stripe:listen
#
# On first run, copy the printed webhook signing secret into STRIPE_WEBHOOK_SECRET
# in your .env file. The signing secret rotates on every `stripe listen` run.

set -euo pipefail

if ! command -v stripe >/dev/null 2>&1; then
  echo "Stripe CLI not found. Install: https://stripe.com/docs/stripe-cli"
  exit 1
fi

PORT="${PORT:-4321}"
exec stripe listen --forward-to "localhost:${PORT}/api/stripe-webhook"
