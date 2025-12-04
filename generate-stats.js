const fs = require('fs');
const https = require('https');

const USERNAME = 'langerma';
const API_BASE = 'https://api.github.com';

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'GitHub-Stats-Generator',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', reject);
    });
}

async function fetchAllRepos(username) {
    const repos = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const url = `${API_BASE}/users/${username}/repos?per_page=100&page=${page}`;
        const pageRepos = await httpsGet(url);

        if (pageRepos.length === 0) {
            hasMore = false;
        } else {
            repos.push(...pageRepos);
            page++;
        }
    }

    return repos;
}

async function fetchGitHubStats() {
    try {
        console.log('Fetching GitHub stats...');

        const userData = await httpsGet(`${API_BASE}/users/${USERNAME}`);
        const repos = await fetchAllRepos(USERNAME);

        const stats = {
            totalRepos: repos.length,
            totalStars: 0,
            totalForks: 0,
            totalCommits: 0,
            languages: {},
            publicRepos: userData.public_repos,
            followers: userData.followers,
            following: userData.following,
            name: userData.name || USERNAME,
            bio: userData.bio || ''
        };

        repos.forEach(repo => {
            if (!repo.fork) {
                stats.totalStars += repo.stargazers_count;
                stats.totalForks += repo.forks_count;

                if (repo.language) {
                    stats.languages[repo.language] = (stats.languages[repo.language] || 0) + 1;
                }
            }
        });

        console.log('Stats fetched successfully:', stats);
        return stats;
    } catch (error) {
        console.error('Error fetching GitHub stats:', error);
        throw error;
    }
}

function generateProgressBar(percentage, width = 25) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

function generateASCIIStats(stats) {
    const width = 60;
    const border = '═'.repeat(width);

    // Helper to create right-aligned stat line
    const statLine = (label, value) => {
        const content = `  ${label}${value}`;
        const padding = ' '.repeat(width - content.length);
        return `║${content}${padding}║`;
    };

    let ascii = `
╔${border}╗
║${' '.repeat(width)}║
║${centerText('GitHub Statistics Dashboard', width)}║
║${centerText(`@${USERNAME}`, width)}║
║${' '.repeat(width)}║
╠${border}╣
║${' '.repeat(width)}║
║${centerText('Repository Statistics', width)}║
║${' '.repeat(width)}║
${statLine('Total Stars ......... ', stats.totalStars)}
${statLine('Total Forks ......... ', stats.totalForks)}
${statLine('Total Repos ......... ', stats.totalRepos)}
${statLine('Public Repos ........ ', stats.publicRepos)}
║${' '.repeat(width)}║
╠${border}╣
║${' '.repeat(width)}║
║${centerText('Social Statistics', width)}║
║${' '.repeat(width)}║
${statLine('Followers ........... ', stats.followers)}
${statLine('Following ........... ', stats.following)}
║${' '.repeat(width)}║
╚${border}╝
`;

    return ascii.trim();
}

