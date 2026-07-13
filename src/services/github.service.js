// Shared GitHub API logic, used by both github.controller.js (public
// stats lookup + authenticated summarize) and vertexai.service.js's
// Match Concierge agent (which needs to look up a user's GitHub activity
// as one of its investigation tools). Extracted here rather than
// exported from the controller to avoid a circular require between
// the controller and the AI service.

// Profiles store the GitHub field as a full URL (e.g.
// "https://github.com/TheOneWhoCodess"), but the GitHub API needs a bare
// username. This accepts either form so callers don't have to normalize
// it themselves.
const extractGithubUsername = (input) => {
    if (!input) return null;
    const trimmed = input.trim();

    const urlMatch = trimmed.match(/github\.com\/([^\/?#]+)/i);
    if (urlMatch) return urlMatch[1];

    // Not a URL — assume it's already a bare username.
    return trimmed.replace(/^\/+|\/+$/g, '');
};

const fetchGithubData = async (rawUsername) => {
    const username = extractGithubUsername(rawUsername);
    if (!username) return null;

    const headers = {
        Accept: 'application/vnd.github.v3+json',
        ...(process.env.GITHUB_TOKEN && {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
        }),
    };

    const [userRes, reposRes] = await Promise.all([
        fetch(`https://api.github.com/users/${username}`, { headers }),
        fetch(`https://api.github.com/users/${username}/repos?sort=stars&per_page=10`, { headers }),
    ]);

    if (!userRes.ok) {
        const body = await userRes.text().catch(() => '');
        console.error(
            `[github] fetch failed for "${username}": status=${userRes.status} ` +
            `rateLimitRemaining=${userRes.headers.get('x-ratelimit-remaining')} body=${body.slice(0, 300)}`
        );
        return null;
    }

    const userData = await userRes.json();
    const repos = await reposRes.json();

    const languages = {};
    await Promise.all(
        repos.slice(0, 8).map(async (repo) => {
            try {
                const langRes = await fetch(repo.languages_url, { headers });
                const langData = await langRes.json();
                Object.entries(langData).forEach(([lang, bytes]) => {
                    languages[lang] = (languages[lang] || 0) + bytes;
                });
            } catch {
                // skip if language fetch fails
            }
        })
    );

    return {
        followers: userData.followers,
        contributions: userData.public_repos,
        repos: repos.map(r => ({
            name: r.name,
            description: r.description,
            stars: r.stargazers_count,
            forks: r.forks_count,
            language: r.language,
            url: r.html_url,
        })),
        languages,
    };
};

module.exports = { extractGithubUsername, fetchGithubData };