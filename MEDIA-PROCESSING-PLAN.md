# Media Processing Plan

## 1. Architecture Overview

```
Platform Webhook (Discord / Telegram / Messenger / Instagram / WhatsApp)
     │
     ├── Detects media type (image, voice, video, document)
     │
     ├── Calls platform-specific processor (NEW)
     │     extracts attachment URL/file_id → downloads Buffer → returns MediaBundle
     │
     ├── If voice → Whisper STT → transcription text (NEW)
     │
     └── Calls handleAIResponse(..., mediaBundle) (MODIFIED)
               │
               v
          handler.ts
               │
               ├── Builds content array (text + images as multi-part)
               │     [{type:"text", text:msg}, {type:"image_url", image_url:{url:"data:..."}}]
               │
               ├── Router decides model (NEW):
               │     has image → Vision Model (GPT-4o-mini / Gemini Flash)
               │     has voice → transcribed text → Text Model (DeepSeek V4 Flash)
               │     text only → Text Model (configured default)
               │
               ├── Reasoning override via hasMedia (existing, preserved)
               │
               └── createCompletion(messages, resolved model+provider)
```

## 2. Files to Create (8 new files)

### `src/lib/media/types.ts`
Core type definitions:
```typescript
interface ImageData {
  data: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
}

interface VoiceData {
  data: Buffer;
  mimeType: string;
  durationSeconds?: number;
}

interface MediaBundle {
  images: ImageData[];
  voice: VoiceData | null;
  transcript?: string;          // populated after Whisper STT
  fallbackText?: string;        // used if processing fails
}

interface MediaRouterConfig {
  provider: 'openrouter' | 'openai' | 'google-gemini' | string;
  model: string;
  baseUrl: string | null;
  apiKey: string;
}
```

### `src/lib/media/download.ts`
Generic HTTP download utility:
```typescript
export async function downloadBuffer(url: string, auth?: string): Promise<Buffer>
// Simple fetch → arrayBuffer → Buffer
// auth header for Meta/Telegram APIs
// 10s timeout, error handling
// NO storage — returns Buffer in-memory
```

### `src/lib/media/transcribe.ts`
Voice → text via Whisper STT:
```typescript
export async function transcribeVoice(
  audioBuffer: Buffer,
  mimeType: string,
  config: { provider: string; model: string; apiKey: string; baseUrl?: string }
): Promise<string | null>
// OpenRouter: POST /api/v1/audio/transcriptions (multipart)
// Direct OpenAI: POST https://api.openai.com/v1/audio/transcriptions
// Returns transcribed text or null on failure
// If null, uses fallbackText: "[User sent a voice message]"
```

### `src/lib/media/processors/discord.ts`
```typescript
export async function processDiscordMedia(
  interaction: DiscordInteraction
): Promise<MediaBundle | null>
// Inspects interaction.data.resolved.attachments
// Classifies by content_type:
//   image/* → ImageData
//   audio/* → VoiceData
// Downloads via downloadBuffer(attachment.url) — Discord CDN, free
// Returns null if no relevant attachments
```

### `src/lib/media/processors/telegram.ts`
```typescript
export async function processTelegramMedia(
  msg: TelegramMessage,
  botToken: string
): Promise<MediaBundle | null>
// Checks msg.photo (largest), msg.voice, msg.audio, msg.video, msg.document
// Calls Telegram getFile API: GET /bot{token}/getFile?file_id={id}
// Gets file_path, then downloads: GET /bot{token}/{file_path}
// Voice messages: ogg/opus, Audio: mp3/m4a
// Images: jpg/png from photo array or document
```

### `src/lib/media/processors/whatsapp.ts`
```typescript
export async function processWhatsAppMedia(
  msg: WhatsAppMessage,
  accessToken: string
): Promise<MediaBundle | null>
// Uses msg.image.id, msg.audio.id, msg.voice.id, msg.video.id, msg.document.id
// Calls Meta Cloud API: GET https://graph.facebook.com/v20.0/{mediaId}
// Response has url + mime_type
// Downloads with Authorization: Bearer {accessToken} header
```

### `src/lib/media/processors/messenger.ts`
```typescript
export async function processMessengerMedia(
  attachments: MessengerAttachment[],
  pageAccessToken: string
): Promise<MediaBundle | null>
// For each attachment with type 'image' or 'audio'
// Uses attachment.payload.url (direct URL)
// Downloads via downloadBuffer(url)
// Also handles Instagram (same format)
```

