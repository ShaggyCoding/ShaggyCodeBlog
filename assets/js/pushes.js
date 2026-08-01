document.addEventListener("DOMContentLoaded", async () => {
    const feedEl = document.querySelector("[data-feed]");
    const statsEl = document.querySelector("[data-stats]");
    const heatmapEl = document.querySelector("[data-heatmap]");
    const filterEl = document.querySelector("[data-repo-filter]");
    const moreEl = document.querySelector("[data-more]");

    const PAGE_SIZE = 12;
    let pushes = [];
    let visible = PAGE_SIZE;

    const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    function levelFor(commits) {
        if (!commits) return 0;
        if (commits <= 2) return 1;
        if (commits <= 5) return 2;
        if (commits <= 9) return 3;
        return 4;
    }

    function renderHeatmap(events) {
        const perDay = new Map();
        for (const event of events) {
            const key = dayKey(new Date(event.created_at));
            perDay.set(key, (perDay.get(key) || 0) + event.payload.size);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const cursor = new Date(today);
        cursor.setDate(cursor.getDate() - 90);
        cursor.setDate(cursor.getDate() - cursor.getDay());

        const cells = [];
        while (cursor <= today) {
            const commits = perDay.get(dayKey(cursor)) || 0;
            const label = `${commits} commit${commits === 1 ? "" : "s"} on ${absoluteDate(cursor.toISOString())}`;
            cells.push(`<div class="heatmap__day" data-level="${levelFor(commits)}" title="${label}"></div>`);
            cursor.setDate(cursor.getDate() + 1);
        }

        heatmapEl.innerHTML = `
            <div class="heatmap__grid">${cells.join("")}</div>
            <div class="heatmap__legend">
                Less
                ${[0, 1, 2, 3, 4].map((level) => `<div class="heatmap__day" data-level="${level}"></div>`).join("")}
                More
            </div>
        `;
    }

    function renderStats(events) {
        const commits = events.reduce((sum, event) => sum + event.payload.size, 0);
        const repos = new Set(events.map((event) => event.repo.name));
        const busiest = events.reduce((best, event) => {
            const key = dayKey(new Date(event.created_at));
            best.set(key, (best.get(key) || 0) + event.payload.size);
            return best;
        }, new Map());
        const peak = Math.max(0, ...busiest.values());

        statsEl.innerHTML = [
            ["Pushes", events.length],
            ["Commits", commits],
            ["Repos touched", repos.size],
            ["Best day", peak],
        ]
            .map(
                ([label, value]) => `
                    <div class="stat">
                        <div class="stat__value">${formatNumber(value)}</div>
                        <div class="stat__label">${label}</div>
                    </div>
                `
            )
            .join("");
    }

    function renderFeed() {
        const repo = filterEl.value;
        const matches = repo === "all" ? pushes : pushes.filter((event) => event.repo.name === repo);

        feedEl.innerHTML = matches.length
            ? matches.slice(0, visible).map(pushItem).join("")
            : `<div class="state"><p class="state__title">No pushes here</p><p>Pick another repository to see its activity.</p></div>`;

        moreEl.hidden = matches.length <= visible;
        observeReveals(feedEl);
    }

    feedEl.innerHTML = skeletons(5, "row");

    try {
        pushes = await GitHub.pushes(3);

        if (!pushes.length) {
            statsEl.innerHTML = "";
            heatmapEl.innerHTML = "";
            feedEl.innerHTML = `<div class="state"><p class="state__title">No public pushes in the last 90 days</p><p>GitHub's activity feed only reaches back three months.</p></div>`;
            return;
        }

        renderStats(pushes);
        renderHeatmap(pushes);

        const names = [...new Set(pushes.map((event) => event.repo.name))].sort();
        filterEl.innerHTML =
            `<option value="all">All repositories</option>` +
            names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");

        filterEl.addEventListener("change", () => {
            visible = PAGE_SIZE;
            renderFeed();
        });

        moreEl.addEventListener("click", () => {
            visible += PAGE_SIZE;
            renderFeed();
        });

        renderFeed();
        observeReveals();
    } catch (error) {
        statsEl.innerHTML = "";
        heatmapEl.innerHTML = "";
        feedEl.innerHTML = errorState(error);
    }
});
