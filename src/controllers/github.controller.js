const User = require('../models/User');
const { generateGithubSummary } = require('../services/vertexai.service');
const { getIO } = require('../socket/socket');

// Profiles store the GitHub field as a full URL (e.g.
// "https://github.com/TheOneWhoCodess"), but the GitHub API needs a bare
// username. This accepts either form so callers don't have to normalize
// it themselves:
//   "https://github.com/TheOneWhoCodess"  -> "TheOneWhoCodess"
//   "github.com/TheOneWhoCodess"          -> "TheOneWhoCodess"
//   "TheOneWhoCodess"                     -> "TheOneWhoCodess"
//   "https://github.com/TheOneWhoCodess/" -> "TheOneWhoCodess" (trailing slash)
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

    if (!userRes.ok) return null;

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

const getGitHubStats = async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.status(400).json({ message: 'Username is required' });

        const data = await fetchGithubData(username);
        if (!data) return res.status(404).json({ message: 'GitHub user not found' });

        res.json({ success: true, ...data });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Authenticated action, bound to the logged-in user's own profile only —
// unlike getGitHubStats above (which is a public lookup by ?username=),
// this writes to req.user's stored profile, so it must not accept an
// arbitrary username from the query string. Meant to be triggered by an
// explicit "Sync GitHub" button, not on every profile view, since each
// call costs an LLM invocation.
const summarizeGithub = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (!user.github) return res.status(400).json({ message: 'No GitHub username set on profile' });

        const data = await fetchGithubData(user.github);
        if (!data) return res.status(404).json({ message: 'GitHub user not found' });

        const { summary } = await generateGithubSummary({
            username: extractGithubUsername(user.github),
            repos: data.repos,
            languages: data.languages,
        });

        user.githubSummary = summary;
        user.githubSummaryUpdatedAt = new Date();
        await user.save();

        try {
            getIO().to(user._id.toString()).emit('github_summary_ready', {
                userId: user._id,
                summary,
            });
        } catch {
            // Socket server not initialized — safe to ignore.
        }

        res.json({ success: true, summary });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getGitHubStats, summarizeGithub };