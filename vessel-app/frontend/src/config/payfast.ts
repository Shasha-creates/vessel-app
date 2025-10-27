const rawMode = (import.meta.env.VITE_PAYFAST_MODE ?? 'sandbox').toLowerCase()
const sandbox = rawMode !== 'live'
const isBrowser = typeof window !== 'undefined'
const origin = isBrowser ? window.location.origin : 'http://localhost:5173'

const fallbackMerchantId = '10000100'
const fallbackMerchantKey = '46f0cd694581a'

const merchantId = import.meta.env.VITE_PAYFAST_MERCHANT_ID || (sandbox ? fallbackMerchantId : '')
const merchantKey = import.meta.env.VITE_PAYFAST_MERCHANT_KEY || (sandbox ? fallbackMerchantKey : '')

const usingFallback =
  sandbox &&
  (!import.meta.env.VITE_PAYFAST_MERCHANT_ID || !import.meta.env.VITE_PAYFAST_MERCHANT_KEY)

const DEFAULTS = {
  merchantId,
  merchantKey,
  returnUrl:
    import.meta.env.VITE_PAYFAST_RETURN_URL ?? `${origin}/donation/success`,
  cancelUrl:
    import.meta.env.VITE_PAYFAST_CANCEL_URL ?? `${origin}/donation/cancelled`,
  notifyUrl: import.meta.env.VITE_PAYFAST_NOTIFY_URL ?? '',
  passphrase: import.meta.env.VITE_PAYFAST_PASSPHRASE ?? '',
  sandbox,
  mode: sandbox ? 'sandbox' : 'live',
  usingFallback,
} as const

export type PayfastConfig = typeof DEFAULTS

export const payfastConfig: PayfastConfig = DEFAULTS
