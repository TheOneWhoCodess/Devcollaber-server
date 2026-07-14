const Groq = require('groq-sdk');

// Groq's API is OpenAI-compatible — a plain API key from
// https://console.groq.com/keys, no other setup needed.
// Required env var: GROQ_API_KEY
//
// Client is created lazily (same pattern as ai.service.js's getClient())
// so a missing env var doesn't crash the server at require() time, only
// when one of these functions is actually called.
let _groq = null;
function getClient() {
    if (_groq) return _groq;
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not set');
    }
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    return _groq;
}

// llama-3.3-70b-versatile is a solid default for structured JSON tasks like
// these two — fast and cheap on Groq's inference. Override via env if you
// want to try a different model without a code change.
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 8000;

const withTimeout = (promise, ms) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Groq request timed out')), ms)
        ),
    ]);
};

// Both functions below ask for JSON via response_format + an explicit
// "return only JSON" instruction in the prompt, then parse defensively —
// Groq's JSON mode is generally reliable but still worth guarding the same
// way ai.service.js guards Gemini's output.
const callGroq = async (systemPrompt, userPrompt) => {
    const client = getClient();
    const response = await withTimeout(
        client.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.6,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        }),
        TIMEOUT_MS
    );

    const text = (response.choices?.[0]?.message?.content || '').trim();
    if (!text) {
        throw new Error('Groq returned an empty response');
    }

    try {
        return JSON.parse(text);
    } catch (err) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (innerErr) {
                console.error('Groq returned unparseable text:', text.slice(0, 200));
                throw innerErr;
            }
        }
        console.error('Groq returned non-JSON text:', text.slice(0, 200));
        throw err;
    }
};

// --- Feature: AI project description expansion ---

const expandProjectDescription = async ({ draft, title, techStack = [], rolesNeeded = [], projectType, stage }) => {
    const fallback = draft.trim();

    try {
        const systemPrompt = `You help developers write clear, appealing project listings for a
developer-collaboration platform. Rewrite the user's rough draft into a well-structured
description (2-4 short paragraphs, no headers, no markdown formatting) that explains what
the project is, what problem it solves, and what kind of help they're looking for. Keep
their original meaning and facts — never invent features, metrics, or claims they didn't
mention. Keep the result under 900 characters. Return JSON only: {"description": "..."}`;

        const userPrompt = `Project title: ${title || '(untitled)'}
Stage: ${stage || 'unspecified'}
Project type: ${projectType || 'unspecified'}
Tech stack: ${techStack.join(', ') || 'unspecified'}
Roles needed: ${rolesNeeded.join(', ') || 'unspecified'}

Rough draft from the user:
"""
${draft.trim()}
"""`;

        const result = await callGroq(systemPrompt, userPrompt);
        if (!result?.description || !result.description.trim()) {
            return { description: fallback, source: 'fallback' };
        }
        return { description: result.description.trim().slice(0, 1000), source: 'ai' };
    } catch (err) {
        console.error('Project description expansion failed:', err.message);
        return { description: fallback, source: 'fallback' };
    }
};

// --- Feature: AI applicant ranking ---

// Deterministic fallback if Groq is unavailable — simple skill-overlap
// count against the project's tech stack, so ranking still degrades
// gracefully instead of failing outright.
const fallbackRanking = ({ project, applicants }) => {
    const stackLower = new Set((project.techStack || []).map((s) => s.toLowerCase()));
    return applicants.map((a) => {
        const overlap = (a.skills || []).filter((s) => stackLower.has(s.toLowerCase())).length;
        const score = Math.min(100, overlap * 20);
        return {
            id: a.id,
            score,
            reason: overlap > 0
                ? `${overlap} skill${overlap === 1 ? '' : 's'} match the project's tech stack`
                : 'No direct tech stack overlap detected',
        };
    });
};

const rankApplicants = async ({ project, applicants }) => {
    try {
        const systemPrompt = `You help a project owner on a developer-collaboration platform evaluate
applicants. Score how well each applicant fits the project's needs, from 0-100, and give
ONE short reason (under 15 words) per applicant. Base this only on the actual overlap
between what the project needs and what the applicant has stated — don't invent
qualifications they didn't mention, and don't penalize applicants for being concise.
Return JSON only: {"rankings": [{"id": "...", "score": 0-100, "reason": "..."}]}`;

        const userPrompt = `Project needs:
- Roles needed: ${(project.rolesNeeded || []).join(', ') || 'unspecified'}
- Tech stack: ${(project.techStack || []).join(', ') || 'unspecified'}
- Description: ${project.description || ''}

Applicants:
${JSON.stringify(applicants, null, 2)}`;

        const result = await callGroq(systemPrompt, userPrompt);
        if (!Array.isArray(result?.rankings)) {
            return { rankings: fallbackRanking({ project, applicants }), source: 'fallback' };
        }
        return { rankings: result.rankings, source: 'ai' };
    } catch (err) {
        console.error('Applicant ranking failed:', err.message);
        return { rankings: fallbackRanking({ project, applicants }), source: 'fallback' };
    }
};

module.exports = {
    expandProjectDescription,
    rankApplicants,
};