### `src/lib/ai/router.ts`
Model routing logic:
```typescript
export function resolveMediaModel(
  hasImage: boolean,
  textProviderConfig: { provider: string; model: string },
  mediaSettings: MediaSettings
): MediaRouterConfig
// If hasImage → use media_image_provider + media_image_model
// If voice only → use text provider (already transcribed)
// If text only → use text provider
// Returns { provider, model, baseUrl, apiKey }
// baseUrl + apiKey are resolved from the matching ai_providers row
```

## 3. Files to Modify (8 existing files)

### `src/lib/ai/handler.ts` — Major changes
- **Signature**: Replace `hasMedia: boolean` with `mediaBundle?: MediaBundle`
- **Build content array**: When images present, create `[{type:"text", text}, {type:"image_url", image_url:{url:"data:..."}}]` instead of plain string
- **Voice transcription**: Call `transcribeVoice()` before building messages, prepend `"[User sent a voice message: {transcription}]"` to text
- **Model routing**: Call `resolveMediaModel()` to determine which model+provider to use for this request
- **Pass resolved config**: Send the resolved provider+model to `createCompletion()` instead of the default

### `src/lib/ai/openrouter.ts` — Content array support
- **ChatMessage.content**: Change from `string | null` to `string | ContentPart[] | null`
- **ContentPart type**: `{ type: "text", text: string } | { type: "image_url", image_url: { url: string } }`
- **Serialization**: Already uses JSON.stringify, so arrays are handled naturally
- **For direct OpenAI**: Same format (OpenAI-compatible API)
- **For direct Gemini**: Different format — needs a separate adapter (later phase)

### `src/lib/discord/webhook.ts` — Media processing
- After line 265 (`discordHasMedia`), call `processDiscordMedia(interaction)` → get `MediaBundle`
- Pass `mediaBundle` instead of `discordHasMedia` to `handleAIResponse()`

### `src/lib/telegram/webhook.ts` — Remove no-text gate + media processing
- **REMOVE** early return `if (!update.message?.text)` — allows voice-only messages through
- After `hasMedia` detection, call `processTelegramMedia(msg, botToken)` → get `MediaBundle`
- Pass `mediaBundle` instead of `hasMedia` to `handleAIResponse()`
- If no text AND no media → skip (new combined check)

### `src/app/api/webhooks/meta/route.ts` — Remove no-text gate for Messenger/IG
- **REMOVE** `if (!event.message?.text)` for Messenger/IG — allows media-only through
- For WhatsApp: already passes `[attachment]` fallback text, just add media ID extraction
- Pass media IDs/info alongside `hasMedia` in the webhook payload

### `src/lib/meta/webhook.ts` — Accept and process media
- **WebhookPayload**: Add `mediaIds?: { imageId?: string, audioId?: string, attachmentUrl?: string }`
- Call platform-specific processor based on `payload.platform`
- Pass resulting `MediaBundle` to `handleAIResponse()`

### `src/app/api/admin/owner/settings/route.ts` — Media settings
- **GET**: Add media settings keys to response object
- **PUT**: Accept and save media settings (same pattern as AI_NUMERIC_KEYS and AI_KEYS)

### `src/app/admin/providers/page.tsx` — New Media Processing UI section
- Add new card after "AI Defaults" section
- Follows exact same glassmorphism pattern as existing cards

## 4. Admin Settings (platform_settings keys)

All stored in `platform_settings` table, same pattern as existing settings:

| Key | Type | Default | Admin UI Label |
|---|---|---|---|
| `media_image_enabled` | boolean | `true` | Enable Image Processing |
| `media_image_provider_type` | string | `"openrouter"` | Image Provider |
| `media_image_provider_id` | string | `""` | Image Provider (select from list) |
| `media_image_model` | string | `"openai/gpt-4o-mini"` | Vision Model |
| `media_image_max_size` | integer | `2048` | Max Image Dimension (px) |
| `media_image_max_count` | integer | `3` | Max Images Per Message |
| `media_image_fallback_text` | string | `"[User sent an image]"` | Fallback Text (if processing fails) |
| `media_voice_enabled` | boolean | `true` | Enable Voice Transcription |
| `media_voice_provider_type` | string | `"openrouter"` | STT Provider |
| `media_voice_provider_id` | string | `""` | STT Provider (select from list) |
| `media_voice_model` | string | `"openai/whisper-large-v3-turbo"` | STT Model |
| `media_voice_max_seconds` | integer | `120` | Max Audio Length (seconds) |
| `media_voice_fallback_text` | string | `"[User sent a voice message]"` | Fallback Text (if transcription fails) |

