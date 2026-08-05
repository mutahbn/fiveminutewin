// The Five-Minute Win — Worker API v0.1
// Endpoints: /api/mission/today, /api/mission/:id, /api/challenge/:id,
//            /api/generate (capped), /api/waitlist, /api/event
import { Hono } from 'hono';

const app = new Hono();

// Canonical host: redirect the variant domains (and www) to fiveminutewin.com.
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  const h = url.hostname;
  if (h === '5minutewin.com' || h === 'thefiveminutewin.com' || h === 'www.5minutewin.com' || h === 'www.thefiveminutewin.com' || h === 'www.fiveminutewin.com') {
    url.hostname = 'fiveminutewin.com';
    return c.redirect(url.toString(), 301);
  }
  await next();
});

/* ---------- helpers ---------- */

async function visitorKey(c) {
  // Privacy: we never store raw IPs — only a salted hash that resets meaning daily.
  const ip = c.req.header('cf-connecting-ip') || 'local';
  const salt = c.env.VISITOR_SALT || 'dev-salt';
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const today = () => new Date().toISOString().slice(0, 10);

// Engine chain: Anthropic (premium, if key configured) → Workers AI (free tier) → null.
async function generateText(env, system, userMessage) {
  return generateChat(env, system, [{ role: 'user', content: userMessage }]);
}

async function generateChat(env, system, messages) {
  if (env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: env.GEN_MODEL || 'claude-haiku-4-5',
          max_tokens: 700,
          system,
          messages,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content?.map((b) => b.text || '').join('') || '';
        if (text) return text;
      }
    } catch { /* fall through to Workers AI */ }
  }
  if (env.AI) {
    try {
      const out = await env.AI.run(env.WORKERS_AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [{ role: 'system', content: system }].concat(messages),
        max_tokens: 700,
      });
      if (out?.response) return out.response;
    } catch { /* no engine available */ }
  }
  return null;
}

async function missionPayload(db, id) {
  const mission = await db.prepare('SELECT * FROM missions WHERE id = ?').bind(id).first();
  if (!mission) return null;
  const { results: personas } = await db
    .prepare('SELECT persona, story_title, story, prompt, why FROM mission_content WHERE mission_id = ?')
    .bind(id).all();
  return { ...mission, personas };
}

async function logEvent(db, name, meta) {
  try {
    await db.prepare('INSERT INTO events (name, meta) VALUES (?, ?)').bind(name, meta ?? null).run();
  } catch { /* analytics must never break the product */ }
}

/* ---------- missions ---------- */

app.get('/api/mission/today', async (c) => {
  // Launch logic: rotate through available missions by date until daily publishing starts.
  const { results } = await c.env.DB.prepare('SELECT id FROM missions ORDER BY id').all();
  const ids = results.map((r) => r.id);
  const epochDay = Math.floor(Date.now() / 86400000);
  const id = ids[epochDay % ids.length];
  const payload = await missionPayload(c.env.DB, id);
  await logEvent(c.env.DB, 'mission_view', String(id));
  return c.json(payload);
});

app.get('/api/mission/:id', async (c) => {
  const payload = await missionPayload(c.env.DB, Number(c.req.param('id')));
  return payload ? c.json(payload) : c.json({ error: 'not found' }, 404);
});

app.get('/api/challenge/:id', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT round, task, prompt_a, prompt_b, winner, verdict FROM challenge_rounds WHERE mission_id = ? ORDER BY round')
    .bind(Number(c.req.param('id'))).all();
  return results.length ? c.json({ rounds: results }) : c.json({ error: 'not found' }, 404);
});

/* ---------- in-page generation (capped free trial) ---------- */

app.post('/api/generate', async (c) => {
  const db = c.env.DB;
  const cap = Number(c.env.FREE_GEN_CAP || 10);
  const key = await visitorKey(c);
  const day = today();

  const row = await db.prepare('SELECT count FROM gen_usage WHERE visitor_key = ? AND day = ?').bind(key, day).first();
  const used = row?.count ?? 0;
  if (used >= cap) {
    return c.json({ error: 'cap', message: `You've used today's ${cap} free drafts. Members generate without limits — or copy the prompt into any AI chat, free forever.` }, 429);
  }

  const { missionId, persona, answers, refine, draft } = await c.req.json().catch(() => ({}));
  if (!missionId || !persona) return c.json({ error: 'bad_request' }, 400);
  const content = await db
    .prepare('SELECT prompt FROM mission_content WHERE mission_id = ? AND persona = ?')
    .bind(missionId, persona).first();
  if (!content) return c.json({ error: 'not found' }, 404);

  // Fill user's bracket answers into the prompt template.
  let filled = content.prompt;
  for (const [placeholder, value] of Object.entries(answers || {})) {
    filled = filled.split(`[${placeholder}]`).join(String(value).slice(0, 300));
  }

  const SYSTEM =
    'You help non-technical people finish small real-life tasks. Reply with ONLY the finished draft/script/plan the user asked for — warm, plain language, no preamble, no explanations, no markdown headers. If key details are missing, make reasonable neutral choices and mark them [like this] so the user can adjust.';

  // Refine mode: revise the previous draft instead of starting over.
  const userMessage = refine && draft
    ? `Here is a draft that was produced for this request:\n---\n${String(draft).slice(0, 3000)}\n---\nOriginal request: ${filled}\n\nRevise the draft to be ${String(refine).slice(0, 100)}. Reply with only the revised version.`
    : filled;

  const text = await generateText(c.env, SYSTEM, userMessage);
  if (text === null) return c.json({ error: 'llm_error', message: 'Generation is having a moment — the copy-paste prompt below works in any AI chat, free.' }, 502);

  await db
    .prepare('INSERT INTO gen_usage (visitor_key, day, count) VALUES (?, ?, 1) ON CONFLICT(visitor_key, day) DO UPDATE SET count = count + 1')
    .bind(key, day).run();
  await logEvent(db, 'generate', `${missionId}:${persona}`);

  return c.json({ draft: text, remaining: cap - used - 1 });
});

