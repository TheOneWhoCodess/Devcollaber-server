const computeMatchScore = (userA, userB) => {
    const aSkills = new Set(userA.skills.map(s => s.toLowerCase()));
    const bSkills = new Set(userB.skills.map(s => s.toLowerCase()));
    const overlap = [...aSkills].filter(s => bSkills.has(s)).length;
    const union = new Set([...aSkills, ...bSkills]).size;
    const skillScore = union ? (overlap / union) * 100 : 0;

    // Bonus: complementary roles (frontend + backend = ideal)
    const complementary = [
        new Set(['frontend', 'backend']),
        new Set(['frontend', 'devops']),
        new Set(['ml', 'backend']),
    ];
    const roles = new Set([userA.role, userB.role]);
    const roleBonus = complementary.some(pair =>
        [...pair].every(r => roles.has(r))
    ) ? 15 : 0;

    return Math.min(Math.round(skillScore + roleBonus), 100);
};

module.exports = { computeMatchScore };