**Design rationale for `provider_id`**: Instead of just storing a provider type string, we store the ID of a row in `ai_providers` table. This way:
- The admin selects from a dropdown of existing providers (OpenRouter, OpenAI, Google Gemini, etc.)
- The API key, base URL, and all credentials come from that existing provider config
- No need to manage separate credentials for media processing
- The `provider_type` field on the provider row determines how the API call is formatted

## 5. Admin Panel UI Design

New "Media Processing" card in `/admin/providers`, placed after "AI Defaults":

```
┌──────────────────────────────────────────────────────────────┐
│  🎯  Media Processing                    [💾 Save Changes]  │
│  Configure how images and voice messages are processed       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─── Image Processing ─────────────────────────────────┐   │
│  │                                                       │   │
│  │  [✅] Enable image processing                         │   │
│  │                                                       │   │
│  │  Vision Provider    [ Select Provider ▾ ]             │   │
│  │  (dropdown of all ai_providers rows)                  │   │
│  │                                                       │   │
│  │  Vision Model       [ openai/gpt-4o-mini        ]     │   │
│  │                      (free text, datalist)            │   │
│  │                                                       │   │
│  │  Max Image Size     [ 2048     ] px (resize before    │   │
│  │                      sending to AI to save tokens)    │   │
│  │                                                       │   │
│  │  Max Images/Message [ 3        ]                      │   │
│  │                                                       │   │
│  │  Fallback Text      [ [User sent an image]      ]     │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─── Voice Transcription ──────────────────────────────┐   │
│  │                                                       │   │
│  │  [✅] Enable voice transcription                      │   │
│  │                                                       │   │
│  │  STT Provider        [ Select Provider ▾ ]            │   │
│  │  (dropdown of all ai_providers rows)                  │   │
│  │                                                       │   │
│  │  STT Model           [ openai/whisper-large-v3-turbo  ]│   │
│  │                      (free text, datalist)            │   │
│  │                                                       │   │
│  │  Max Audio Length    [ 120        ] seconds           │   │
│  │                                                       │   │
│  │  Fallback Text       [ [User sent a voice message]  ] │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**UI integration pattern**:
- Fetched via existing `GET /api/admin/owner/settings` (returns all platform_settings)
- Saved via existing `PUT /api/admin/owner/settings` (sends JSON body)
- Reuses the same glassmorphism styling as other cards
- Provider dropdown populated from existing `providers` state (already loaded)

## 6. Multi-Provider Support

| Media Task | OpenRouter | Direct OpenAI | Direct Google Gemini | Direct DeepSeek |
|---|---|---|---|---|
| **Image → AI** | ✅ `content: [{type:"image_url"}]` native support | ✅ Same format (compatible API) | ✅ Different format (content.parts with inline_data) | ❌ No vision capability (fallback to text) |
| **Voice → Text** | ✅ `/api/v1/audio/transcriptions` | ✅ `/v1/audio/transcriptions` | ❌ Uses Google Cloud STT (different API) | ❌ No STT |
| **Credentials** | Stored in ai_providers or platform_settings (openrouter_key) | Stored in ai_providers (api_key) | Stored in ai_providers (api_key) | Stored in ai_providers |

**Routing logic in `router.ts`**:
1. Check `provider_type` of the selected provider row
2. If `openrouter` → use OpenRouter API format
3. If `generic` with base_url containing `openai.com` → use OpenAI-compatible format
4. If `generic` with base_url containing `googleapis.com` → use Gemini format (later phase)
5. Fallback: OpenAI-compatible format (most widely supported)

## 7. Image Resize Strategy

Before sending to AI:
1. Decode image Buffer to get dimensions (lightweight, no external lib needed — can use `probe-image-size` or manual JPEG/PNG header parsing)
2. If longest edge > `media_image_max_size`, resize proportionally
3. Re-encode as JPEG (quality 85) or PNG (if transparency needed)
4. Convert to base64 data URI

**Admin control**: `media_image_max_size` (default 2048px). Range: 512-4096.
**Token impact**: A 2048×2048 image costs ~85 tokens in GPT-4o-mini. A 512×512 image costs ~5 tokens. Resizing from 2048 to 1024 reduces image token cost by ~75%.

## 8. Voice Processing Details (Per Platform)

| Platform | Voice Detection | Audio Format | Download Method | Additional Gate to Remove |
|---|---|---|---|---|
| **Discord** | `attachment.content_type.startsWith("audio/")` | Any (mp3, ogg, wav, etc.) | Discord CDN (`attachment.url`) — free | None (already processes media-only) |
| **Telegram** | `msg.voice` (ogg/opus) or `msg.audio` (mp3/m4a) or `msg.video_note` (mp4) | ogg/opus, mp3, m4a, mp4 | `getFile` API → Telegram file CDN — free | **Must remove**: `if (!update.message?.text) continue` gate |
| **WhatsApp** | `msg.audio` or `msg.voice` | ogg (voice), mp3/m4a (audio) | `GET /{{media-id}}` via Meta Cloud API — free | None (already sends `[attachment]` fallback) |
| **Messenger** | `attachment.type === "audio"` | Various | `attachment.payload.url` — free | **Must remove**: `if (!event.message?.text) continue` gate |
| **Instagram** | Same as Messenger | Same | Same | Same gate removal needed |

**Voice processing flow**:
```
Platform detects audio attachment
  → Extract file URL/ID
  → downloadBuffer(url) → Buffer
  → transcribeVoice(Buffer, mimeType, config)
      → If OpenRouter: POST /api/v1/audio/transcriptions (multipart form, model + file)
      → If OpenAI: POST https://api.openai.com/v1/audio/transcriptions
      → Returns transcribed text string
  → Prepend to user message: "[User sent a voice message: {transcript}]"
  → AI responds to the transcribed content as if it were a text message