function generateASCIILanguages(stats) {
    const width = 60;
    const border = '═'.repeat(width);

    const languages = Object.entries(stats.languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const total = languages.reduce((sum, [, count]) => sum + count, 0);

    let ascii = `
╔${border}╗
║${' '.repeat(width)}║
║${centerText('Most Used Languages', width)}║
║${' '.repeat(width)}║
╠${border}╣
║${' '.repeat(width)}║
`;

    languages.forEach(([language, count]) => {
        const percentage = ((count / total) * 100).toFixed(1);
        const bar = generateProgressBar(parseFloat(percentage), 25);
        const langPadded = language.padEnd(12);
        const percentPadded = `${percentage}%`.padStart(6);

        // Build the line with exact spacing
        const content = `  ${langPadded} ${bar} ${percentPadded}`;
        const padding = ' '.repeat(width - content.length);
        ascii += `║${content}${padding}║\n`;
    });

    ascii += `║${' '.repeat(width)}║
╚${border}╝
`;

    return ascii.trim();
}

function generateASCIIChart(stats) {
    const width = 60;
    const border = '═'.repeat(width);

    const maxHeight = 10;
    const metrics = [
        { label: 'Stars', value: stats.totalStars },
        { label: 'Forks', value: stats.totalForks },
        { label: 'Repos', value: stats.totalRepos },
        { label: 'Follow', value: stats.followers }
    ];

    const maxValue = Math.max(...metrics.map(m => m.value));

    let ascii = `
╔${border}╗
║${' '.repeat(width)}║
║${centerText('Statistics Overview', width)}║
║${' '.repeat(width)}║
╠${border}╣
`;

    // Draw chart from top to bottom
    for (let height = maxHeight; height > 0; height--) {
        const bars = metrics.map(metric => {
            const barHeight = Math.round((metric.value / maxValue) * maxHeight);
            return barHeight >= height ? '  ████  ' : '        ';
        }).join('');

        const content = `  ${bars}`;
        const padding = ' '.repeat(width - content.length);
        ascii += `║${content}${padding}║\n`;
    }

    // Add baseline
    const baseline = '  ' + '━'.repeat(54);
    const baselinePadding = ' '.repeat(width - baseline.length);
    ascii += `║${baseline}${baselinePadding}║\n`;

    // Add labels
    const labels = '  ' + metrics.map(m => m.label.padEnd(8)).join('');
    const labelsPadding = ' '.repeat(width - labels.length);
    ascii += `║${labels}${labelsPadding}║\n`;

    // Add values
    const values = '  ' + metrics.map(m => String(m.value).padEnd(8)).join('');
    const valuesPadding = ' '.repeat(width - values.length);
    ascii += `║${values}${valuesPadding}║\n`;

    ascii += `║${' '.repeat(width)}║
╚${border}╝
`;

    return ascii.trim();
}

function centerText(text, width) {
    // Remove emoji for length calculation (emojis are double-width)
    const textWithoutEmoji = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
    const emojiCount = text.length - textWithoutEmoji.length;
    const padding = Math.floor((width - text.length - emojiCount) / 2);
    const rightPadding = width - text.length - emojiCount - padding;
    return ' '.repeat(padding) + text + ' '.repeat(rightPadding);
}

async function main() {
    try {
        const stats = await fetchGitHubStats();

        const statsASCII = generateASCIIStats(stats);
        const languagesASCII = generateASCIILanguages(stats);
        const chartASCII = generateASCIIChart(stats);

        const fullASCII = `${statsASCII}

${languagesASCII}

${chartASCII}

---
*Last updated: ${new Date().toUTCString()}*
*Generated automatically by GitHub Actions*
`;

        // Save to README section
        const readmePath = 'README.md';
        let readme = '';

        if (fs.existsSync(readmePath)) {
            readme = fs.readFileSync(readmePath, 'utf8');
        }

        // Remove old stats section if exists
        const statsMarker = '<!-- GITHUB-STATS:START -->';
        const statsEndMarker = '<!-- GITHUB-STATS:END -->';

        if (readme.includes(statsMarker)) {
            const start = readme.indexOf(statsMarker);
            const end = readme.indexOf(statsEndMarker);
            if (end !== -1) {
                readme = readme.substring(0, start) + readme.substring(end + statsEndMarker.length);
            }
        }

        // Add new stats section
        const statsSection = `${statsMarker}
\`\`\`
${fullASCII}
\`\`\`
${statsEndMarker}

`;

        // Insert stats at the beginning or after the existing content
        if (readme.includes('<h2>Stats</h2>')) {
            // Replace the old stats section
            readme = readme.replace(/<h2>Stats<\/h2>[\s\S]*?(?=<|$)/, statsSection);
        } else {
            readme = statsSection + readme;
        }

        fs.writeFileSync(readmePath, readme.trim() + '\n');
        console.log('✅ README updated with ASCII stats!');

    } catch (error) {
        console.error('❌ Failed to generate stats:', error);
        process.exit(1);
    }
}

main();
