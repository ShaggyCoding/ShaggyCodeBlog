document.addEventListener("DOMContentLoaded", async () => {
    const gridEl = document.querySelector("[data-projects]");
    const chipsEl = document.querySelector("[data-languages]");
    const countEl = document.querySelector("[data-count]");
    const searchEl = document.querySelector("[data-search]");
    const sortEl = document.querySelector("[data-sort]");

    const sorters = {
        recent: (a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at),
        stars: (a, b) => b.stargazers_count - a.stargazers_count,
        name: (a, b) => a.name.localeCompare(b.name),
    };

    let repos = [];
    let language = "all";

    function render() {
        const query = searchEl.value.trim().toLowerCase();

        const matches = repos
            .filter((repo) => language === "all" || repo.language === language)
            .filter((repo) => {
                if (!query) return true;
                const haystack = `${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")}`;
                return haystack.toLowerCase().includes(query);
            })
            .sort(sorters[sortEl.value]);

        const pinned = matches.filter((repo) => SITE.featured.includes(repo.name));
        const rest = matches.filter((repo) => !SITE.featured.includes(repo.name));
        const ordered = [...pinned, ...rest];

        countEl.textContent = `${ordered.length} ${ordered.length === 1 ? "project" : "projects"}`;

        gridEl.innerHTML = ordered.length
            ? ordered.map(repoCard).join("")
            : `<div class="state"><p class="state__title">No matches</p><p>Try a different search term or clear the language filter.</p></div>`;

        observeReveals(gridEl);
    }

    gridEl.innerHTML = skeletons(6, "card");

    try {
        repos = await GitHub.repos();

        const counts = new Map();
        for (const repo of repos) {
            if (repo.language) counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
        }

        const chip = (value, label, count, dot) => `
            <button class="chip${value === "all" ? " is-active" : ""}" type="button" data-language="${escapeHtml(value)}">
                ${dot ? `<span class="lang-dot" style="background:${languageColor(value)}"></span>` : ""}
                ${escapeHtml(label)}
                <span class="chip__count">${count}</span>
            </button>
        `;

        chipsEl.innerHTML =
            chip("all", "All", repos.length, false) +
            [...counts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([lang, count]) => chip(lang, lang, count, true))
                .join("");

        chipsEl.addEventListener("click", (event) => {
            const button = event.target.closest(".chip");
            if (!button) return;
            language = button.dataset.language;
            chipsEl.querySelectorAll(".chip").forEach((el) => el.classList.toggle("is-active", el === button));
            render();
        });

        searchEl.addEventListener("input", render);
        sortEl.addEventListener("change", render);

        render();
    } catch (error) {
        gridEl.innerHTML = errorState(error);
        countEl.textContent = "";
    }
});
