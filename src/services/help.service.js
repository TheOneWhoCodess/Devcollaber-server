// Help assistant, powered by Groq (not Gemini) so it doesn't compete
// with the core AI features (Match Explainer, GitHub Summary, Project
// Idea, Match Concierge) for the same tight Gemini free-tier quota.
// Groq's API is OpenAI-compatible, so this uses the standard `openai`
// package pointed at Groq's base URL.
//
// Required env var: GROQ_API_KEY (from https://console.groq.com/keys)

const OpenAI = require('openai');

let _groq = null;
function getClient() {
    if (_groq) return _groq;
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not set');
    }
    _groq = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
    });
    return _groq;
}

const MODEL = 'llama-3.1-8b-instant';
const MAX_HISTORY_MESSAGES = 10; // cap conversation length sent per call, keeps token usage predictable

// Scopes the assistant to DevCollab itself, so it doesn't hallucinate
// answers about unrelated topics or make up features that don't exist.
// Update this if app features change.
const SYSTEM_PROMPT = `You are the Help Assistant for DevCollab, a developer matchmaking app ("Tinder for developers") where people swipe to find project collaborators.

What DevCollab does:
- Users create a profile with a role (frontend/backend/fullstack/devops/ml/mobile), skills, experience, a project idea, and GitHub URL.
- Users swipe on Discover to like/pass/superlike other developers. Mutual likes create a Match.
- On a Match, an AI-generated "why you match" explanation appears automatically.
- Users can sync their GitHub via a button on their profile — this generates an AI summary of their repos/activity, shown on their card.
- On a Match, users can also click "Generate Project Idea" for an AI-suggested project combining both people's skills.
- There's also an "Ask AI Concierge" feature on matches — an AI agent that checks chat history and GitHub activity, then decides whether to suggest an icebreaker, a project idea, or flag the match for a follow-up nudge.
- Matched users can chat in real time.
- Passed/unmatched profiles reappear in Discover after a cooldown period; mutual matches never reappear there.

Your job: answer user questions about how DevCollab works, clearly and briefly (2-4 sentences typically). If asked something unrelated to DevCollab (general coding help, other topics), politely redirect: say you can only help with questions about using DevCollab. Never make up features that aren't listed above. If you don't know something specific to their account (e.g. "why is my profile not showing"), say you can't check account-specific details and suggest they try refreshing, checking their profile completeness, or contacting support directly.`;

const fallbackReply = "Sorry, I'm having trouble responding right now — please try again in a moment.";

/**
 * chatWithHelp(history)
 * history: array of { role: 'user' | 'assistant', content: string }
 * Returns: { reply: string }
 */
const chatWithHelp = async (history = []) => {
    try {
        const client = getClient();
        const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES);

        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...trimmedHistory.map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: String(m.content || '').slice(0, 2000), // guard against absurdly long input
            })),
        ];

        const response = await client.chat.completions.create({
            model: MODEL,
            messages,
            temperature: 0.4,
            max_tokens: 400,
        });

        const reply = response.choices?.[0]?.message?.content?.trim();
        return { reply: reply || fallbackReply };
    } catch (err) {
        console.error('[help.service] chat failed:', err.message);
        return { reply: fallbackReply };
    }
};

module.exports = { chatWithHelp };