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

// --- Feature: AI Icebreaker (used by the Match Concierge agent below) ---

const icebreakerSchema = {
    type: Type.OBJECT,
    properties: {
        icebreaker: { type: Type.STRING },
    },
    required: ['icebreaker'],
};

const generateIcebreaker = async ({ userA, userB, githubContext }) => {
    const fallback = `Hey! Noticed you both work with ${(userA.skills || []).find(s => (userB.skills || []).includes(s)) || 'similar tech'} — what are you building right now?`;
    try {
        const prompt = `Two developers just matched on a project-collaboration app and haven't messaged yet.
Write ONE short, casual icebreaker message (max 25 words) that Developer A could send to Developer B to start the conversation. Reference something specific and real, not generic ("hey, nice profile!").

Developer A: role=${userA.role}, skills=${(userA.skills || []).join(', ')}
Developer B: role=${userB.role}, skills=${(userB.skills || []).join(', ')}
${githubContext ? `Developer B's recent GitHub activity: ${githubContext}` : ''}

Return JSON only.`;
        const result = await callGemini(prompt, icebreakerSchema);
        return result?.icebreaker || fallback;
    } catch (err) {
        console.error('Icebreaker generation failed:', err.message);
        return fallback;
    }
};

// --- Feature: Match Concierge Agent ---
//
// Unlike the functions above (single prompt in, single structured result
// out), this is a genuine agent loop: the model is given a goal and a set
// of tools, and DECIDES for itself which tools to call, in what order,
// based on what it learns — rather than the backend deciding what to
// generate. The model can call read-only "investigation" tools
// (getChatHistory, getGithubActivity) zero or more times before making
// its final decision by calling chooseAction, which is not executed by
// us — it's how the model reports its decision back.
//
// toolExecutors are the REAL functions that run when the model requests
// a tool call. These are only ever invoked here, server-side — the model
// never touches the database directly.
const buildToolExecutors = ({ matchId, userA, userB }) => ({
    getChatHistory: async () => {
        const Message = require('../models/Message');
        const messages = await Message.find({ matchId }).sort({ createdAt: -1 }).limit(1);
        const count = await Message.countDocuments({ matchId });
        const lastMessageAt = messages[0]?.createdAt || null;
        const daysSinceLastMessage = lastMessageAt
            ? Math.floor((Date.now() - new Date(lastMessageAt).getTime()) / (1000 * 60 * 60 * 24))
            : null;
        return { messageCount: count, daysSinceLastMessage };
    },
    getGithubActivity: async ({ which }) => {
        const { fetchGithubData } = require('./github.service');
        const target = which === 'userB' ? userB : userA;
        if (!target.github) return { available: false };
        const data = await fetchGithubData(target.github);
        if (!data) return { available: false };
        const topLanguages = Object.entries(data.languages || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([lang]) => lang);
        return {
            available: true,
            repoCount: data.repos.length,
            topLanguages,
            recentRepoNames: data.repos.slice(0, 3).map(r => r.name),
        };
    },
});

const toolDeclarations = [
    {
        name: 'getChatHistory',
        description: "Check how many messages this match has exchanged and how long since the last one. Use this first to decide if they've already started talking.",
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'getGithubActivity',
        description: 'Look up a specific developer\'s recent GitHub repos and languages, to make a suggestion more specific and personal.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                which: { type: Type.STRING, enum: ['userA', 'userB'], description: 'Which of the two matched developers to look up.' },
            },
            required: ['which'],
        },
    },
    {
        name: 'chooseAction',
        description: 'Report your final decision on what would most help this match. Call this LAST, once you have enough information.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                action: {
                    type: Type.STRING,
                    enum: ['icebreaker', 'project_idea', 'follow_up_nudge'],
                    description: "icebreaker: they haven't talked yet, suggest an opening message. project_idea: they're already talking, suggest something concrete to build. follow_up_nudge: they talked once then went quiet, just flag it for a reminder rather than generating content.",
                },
                reasoning: { type: Type.STRING, description: 'One short sentence explaining why, based on what you found.' },
            },
            required: ['action', 'reasoning'],
        },
    },
];

const MAX_AGENT_STEPS = 5;

const runMatchConcierge = async ({ matchId, userA, userB, sharedSkills = [] }) => {
    const ai = getClient();
    const executors = buildToolExecutors({ matchId, userA, userB });

    const contents = [
        {
            role: 'user',
            parts: [{
                text: `You're an assistant helping two developers who just matched on a collaboration app succeed at working together.
Developer A: role=${userA.role}, skills=${(userA.skills || []).join(', ')}
Developer B: role=${userB.role}, skills=${(userB.skills || []).join(', ')}
Shared skills: ${sharedSkills.join(', ') || 'none directly listed'}

You have tools to investigate their situation before deciding what would help most. Use them if useful, then call chooseAction with your final decision. Don't over-investigate — 1-2 tool calls is usually enough.`,
            }],
        },
    ];

    const toolsUsed = [];
    let decision = null;

    for (let step = 0; step < MAX_AGENT_STEPS; step++) {
        const response = await withTimeout(
            ai.models.generateContent({
                model: MODEL,
                contents,
                config: {
                    tools: [{ functionDeclarations: toolDeclarations }],
                    thinkingConfig: { thinkingBudget: 0 },
                },
            }),
            TIMEOUT_MS
        );

        const parts = response.candidates?.[0]?.content?.parts || [];
        const functionCallPart = parts.find(p => p.functionCall);

        if (!functionCallPart) break; // model gave up without deciding — treat as failure below

        const { name, args } = functionCallPart.functionCall;
        contents.push({ role: 'model', parts: [{ functionCall: { name, args } }] });

        if (name === 'chooseAction') {
            decision = args;
            break;
        }

        toolsUsed.push(name);
        const executor = executors[name];
        const result = executor ? await executor(args || {}) : { error: 'unknown tool' };

        contents.push({
            role: 'user',
            parts: [{ functionResponse: { name, response: { result } } }],
        });
    }

    if (!decision) {
        throw new Error('Agent did not reach a decision within the step limit');
    }

    return { action: decision.action, reasoning: decision.reasoning, toolsUsed };
};

module.exports = {
    generateMatchExplanation,
    generateGithubSummary,
    generateProjectIdea,
    generateIcebreaker,
    runMatchConcierge,
};