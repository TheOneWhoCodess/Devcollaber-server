const { GoogleGenAI, Type } = require('@google/genai');

// Vertex AI auth is IAM-based (service account), not a simple API key.
// Required env vars: GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION,
// and GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON key
// (or workload identity federation if deployed on GCP infra).
const ai = new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
});

const MODEL = process.env.VERTEX_MODEL || 'gemini-2.0-flash';
const TIMEOUT_MS = 6000;

// Wraps a Vertex AI call with a hard timeout so a slow/unavailable model
// never blocks a swipe response or a profile save.
const withTimeout = (promise, ms) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Vertex AI request timed out')), ms)
        ),
    ]);
};

const callGemini = async (prompt, schema) => {
    const response = await withTimeout(
        ai.models.generateContent({
            model: MODEL,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
                temperature: 0.7,
                maxOutputTokens: 300,
            },
        }),
        TIMEOUT_MS
    );

    const text = response.text;
    return JSON.parse(text);
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

module.exports = { generateMatchExplanation, generateGithubSummary };