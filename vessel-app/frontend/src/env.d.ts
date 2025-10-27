/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAYFAST_MERCHANT_ID?: string
  readonly VITE_PAYFAST_MERCHANT_KEY?: string
  readonly VITE_PAYFAST_RETURN_URL?: string
  readonly VITE_PAYFAST_CANCEL_URL?: string
  readonly VITE_PAYFAST_NOTIFY_URL?: string
  readonly VITE_PAYFAST_PASSPHRASE?: string
  readonly VITE_PAYFAST_MODE?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  readonly VITE_STRIPE_PRICE_ID?: string
  readonly VITE_STRIPE_SUCCESS_URL?: string
  readonly VITE_STRIPE_CANCEL_URL?: string
  readonly VITE_STRIPE_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
