import type { WalletMessage, WalletResponse } from './types';

/**
 * Send message to background service worker
 */
export async function sendMessage<T, R>(
  type: string,
  payload?: T
): Promise<WalletResponse<R>> {
  const message: WalletMessage<T> = { type, payload };

  try {
    const response = await chrome.runtime.sendMessage(message);
    return response as WalletResponse<R>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a typed message sender
 */
export function createMessageSender<Payload, Response>(type: string) {
  return (payload?: Payload) => sendMessage<Payload, Response>(type, payload);
}

/**
 * Listen for messages in background
 */
export function onMessage(
  handler: (
    message: WalletMessage,
    sender: chrome.runtime.MessageSender
  ) => Promise<WalletResponse>
): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handler(message, sender)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    return true; // Keep channel open for async response
  });
}
