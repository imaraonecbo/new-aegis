import { createPublicClient, http, fallback, type PublicClient } from 'viem';
import { arbitrum } from 'viem/chains';
import { PUBLIC_RPC_URLS } from './constants';

// ============================================================================
// READ-ONLY CLIENT — deliberately has no account, no signer, no private key.
// This module cannot send a transaction even if you wanted it to. That's
// intentional for this stage: nothing here should be able to touch funds.
// ============================================================================

let _client: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (_client) return _client;

  _client = createPublicClient({
    chain: arbitrum,
    transport: fallback(
      PUBLIC_RPC_URLS.map((url) => http(url, { timeout: 8_000, retryCount: 1 })),
      { rank: false } // try in listed order, fall through on failure
    ),
  }) as PublicClient;

  return _client;
}

/** Sanity check: confirms we're actually talking to Arbitrum One (chainId 42161)
 * and that the RPC is live. Call this once at startup — fail loudly if it's wrong. */
export async function assertConnected(): Promise<void> {
  const client = getPublicClient();
  const chainId = await client.getChainId();
  if (chainId !== 42161) {
    throw new Error(
      `FATAL: connected RPC reports chainId ${chainId}, expected 42161 (Arbitrum One). ` +
      `Refusing to proceed — wrong chain means every address/quote below is meaningless.`
    );
  }
  const block = await client.getBlockNumber();
  console.log(`[chain] connected to Arbitrum One, latest block: ${block}`);
}
