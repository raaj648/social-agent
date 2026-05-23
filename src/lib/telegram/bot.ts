const TELEGRAM_API = 'https://api.telegram.org/bot';

export async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string
): Promise<boolean> {
  try {
    const url = `${TELEGRAM_API}${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Telegram sendMessage error:', err);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Telegram sendMessage exception:', error);
    return false;
  }
}

export async function setTelegramWebhook(
  botToken: string,
  webhookUrl: string
): Promise<boolean> {
  try {
    const url = `${TELEGRAM_API}${botToken}/setWebhook`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message'],
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram setWebhook error:', data.description);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Telegram setWebhook exception:', error);
    return false;
  }
}

export async function deleteTelegramWebhook(botToken: string): Promise<boolean> {
  try {
    const url = `${TELEGRAM_API}${botToken}/deleteWebhook`;
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();
    return data.ok;
  } catch {
    return false;
  }
}

export async function getTelegramBotInfo(botToken: string): Promise<{ username?: string; id?: number } | null> {
  try {
    const url = `${TELEGRAM_API}${botToken}/getMe`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok && data.result) {
      return { username: data.result.username, id: data.result.id };
    }
    return null;
  } catch {
    return null;
  }
}
