document.addEventListener("DOMContentLoaded", async () => {
    const statsElement = document.querySelector("[data-stats]");
    const featuredElement = document.querySelector("[data-featured]");
    const activityElement = document.querySelector("[data-activity]");
    const stackElement = document.querySelector("[data-stack]");
    const terminalElement = document.querySelector("[data-terminal]");

    featuredElement.innerHTML = skeletons(4, "card");
    activityElement.innerHTML = skeletons(3, "row");

    try {
        const [user, repositories, rawPushes] = await Promise.all([
            GitHub.user(),
            GitHub.repos(),
            GitHub.pushes(),
        ]);
        const pushes = await GitHub.enrichPushes(rawPushes);

        const starCount = repositories.reduce((sum, repository) => sum + repository.stargazers_count, 0);
        const commitCount = pushes.reduce((sum, event) => sum + event.payload.size, 0);

        statsElement.innerHTML = [
            ["Öffentliche Repos", repositories.length],
            ["GitHub-Sterne", starCount],
            ["Commits / 90 Tage", commitCount],
            ["Follower", user.followers],
        ].map(([label, value]) => `
            <div class="stat">
                <div class="stat__value">${formatNumber(value)}</div>
                <div class="stat__label">${label}</div>
            </div>
        `).join("");

        const featured = repositories
            .slice()
            .sort((first, second) =>
                second.stargazers_count - first.stargazers_count ||
                Date.parse(second.pushed_at) - Date.parse(first.pushed_at)
            )
            .slice(0, 4);

        featuredElement.innerHTML = featured.length
            ? featured.map(repoCard).join("")
            : `<div class="state"><p class="state__title">Noch keine öffentlichen Repositories</p><p>Neue Projekte erscheinen hier automatisch nach dem ersten öffentlichen Push.</p></div>`;

        activityElement.innerHTML = pushes.length
            ? pushes.slice(0, 4).map(pushItem).join("")
            : `<div class="state"><p class="state__title">Keine aktuellen Pushes</p><p>GitHub zeigt öffentliche Aktivität aus den vergangenen 90 Tagen.</p></div>`;

        const repositoryCountByLanguage = new Map();
        for (const repository of repositories) {
            if (!repository.language) continue;
            repositoryCountByLanguage.set(
                repository.language,
                (repositoryCountByLanguage.get(repository.language) || 0) + 1
            );
        }

        stackElement.innerHTML = [...repositoryCountByLanguage.entries()]
            .sort((first, second) => second[1] - first[1])
            .map(([language, count]) => `
                <span class="chip">
                    <i class="lang-dot" style="background:${languageColor(language)}"></i>
                    ${escapeHtml(language)}
                    <span class="chip__count">${count}</span>
                </span>
            `).join("");

        const lastPush = pushes[0];
        terminalElement.innerHTML = [
            ["identity", user.login],
            ["public_repos", String(repositories.length)],
            ["community_stars", String(starCount)],
            ["last_push", lastPush ? relativeTime(lastPush.created_at) : "—"],
        ].map(([key, value]) =>
            `<code><span class="tok-key">${key}</span>: <span class="tok-val">"${escapeHtml(value)}"</span></code>`
        ).join("");

        observeReveals();
    } catch (error) {
        statsElement.innerHTML = "";
        featuredElement.innerHTML = errorState(error);
        activityElement.innerHTML = "";
        stackElement.innerHTML = "";
        terminalElement.innerHTML = `<code><span class="tok-key">status</span>: <span class="tok-val">"offline"</span></code>`;
    }
});
