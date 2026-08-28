const https = require('https');
const options = {
    hostname: 'api.github.com',
    path: '/repos/chaohuang-TW/number-snake-arena/actions/runs?branch=main&event=push',
    headers: { 'User-Agent': 'Node.js' }
};

function check() {
    https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const runs = JSON.parse(data).workflow_runs;
            if (runs && runs.length > 0) {
                const latest = runs[0];
                console.log(`Status: ${latest.status}, Conclusion: ${latest.conclusion}`);
                if (latest.status === 'completed') {
                    process.exit(latest.conclusion === 'success' ? 0 : 1);
                }
            }
        });
    }).on('error', (e) => {
        console.error(e);
    });
}

setInterval(check, 10000);
check();
