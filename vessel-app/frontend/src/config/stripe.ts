const rawMode = (import.meta.env.VITE_STRIPE_MODE ?? 'test').toLowerCase()

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? ''
const priceId = import.meta.env.VITE_STRIPE_PRICE_ID ?? ''
const successUrl =
  import.meta.env.VITE_STRIPE_SUCCESS_URL ??
  (typeof window !== 'undefined' ? `${window.location.origin}/donation/success` : '')
const cancelUrl =
  import.meta.env.VITE_STRIPE_CANCEL_URL ??
  (typeof window !== 'undefined' ? `${window.location.origin}/donation/cancelled` : '')

const enabled = Boolean(publishableKey && priceId)

const stripeConfig = {
  publishableKey,
  priceId,
  successUrl,
  cancelUrl,
  mode: rawMode === 'live' ? 'live' : 'test',
  enabled,
} as const

export type StripeConfig = typeof stripeConfig

export { stripeConfig }