/* ---------- guided helper: bring your own problem ---------- */

const HELPER_SYSTEM = `You are the helper on The Five-Minute Win, a site that helps non-technical people finish small real-life tasks with AI: difficult emails and messages, phone scripts, plans (meals, errands, events), decoding confusing letters and documents, practicing conversations.

Your method:
1. If the user's request is missing details you genuinely need, ask ONE short, friendly clarifying question at a time — at most 3 questions in the whole conversation. Never ask for details you don't need.
2. Then deliver the finished result: the draft, script, or plan itself — warm, plain language, no jargon, no preamble, no markdown headers.
3. Immediately after delivering the final result, add a line containing exactly ---LEARN--- and then a single reusable prompt the user could paste into any AI chat next time to get this kind of result in one go. Use [brackets] for the parts that would change. Nothing after the reusable prompt.

Rules:
- Stay in scope: small personal real-life tasks only. If asked for essays, homework, code, professional medical/legal/financial advice, or anything harmful, decline in one kind sentence and suggest something you CAN help with. For medical/legal/financial documents you may explain in plain language and help draft questions for the professional, but say clearly that the professional's advice is what counts.
- Privacy: never ask for account numbers, ID numbers, addresses, or passwords. If the user pastes any, tell them to remove such details — they are never needed for a draft.
- Keep every reply short enough to read in under a minute.`;

app.post('/api/helper', async (c) => {
  const db = c.env.DB;
  const cap = Number(c.env.FREE_GEN_CAP || 10);
  const key = await visitorKey(c);
  const day = today();

  const row = await db.prepare('SELECT count FROM gen_usage WHERE visitor_key = ? AND day = ?').bind(key, day).first();
  const used = row?.count ?? 0;
  if (used >= cap) {
    return c.json({ error: 'cap', message: `You've used today's ${cap} free AI turns. They refresh tomorrow — or copy any prompt from a mission into a free AI chat.` }, 429);
  }

  const { messages, persona } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(messages) || messages.length === 0) return c.json({ error: 'bad_request' }, 400);
  if (messages.length > 12) return c.json({ error: 'too_long', message: 'This conversation is getting long — start a fresh one and include what you learned.' }, 400);

  const clean = messages.slice(-12).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 2000),
  }));

  let system = HELPER_SYSTEM;
  if (persona) system += `\n\nThe user has described themselves as: ${String(persona).slice(0, 30)}. Let that quietly shape tone and examples.`;

  const text = await generateChat(c.env, system, clean);
  if (text === null) return c.json({ error: 'llm_error', message: 'The helper is having a moment — try again shortly.' }, 502);

  await db
    .prepare('INSERT INTO gen_usage (visitor_key, day, count) VALUES (?, ?, 1) ON CONFLICT(visitor_key, day) DO UPDATE SET count = count + 1')
    .bind(key, day).run();
  await logEvent(db, 'helper_turn', String(clean.length));

  return c.json({ reply: text, remaining: cap - used - 1 });
});

/* ---------- waitlist ---------- */

app.post('/api/waitlist', async (c) => {
  const { email } = await c.req.json().catch(() => ({}));
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ error: 'invalid_email' }, 400);
  const db = c.env.DB;
  const existing = await db.prepare('SELECT position FROM waitlist WHERE email = ?').bind(email.toLowerCase()).first();
  if (existing) return c.json({ position: existing.position, already: true });
  const max = await db.prepare('SELECT COALESCE(MAX(position), 0) AS p FROM waitlist').first();
  const position = (max?.p ?? 0) + 1;
  await db.prepare('INSERT INTO waitlist (email, position) VALUES (?, ?)').bind(email.toLowerCase(), position).run();
  await logEvent(db, 'waitlist', null);
  return c.json({ position });
});

/* ---------- analytics ---------- */

app.post('/api/event', async (c) => {
  const { name, meta } = await c.req.json().catch(() => ({}));
  const allowed = ['visit', 'win', 'challenge_done', 'copy_prompt'];
  if (!allowed.includes(name)) return c.json({ ok: false }, 400);
  await logEvent(c.env.DB, name, meta ? String(meta).slice(0, 100) : null);
  return c.json({ ok: true });
});

/* ---------- static frontend ---------- */

app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
