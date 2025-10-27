import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { stripeConfig } from '../config/stripe'

type StripeDonationPayload = {
  amount: number
  reference: string
  description: string
  customerEmail?: string
}

let stripePromise: Promise<Stripe | null> | null = null

function ensureConfigured() {
  if (!stripeConfig.enabled) {
    throw new Error('Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY and VITE_STRIPE_PRICE_ID to enable it.')
  }
}

function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(stripeConfig.publishableKey)
  }
  return stripePromise
}

async function startDonation(payload: StripeDonationPayload) {
  ensureConfigured()
  const stripe = await getStripe()
  if (!stripe) {
    throw new Error('Unable to initialize Stripe. Double-check your publishable key.')
  }

  const quantity = Math.max(1, Math.round(payload.amount))
  const result = await stripe.redirectToCheckout({
    mode: 'payment',
    lineItems: [
      {
        price: stripeConfig.priceId,
        quantity,
      },
    ],
    successUrl: stripeConfig.successUrl,
    cancelUrl: stripeConfig.cancelUrl,
    clientReferenceId: payload.reference,
    customerEmail: payload.customerEmail,
  })

  if (result.error) {
    throw result.error
  }
}

function isConfigured() {
  return stripeConfig.enabled
}

export const stripeClient = {
  startDonation,
  isConfigured,
}

export type { StripeDonationPayload }
