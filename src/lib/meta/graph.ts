const META_GRAPH_URL = 'https://graph.facebook.com/v19.0';

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface FacebookPage {
  id: string;
  name: string;
  category: string;
  picture: { data: { url: string } };
  access_token: string;
}

interface InstagramBusinessAccount {
  id: string;
  ig_id: number;
  username: string;
  name: string;
  profile_picture_url: string;
}

export async function getLongLivedUserToken(shortLivedToken: string, clientId: string, clientSecret: string): Promise<string> {
  const url = new URL(`${META_GRAPH_URL}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('fb_exchange_token', shortLivedToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to exchange token: ${err}`);
  }

  const data: FacebookTokenResponse = await res.json();
  return data.access_token;
}

export async function getUserPages(userAccessToken: string): Promise<FacebookPage[]> {
  const url = new URL(`${META_GRAPH_URL}/me/accounts`);
  url.searchParams.set('access_token', userAccessToken);
  url.searchParams.set('fields', 'id,name,category,picture,access_token');
  url.searchParams.set('limit', '100');

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get user pages: ${err}`);
  }

  const data = await res.json();
  return data.data || [];
}

export async function subscribePageToWebhook(pageId: string, pageAccessToken: string): Promise<boolean> {
  const url = new URL(`${META_GRAPH_URL}/${pageId}/subscribed_apps`);
  url.searchParams.set('access_token', pageAccessToken);
  url.searchParams.set('subscribed_fields', 'messages,messaging_postbacks,message_deliveries');

  const res = await fetch(url.toString(), { method: 'POST' });
  if (!res.ok) {
    const err = await res.text();
    console.error('Failed to subscribe page to webhook:', err);
    return false;
  }
  return true;
}

export async function getInstagramBusinessAccount(
  pageId: string,
  pageAccessToken: string
): Promise<InstagramBusinessAccount | null> {
  const url = new URL(`${META_GRAPH_URL}/${pageId}`);
  url.searchParams.set('access_token', pageAccessToken);
  url.searchParams.set('fields', 'instagram_business_account{id,ig_id,username,name,profile_picture_url}');

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = await res.json();
  return data.instagram_business_account || null;
}

export async function getMessengerUserProfile(
  senderId: string,
  pageAccessToken: string
): Promise<{ name: string; picture_url: string } | null> {
  try {
    const url = new URL(`${META_GRAPH_URL}/${senderId}`);
    url.searchParams.set('access_token', pageAccessToken);
    url.searchParams.set('fields', 'name,picture.type(large)');
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.name || senderId,
      picture_url: data.picture?.data?.url || '',
    };
  } catch {
    return null;
  }
}

export async function getInstagramUserProfile(
  senderId: string,
  igAccessToken: string
): Promise<{ name: string; username: string; profile_pic_url: string } | null> {
  try {
    const url = new URL(`${META_GRAPH_URL}/${senderId}`);
    url.searchParams.set('access_token', igAccessToken);
    url.searchParams.set('fields', 'name,username,profile_pic');
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.name || senderId,
      username: data.username || '',
      profile_pic_url: data.profile_pic || '',
    };
  } catch {
    return null;
  }
}

export async function sendMessage(
  recipientId: string,
  messageText: string,
  pageAccessToken: string,
  platform: 'messenger' | 'instagram' = 'messenger'
): Promise<boolean> {
  const apiVersion = platform === 'instagram' ? 'v19.0' : 'v19.0';
  const baseUrl = platform === 'instagram'
    ? `https://graph.facebook.com/${apiVersion}/me/messages`
    : `${META_GRAPH_URL}/me/messages`;

  const url = new URL(baseUrl);
  url.searchParams.set('access_token', pageAccessToken);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: 'RESPONSE',
      message: { text: messageText },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Failed to send message:', err);
    return false;
  }
  return true;
}

export async function sendSenderAction(
  recipientId: string,
  pageAccessToken: string,
  action: 'mark_seen' | 'typing_on' | 'typing_off',
  platform: 'messenger' | 'instagram' = 'messenger'
): Promise<boolean> {
  try {
    const url = new URL(`${META_GRAPH_URL}/me/messages`);
    url.searchParams.set('access_token', pageAccessToken);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: action,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function markWhatsAppMessageRead(
  phoneNumberId: string,
  messageId: string,
  accessToken: string
): Promise<boolean> {
  try {
    const url = new URL(`${META_GRAPH_URL}/${phoneNumberId}/messages`);
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendInstagramMessage(
  igAccountId: string,
  recipientId: string,
  messageText: string,
  igAccessToken: string
): Promise<boolean> {
  const url = new URL(`${META_GRAPH_URL}/${igAccountId}/messages`);
  url.searchParams.set('access_token', igAccessToken);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: messageText },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Failed to send Instagram message:', err);
    return false;
  }
  return true;
}

interface BusinessNode {
  id: string;
  name: string;
}

export async function getUserBusinesses(userAccessToken: string): Promise<BusinessNode[]> {
  const url = new URL(`${META_GRAPH_URL}/me/business_users`);
  url.searchParams.set('access_token', userAccessToken);
  url.searchParams.set('fields', 'business{id,name}');
  url.searchParams.set('limit', '100');

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json();
  return (data.data || []).map((bu: any) => bu.business).filter(Boolean);
}

interface WABAInfo {
  id: string;
  name: string;
}

export async function getOwnedWhatsAppBusinessAccounts(
  businessId: string,
  accessToken: string
): Promise<WABAInfo[]> {
  const url = new URL(`${META_GRAPH_URL}/${businessId}/owned_whatsapp_business_accounts`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('fields', 'id,name');
  url.searchParams.set('limit', '100');

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json();
  return data.data || [];
}

interface WAPhoneNumberInfo {
  id: string;
  display_phone_number: string;
  verified_name: string;
}

export async function getWAPhoneNumbers(
  wabaId: string,
  accessToken: string
): Promise<WAPhoneNumberInfo[]> {
  const url = new URL(`${META_GRAPH_URL}/${wabaId}/phone_numbers`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('fields', 'id,display_phone_number,verified_name');
  url.searchParams.set('limit', '100');

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json();
  return data.data || [];
}

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  recipientPhone: string,
  messageText: string,
  accessToken: string
): Promise<boolean> {
  const url = new URL(`${META_GRAPH_URL}/${phoneNumberId}/messages`);
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'text',
      text: { body: messageText },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Failed to send WhatsApp message:', err);
    return false;
  }
  return true;
}
