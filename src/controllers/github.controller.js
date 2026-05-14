const getGitHubStats = async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.status(400).json({ message: 'Username is required' });

        const headers = {
            Accept: 'application/vnd.github.v3+json',
            // Optional: add token to avoid rate limiting
            ...(process.env.GITHUB_TOKEN && {
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
            }),
        };

        const [userRes, reposRes] = await Promise.all([
            fetch(`https://api.github.com/users/${username}`, { headers }),
            fetch(`https://api.github.com/users/${username}/repos?sort=stars&per_page=10`, { headers }),
        ]);

        if (!userRes.ok) return res.status(404).json({ message: 'GitHub user not found' });

        const userData = await userRes.json();
        const repos = await reposRes.json();

        // Aggregate languages across top repos
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

        res.json({
            success: true,
            followers: userData.followers,
            contributions: userData.public_repos,
            repos: repos.map(r => ({
                name: r.name,
                stars: r.stargazers_count,
                forks: r.forks_count,
                language: r.language,
                url: r.html_url,
            })),
            languages,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getGitHubStats };