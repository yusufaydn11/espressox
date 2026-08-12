export function buildRetailPaymentInitiateUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/functions/v1/retail-payment-initiate`;
}

export function buildRetail3DSPageUrl(baseUrl: string, sessionToken: string): string {
  const root = baseUrl.replace(/\/$/, "");
  return `${root}/functions/v1/retail-payment-initiate?session=${encodeURIComponent(sessionToken)}`;
}

export function buildRetailPaymentWebhookUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/functions/v1/retail-payment-webhook?action=webhook`;
}
