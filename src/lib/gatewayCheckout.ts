/**
 * The payment gateway checkout (Razorpay) behind a small adapter. The backend returns `checkout` options with
 * the order; a `redirect_url` means a hosted page, otherwise the checkout script opens a pop-up on this page.
 * The browser never decides a payment worked: `onPaid` only hands the gateway payment id to the verify call.
 */
interface RazorpayInstance {
  open(): void;
  on(event: string, cb: (r: unknown) => void): void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

export const redirectTo = (url: string) => window.location.assign(url);

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPT;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('The payment window could not be loaded.'));
    document.head.appendChild(el);
  });
}

export interface CheckoutHandlers {
  onPaid: (gatewayPaymentId: string) => void;
  onFailed: () => void;
  onDismiss: () => void;
}

export async function openCheckout(checkout: Record<string, unknown>, h: CheckoutHandlers): Promise<void> {
  const hosted = typeof checkout.redirect_url === 'string' ? checkout.redirect_url : null;
  if (hosted) {
    redirectTo(hosted);
    return;
  }
  await loadScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('The payment window could not be loaded.');
  const rzp = new Razorpay({
    ...checkout,
    handler: (r: { razorpay_payment_id?: string }) => {
      if (r.razorpay_payment_id) h.onPaid(r.razorpay_payment_id);
      else h.onFailed();
    },
    modal: { ondismiss: h.onDismiss },
  });
  rzp.on('payment.failed', () => h.onFailed());
  rzp.open();
}
