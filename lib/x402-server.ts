const X402_PRICES = {
  plan_generation: 50,
  session_start: 100,
  session_analyze: 10,
} as const;

export type X402Endpoint = keyof typeof X402_PRICES;

export function getX402Price(endpoint: X402Endpoint): number {
  return X402_PRICES[endpoint];
}

export function getX402Description(endpoint: X402Endpoint): string {
  const descriptions: Record<X402Endpoint, string> = {
    plan_generation: "Learning plan generation",
    session_start: "Tutoring session start",
    session_analyze: "Audio chunk analysis",
  };
  return descriptions[endpoint];
}

export function create402Response(endpoint: X402Endpoint) {
  const walletAddress = process.env.X402_WALLET_ADDRESS;
  const network = process.env.X402_NETWORK || "base-sepolia";
  
  if (!walletAddress) {
    return null;
  }

  const price = getX402Price(endpoint);
  const description = getX402Description(endpoint);

  const paymentRequirements = {
    scheme: "exact",
    network,
    payTo: walletAddress,
    maxAmountRequired: price.toString(),
    instructions: [
      {
        protocol: "https",
        url: `https://x402.org/facilitators/${network}`,
      },
    ],
  };

  return new Response(
    JSON.stringify({
      error: "Payment Required",
      x402Version: 1,
      paymentRequirements,
    }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "X-402-Amount": price.toString(),
        "X-402-Currency": "usd",
        "X-402-Description": description,
      },
    }
  );
}

export function checkX402Payment(headers: Headers): {
  valid: boolean;
  payment?: unknown;
} {
  const paymentHeader = headers.get("x402-payment");
  
  if (!paymentHeader) {
    return { valid: false };
  }

  try {
    const payment = JSON.parse(Buffer.from(paymentHeader, "base64").toString());
    return { valid: true, payment };
  } catch {
    return { valid: false };
  }
}

export { X402_PRICES };
