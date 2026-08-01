export const CURRENCY_COOKIE_NAME = "dentora_currency";

/** One year -- same posture as LOCALE_COOKIE_MAX_AGE_SECONDS in lib/i18n/config.ts. A currency preference should persist indefinitely, not expire mid-session. */
export const CURRENCY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
