// server/src/services/ai.js
// All Claude API calls live here

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-20250514';

/**
 * Help a seeker rephrase their situation text more clearly.
 * Called as they type in the onboarding "situation" field.
 */
async function rephrasesSituation(rawText) {
  if (!rawText || rawText.length < 10) return null;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `A person is trying to describe a confusing interpersonal situation to get outside perspective. 
      Help them express it more clearly and honestly in 1-2 sentences. Keep it in first person. 
      Don't add drama — just make it clear.
      
      Their draft: "${rawText}"
      
      Rephrased (just the sentence, no preamble):`
    }]
  });

  return response.content[0].text.trim();
}

/**
 * During chat — suggest rephrases for the user's draft message.
 * Returns { gentle, direct, contextual }
 */
async function suggestRephrases(draftMessage, conversationContext) {
  if (!draftMessage) return null;

  const context = conversationContext
    ? `Recent conversation:\n${conversationContext}\n\n`
    : '';

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: 'You help people express themselves more clearly in emotional conversations. Return valid JSON only.',
    messages: [{
      role: 'user',
      content: `${context}Draft message: "${draftMessage}"
      
      Provide 3 rephrases. Return JSON:
      {"gentle":"...","direct":"...","contextual":"..."}`
    }]
  });

  try {
    const text = response.content[0].text.trim();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Generate a real-time AI insight note during a chat session.
 * Returns a short observation string.
 */
async function generateChatInsight(messages) {
  if (!messages || messages.length < 4) return null;

  const transcript = messages
    .slice(-10) // last 10 messages
    .map(m => `${m.sender_role === 'seeker' ? 'Seeker' : 'Wingmate'}: ${m.content}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 80,
    messages: [{
      role: 'user',
      content: `You're observing a conversation between someone seeking perspective and their Wingmate.
      
      Conversation so far:
      ${transcript}
      
      Write ONE brief, supportive AI observation (max 15 words). 
      Focus on emotional patterns, tone shifts, or helpful observations.
      Do not give advice — observe only. No preamble.`
    }]
  });

  return response.content[0].text.trim();
}

/**
 * Generate full insights report after session ends.
 * Returns structured insight objects.
 */
async function generateSessionInsights(messages, situationText) {
  if (!messages || messages.length < 3) return [];

  const transcript = messages
    .map(m => `${m.sender_role === 'seeker' ? 'Seeker' : 'Wingmate'}: ${m.content}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: 'You are an empathetic AI that helps people gain clarity after emotional conversations. Return valid JSON only — no markdown, no preamble.',
    messages: [{
      role: 'user',
      content: `Original situation: "${situationText || 'Not provided'}"
      
      Full conversation:
      ${transcript}
      
      Generate 2-3 insights. Return JSON array:
      [
        {
          "type": "clarity|pattern|action",
          "title": "Short title (max 8 words)",
          "body": "2-3 sentence insight paragraph",
          "key_moments": ["observation 1", "observation 2", "observation 3"],
          "takeaways": ["actionable suggestion 1", "actionable suggestion 2"]
        }
      ]`
    }]
  });

  try {
    const text = response.content[0].text.trim()
      .replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse insights:', err.message);
    return [];
  }
}

/**
 * Select best Wingmate candidate from a list using AI reasoning.
 * Used by the matching engine when multiple good candidates exist.
 */
async function selectBestMatch(situationText, candidates) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const candidateList = candidates.map((c, i) =>
    `${i + 1}. ${c.alias} — tags: [${(c.tags || []).join(', ')}], rating: ${c.rating}, sessions: ${c.session_count}`
  ).join('\n');

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 50,
    system: 'Return only a single number — the index (1-based) of the best match. No other text.',
    messages: [{
      role: 'user',
      content: `Situation: "${situationText}"
      
      Candidates:
      ${candidateList}
      
      Which candidate (1-${candidates.length}) is best suited to help with this specific situation?`
    }]
  });

  const idx = parseInt(response.content[0].text.trim(), 10);
  if (idx >= 1 && idx <= candidates.length) return candidates[idx - 1];
  return candidates[0];
}

module.exports = {
  rephrasesSituation,
  suggestRephrases,
  generateChatInsight,
  generateSessionInsights,
  selectBestMatch,
};
