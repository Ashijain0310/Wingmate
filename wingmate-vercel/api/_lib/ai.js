// api/_lib/ai.js
const Anthropic = require('@anthropic-ai/sdk');

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const MODEL = 'claude-sonnet-4-20250514';

async function rephraseSituation(rawText) {
  if (!rawText || rawText.trim().length < 10) return null;
  const res = await getClient().messages.create({
    model: MODEL, max_tokens: 150,
    messages: [{ role: 'user', content: `A person is trying to describe a confusing interpersonal situation. Help them express it more clearly in 1-2 sentences. Keep it first-person, no drama — just clear.\n\nDraft: "${rawText}"\n\nRephrased (just the sentence):` }],
  });
  return res.content[0].text.trim();
}

async function suggestRephrases(draft, context) {
  const ctx = context ? `Recent conversation:\n${context}\n\n` : '';
  const res = await getClient().messages.create({
    model: MODEL, max_tokens: 300,
    system: 'Help people express themselves clearly in emotional conversations. Return valid JSON only.',
    messages: [{ role: 'user', content: `${ctx}Draft: "${draft}"\n\nReturn 3 rephrases as JSON:\n{"gentle":"...","direct":"...","contextual":"..."}` }],
  });
  try {
    return JSON.parse(res.content[0].text.trim());
  } catch { return null; }
}

async function generateChatInsight(messages) {
  if (!messages || messages.length < 4) return null;
  const transcript = messages.slice(-10)
    .map(m => `${m.sender_role === 'seeker' ? 'Seeker' : 'Wingmate'}: ${m.content}`)
    .join('\n');
  const res = await getClient().messages.create({
    model: MODEL, max_tokens: 80,
    messages: [{ role: 'user', content: `You're observing a conversation. Write ONE brief supportive observation (max 15 words). Focus on emotional patterns. No advice, no preamble.\n\n${transcript}` }],
  });
  return res.content[0].text.trim();
}

async function generateSessionInsights(messages, situationText) {
  if (!messages || messages.length < 3) return [];
  const transcript = messages.map(m => `${m.sender_role === 'seeker' ? 'Seeker' : 'Wingmate'}: ${m.content}`).join('\n');
  const res = await getClient().messages.create({
    model: MODEL, max_tokens: 1000,
    system: 'Generate emotional clarity insights. Return valid JSON array only — no markdown.',
    messages: [{ role: 'user', content: `Situation: "${situationText || 'Not provided'}"\n\nConversation:\n${transcript}\n\nGenerate 2-3 insights as JSON array:\n[{"type":"clarity|pattern|action","title":"Short title","body":"2-3 sentence insight","key_moments":["obs1","obs2"],"takeaways":["suggestion1","suggestion2"]}]` }],
  });
  try {
    const text = res.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(text);
  } catch { return []; }
}

async function selectBestMatch(situationText, candidates) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  const list = candidates.map((c, i) => `${i+1}. ${c.alias} — tags: [${(c.tags||[]).join(', ')}], rating: ${c.rating}`).join('\n');
  const res = await getClient().messages.create({
    model: MODEL, max_tokens: 10,
    system: 'Return only a single number. No other text.',
    messages: [{ role: 'user', content: `Situation: "${situationText}"\n\nCandidates:\n${list}\n\nBest match (1-${candidates.length})?` }],
  });
  const idx = parseInt(res.content[0].text.trim(), 10);
  return (idx >= 1 && idx <= candidates.length) ? candidates[idx - 1] : candidates[0];
}

module.exports = { rephraseSituation, suggestRephrases, generateChatInsight, generateSessionInsights, selectBestMatch };
