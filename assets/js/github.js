const GitHub = (() => {
    const API_URL = "https://api.github.com";
    const CACHE_TTL = 10 * 60 * 1000;

    function readCache(key) {
        try {
            const entry = JSON.parse(sessionStorage.getItem(key));
            return entry && Date.now() - entry.createdAt < CACHE_TTL ? entry.data : null;
        } catch {
            return null;
        }
    }

    function writeCache(key, data) {
        try {
            sessionStorage.setItem(key, JSON.stringify({ createdAt: Date.now(), data }));
        } catch {
            return;
        }
    }

    async function request(path) {
        const cacheKey = `github:${path}`;
        const cachedData = readCache(cacheKey);
        if (cachedData) return cachedData;

        const response = await fetch(API_URL + path, {
            headers: { Accept: "application/vnd.github+json" },
        });

        if (!response.ok) {
            const error = new Error(`GitHub responded with ${response.status}`);
            error.status = response.status;
            error.rateLimited = response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0";
            throw error;
        }

        const data = await response.json();
        writeCache(cacheKey, data);
        return data;
    }

    const user = () => request(`/users/${SITE.githubUsername}`);

    async function repos() {
        const repositories = await request(`/users/${SITE.githubUsername}/repos?per_page=100&sort=updated`);
        return repositories.filter((repository) =>
            !repository.fork && !SITE.hidden.includes(repository.name)
        );
    }

    async function events(pageCount = 1) {
        const collectedEvents = [];

        for (let page = 1; page <= pageCount; page += 1) {
            const eventsOnPage = await request(`/users/${SITE.githubUsername}/events/public?per_page=100&page=${page}`);
            collectedEvents.push(...eventsOnPage);
            if (eventsOnPage.length < 100) break;
        }

        return collectedEvents;
    }

    const pushes = (pageCount) =>
        events(pageCount).then((allEvents) => allEvents.filter((event) => event.type === "PushEvent"));

    // GitHub's public events feed no longer includes the pushed commits in
    // a PushEvent's payload (only the before/head SHA range) — fetch the
    // real commit list via the compare API instead. Capped to the most
    // recent MAX_ENRICH pushes so a very active account can't blow through
    // the anonymous 60-requests/hour rate limit on a single page load.
    const MAX_ENRICH = 40;

    async function compareCommits(repoFullName, before, head) {
        if (!before || !head || before === head) return [];
        try {
            const comparison = await request(`/repos/${repoFullName}/compare/${before}...${head}`);
            return (comparison.commits || []).map((commit) => ({
                sha: commit.sha,
                message: commit.commit.message,
            }));
        } catch {
            return [];
        }
    }

    async function enrichPushes(pushEvents) {
        return Promise.all(
            pushEvents.map(async (event, index) => {
                const commits =
                    index < MAX_ENRICH
                        ? await compareCommits(event.repo.name, event.payload.before, event.payload.head)
                        : [];
                return { ...event, payload: { ...event.payload, commits, size: commits.length } };
            })
        );
    }

    return { user, repos, pushes, enrichPushes };
})();

const LANGUAGE_COLORS = {
    JavaScript: "#f1e05a",
    TypeScript: "#3178c6",
    Python: "#3572a5",
    Java: "#b07219",
    "C#": "#178600",
    "C++": "#f34b7d",
    C: "#555555",
    Go: "#00add8",
    Rust: "#dea584",
    PHP: "#4f5d95",
    Ruby: "#701516",
    Swift: "#f05138",
    Kotlin: "#a97bff",
    Dart: "#00b4ab",
    HTML: "#e34c26",
    CSS: "#563d7c",
    SCSS: "#c6538c",
    Vue: "#41b883",
    Svelte: "#ff3e00",
    Shell: "#89e051",
    Lua: "#000080",
    Zig: "#ec915c",
};

const languageColor = (language) => LANGUAGE_COLORS[language] || "#8b949e";
