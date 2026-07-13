const User = require('../models/User');
const { generateGithubSummary } = require('../services/vertexai.service');
const { getIO } = require('../socket/socket');
const { extractGithubUsername, fetchGithubData } = require('../services/github.service');

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

        await User.findByIdAndUpdate(user._id, {
            githubSummary: summary,
            githubSummaryUpdatedAt: new Date(),
        });

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