const { GoogleGenAI, Type } = require('@google/genai');

// Gemini Developer API auth (Google AI Studio) - a plain API key, not
// Vertex AI's IAM-based service-account/ADC auth. No GCP project,
// no service account JSON, no gcloud CLI needed.
// Required env var: GEMINI_API_KEY (from https://aistudio.google.com/apikey)
//
// Client is created lazily on first use, not at module load time - this
// avoids crashing the whole server at require() if the env var isn't
// loaded yet or is briefly missing, and matches how getClient() below
// only builds it once and reuses it after.
let _ai = null;
function getClient() {
    if (_ai) return _ai;
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
    }
    _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    return _ai;
}

const MODEL = process.env.VERTEX_MODEL || 'gemini-2.0-flash';
const TIMEOUT_MS = 6000;

// Wraps a Gemini call with a hard timeout so a slow/unavailable model
// never blocks a swipe response or a profile save.
const withTimeout = (promise, ms) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Gemini request timed out')), ms)
        ),
    ]);
};

const callGemini = async (prompt, schema) => {
    const ai = getClient();
    const response = await withTimeout(
        ai.models.generateContent({
            model: MODEL,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
                temperature: 0.7,
                maxOutputTokens: 1024,
                // 2.5-generation models spend part of maxOutputTokens on
                // invisible "thinking" tokens before writing the visible
                // response. For short structured JSON like this (no
                // multi-step reasoning needed), that thinking budget was
                // eating the entire token cap and leaving a truncated
                // response (just "{"), which then failed to parse.
                // Disabling it here fixes that; harmless no-op on models
                // that don't support thinking at all.
                thinkingConfig: { thinkingBudget: 0 },
            },
        }),
        TIMEOUT_MS
    );

    const text = (response.text || '').trim();
    if (!text) {
        throw new Error('Gemini returned an empty response');
    }

    try {
        return JSON.parse(text);
    } catch (err) {
        // Some responses include prose before/after the JSON object even
        // with responseSchema set (e.g. "Here is the JSON: {...}"). As a
        // fallback, pull out the first {...} block and try that instead
        // of failing outright.
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (innerErr) {
                console.error('Gemini returned unparseable text:', text.slice(0, 200));
                throw innerErr;
            }
        }
        console.error('Gemini returned non-JSON text:', text.slice(0, 200));
        throw err;
    }
};

// --- Feature: AI Match Explainer ---

const explanationSchema = {
    type: Type.OBJECT,
    properties: {
        explanation: { type: Type.STRING },
    },
    required: ['explanation'],
};

const fallbackExplanation = ({ score, sharedSkills = [] }) => {
    if (sharedSkills.length > 0) {
        return `You both share experience with ${sharedSkills.slice(0, 3).join(', ')}, giving you a ${score}% match score.`;
    }
    return `Your profiles scored a ${score}% match based on complementary skills and goals.`;
};

const generateMatchExplanation = async ({ userA, userB, score, sharedSkills = [] }) => {
    const prompt = `You are explaining to two developers why a matchmaking platform paired them up.
Be specific, warm, and concise (2-3 sentences max). Do not use generic filler phrases.

Developer A: role=${userA.role}, skills=${userA.skills.join(', ')}, experience=${userA.experience} years, project idea="${userA.projectIdea || 'not specified'}"
Developer B: role=${userB.role}, skills=${userB.skills.join(', ')}, experience=${userB.experience} years, project idea="${userB.projectIdea || 'not specified'}"
Match score: ${score}%
Shared skills: ${sharedSkills.join(', ') || 'none directly, but complementary roles'}

Explain why this is a good match, referencing their tech stack overlap, experience gap (if notable), and whether their project goals align. Return JSON only.`;

    try {
        const result = await callGemini(prompt, explanationSchema);
        return { explanation: result.explanation, source: 'ai' };
    } catch (err) {
        console.error('Match explanation generation failed:', err.message);
        return { explanation: fallbackExplanation({ score, sharedSkills }), source: 'fallback' };
    }
};

// --- Feature: GitHub Repo Summarizer ---

const summarySchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING },
    },
    required: ['summary'],
};

const fallbackSummary = ({ username, repos = [] }) => {
    const topLang = repos[0]?.language;
    return topLang
        ? `${username} actively builds with ${topLang} across ${repos.length} public repositories.`
        : `${username} maintains ${repos.length} public repositories on GitHub.`;
};

const generateGithubSummary = async ({ username, repos = [], languages = {} }) => {
    const topRepos = repos.slice(0, 8).map(r => `${r.name} (${r.language || 'unknown'}, ${r.stars} stars): ${r.description || 'no description'}`);
    const topLanguages = Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([lang]) => lang);

    const prompt = `Write a plain-English, 2-3 sentence summary of this developer's GitHub activity for a profile card on a developer-matching platform.
Be specific about what they build, not generic ("active developer"). Avoid restating raw numbers unless meaningful.

Username: ${username}
Top languages: ${topLanguages.join(', ') || 'unknown'}
Repositories:
${topRepos.join('\n') || 'no public repositories'}

Return JSON only.`;

    try {
        const result = await callGemini(prompt, summarySchema);
        return { summary: result.summary, source: 'ai' };
    } catch (err) {
        console.error('GitHub summary generation failed:', err.message);
        return { summary: fallbackSummary({ username, repos }), source: 'fallback' };
    }
};

// --- Feature: AI Project Idea Generator ---

const projectIdeaSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        techStack: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
        },
    },
    required: ['title', 'description', 'techStack'],
};

const fallbackProjectIdea = ({ sharedSkills = [] }) => ({
    title: 'Collaborative Tool',
    description: 'A project that plays to both of your strengths — worth discussing directly to find the right fit.',
    techStack: sharedSkills.slice(0, 4),
});

const generateProjectIdea = async ({ userA, userB, sharedSkills = [] }) => {
    try {
        const prompt = `Two developers matched on a project-collaboration app and want a concrete project idea to build together.

Developer A: role=${userA.role}, skills=${userA.skills.join(', ')}, experience=${userA.experience} years, project idea="${userA.projectIdea || 'not specified'}"
Developer B: role=${userB.role}, skills=${userB.skills.join(', ')}, experience=${userB.experience} years, project idea="${userB.projectIdea || 'not specified'}"
Shared skills: ${sharedSkills.join(', ') || 'none directly, but complementary roles'}

Suggest one specific, buildable project idea that uses both developers' skills. Prefer something scoped for a side project (not a huge SaaS), with a clear angle, not generic ("build a web app"). Return JSON only with:
- title: a short punchy project name (max 6 words)
- description: 2 sentences max, concrete about what it does
- techStack: 3-6 technologies drawn primarily from their actual listed skills`;

        const result = await callGemini(prompt, projectIdeaSchema);
        if (!result?.title || !result?.description) {
            return fallbackProjectIdea({ sharedSkills });
        }
        return {
            title: result.title,
            description: result.description,
            techStack: Array.isArray(result.techStack) ? result.techStack : [],
        };
    } catch (err) {
        console.error('Project idea generation failed:', err.message);
        return fallbackProjectIdea({ sharedSkills });
    }
};

module.exports = { generateMatchExplanation, generateGithubSummary, generateProjectIdea };