```

## 9. Cost Analysis

| Operation | Cost | Per-unit rate |
|---|---|---|
| **Image download** (Discord CDN, Telegram CDN, Meta API) | **$0** | Free |
| **Image resize** (in-memory, zero server cost) | **$0** | Free |
| **Image → AI** (GPT-4o-mini, 2048px image) | ~$0.0007 | ~85 tokens per image, $0.15/1M tokens input |
| **Image → AI** (Gemini 1.5 Flash, 2048px image) | ~$0.0004 | ~$0.075/1M tokens input (half of GPT-4o-mini) |
| **Voice download** (all platforms) | **$0** | Free |
| **Voice → Whisper STT** (Whisper Large V3 Turbo) | ~$0.003 | $0.006/min, typical 30s voice message |
| **Voice transcription → AI** | ~$0.00001 | ~50 tokens for transcript, negligible |

**Real-world monthly cost per customer**:
- 10 images + 5 voice messages = ~$0.02-0.05 extra
- With 500 text messages = ~$0.06-0.10 total
- **At $10/month starter plan**: < 1% of revenue

## 10. Implementation Phases

### Phase 1: Foundation + Discord Images (estimated: 2-3 days)
1. Create `src/lib/media/types.ts`
2. Create `src/lib/media/download.ts`
3. Create `src/lib/media/processors/discord.ts`
4. Modify `src/lib/ai/handler.ts` (accept MediaBundle, build content arrays)
5. Modify `src/lib/ai/openrouter.ts` (support content arrays)
6. Modify `src/lib/discord/webhook.ts` (call processor, pass MediaBundle)
7. Create `src/lib/ai/router.ts` (basic version)
8. Add media settings to admin route + providers page UI

### Phase 2: Telegram + WhatsApp Images (estimated: 1-2 days)
1. Create `src/lib/media/processors/telegram.ts`
2. Create `src/lib/media/processors/whatsapp.ts`
3. Modify `src/lib/telegram/webhook.ts` (remove no-text gate, call processor)
4. Modify `src/lib/meta/webhook.ts` + route (extract media IDs, call processor)

### Phase 3: Voice Transcription (estimated: 2-3 days)
1. Create `src/lib/media/transcribe.ts`
2. Create `src/lib/media/processors/messenger.ts` (for Messenger audio)
3. Modify `handler.ts` (voice transcription step before message building)
4. Modify all platform webhooks to pass voice data
5. Remove remaining no-text gates (Messenger/IG)

### Phase 4: Admin UI Polish + Gemini Support (estimated: 1-2 days)
1. Admin panel: Media Processing card with all fields
2. Provider dropdown selector
3. Test media processing from admin panel
4. Gemini format adapter (for direct Google AI API)

## 11. Rollout & Safety

- **Feature flag**: All behind `media_image_enabled` / `media_voice_enabled` — disabled by default initially
- **Fallback**: If media processing fails at any point, the `fallback_text` is used instead (e.g., `"[User sent an image]"`)
- **Graceful degradation**: If the selected vision model doesn't support images, the text-only fallback is used
- **No breaking changes**: All existing `hasMedia: boolean` callers are updated to pass `mediaBundle` instead — internal conversion in handler.ts preserves the reasoning override logic
