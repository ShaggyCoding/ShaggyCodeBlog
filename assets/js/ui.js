const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);

const formatNumber = (value) =>
    value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(value);

const RELATIVE_UNITS = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
];

function relativeTime(iso) {
    const formatter = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });
    const seconds = (Date.parse(iso) - Date.now()) / 1000;

    for (const [unit, size] of RELATIVE_UNITS) {
        if (Math.abs(seconds) >= size) {
            return formatter.format(Math.round(seconds / size), unit);
        }
    }

    return formatter.format(Math.round(seconds), "second");
}

const absoluteDate = (iso) =>
    new Date(iso).toLocaleDateString("de-DE", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

function repoCard(repo) {
    const topics = (repo.topics || []).slice(0, 4);

    return `
        <article class="card reveal">
            <div class="repo__index">
                <span class="repo__arrow" aria-hidden="true">↗</span>
            </div>
            <h3 class="repo__name"><a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener">${escapeHtml(repo.name)}</a></h3>
            <p class="repo__desc">${escapeHtml(repo.description || "Ein öffentliches Repository ohne Beschreibung.")}</p>
            ${topics.length ? `<div class="repo__topics">${topics.map((topic) => `<span class="tag">${escapeHtml(topic)}</span>`).join("")}</div>` : ""}
            <div class="repo__meta">
                ${repo.language ? `<span class="meta-item"><i class="lang-dot" style="background:${languageColor(repo.language)}"></i>${escapeHtml(repo.language)}</span>` : ""}
                <span class="meta-item"><span class="meta-icon" aria-hidden="true">★</span>${formatNumber(repo.stargazers_count)}</span>
                <span class="meta-item"><span class="meta-icon" aria-hidden="true">⑂</span>${formatNumber(repo.forks_count)}</span>
                <span class="meta-item">Aktualisiert ${relativeTime(repo.pushed_at)}</span>
            </div>
        </article>
    `;
}

function pushItem(event) {
    const commits = event.payload.commits.slice().reverse();
    const shownCommits = commits.slice(0, 4);
    const hiddenCount = commits.length - shownCommits.length;
    const branch = event.payload.ref.replace("refs/heads/", "");
    const repoUrl = `https://github.com/${event.repo.name}`;

    const commitRow = (commit) => `
        <li class="push__commit">
            <a class="push__sha" href="${repoUrl}/commit/${escapeHtml(commit.sha)}" target="_blank" rel="noopener">${escapeHtml(commit.sha.slice(0, 7))}</a>
            <span class="push__msg">${escapeHtml(commit.message.split("\n")[0])}</span>
        </li>
    `;

    return `
        <article class="push reveal">
            <div class="push__head">
                <a class="push__repo" href="${repoUrl}" target="_blank" rel="noopener">${escapeHtml(event.repo.name)}</a>
                <span class="push__branch">⑂ ${escapeHtml(branch)}</span>
                <time class="push__time" datetime="${escapeHtml(event.created_at)}" title="${absoluteDate(event.created_at)}">${relativeTime(event.created_at)}</time>
            </div>
            <ul class="push__commits">${shownCommits.map(commitRow).join("")}</ul>
            ${hiddenCount > 0 ? `<p class="push__more">+ ${hiddenCount} weitere ${hiddenCount === 1 ? "Änderung" : "Änderungen"}</p>` : ""}
        </article>
    `;
}

function errorState(error) {
    let message = "Die GitHub-Schnittstelle ist gerade nicht erreichbar. Bitte später erneut versuchen.";

    if (error.rateLimited) {
        message = "Das stündliche GitHub-Limit für anonyme Abfragen ist erreicht. Es wird automatisch zurückgesetzt.";
    } else if (error.status === 404) {
        message = `Für <code>${escapeHtml(SITE.githubUsername)}</code> wurde kein öffentliches GitHub-Profil gefunden.`;
    }

    return `<div class="state"><p class="state__title">Zurzeit keine Daten verfügbar</p><p>${message}</p></div>`;
}

const skeletons = (count, variant) =>
    Array.from({ length: count }, () => `<div class="skeleton skeleton--${variant}"></div>`).join("");

const revealObserver = new IntersectionObserver(
    (entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
        }
    },
    { rootMargin: "0px 0px -50px 0px" }
);

function observeReveals(root = document) {
    root.querySelectorAll(".reveal:not(.is-visible)").forEach((element, index) => {
        element.style.transitionDelay = `${Math.min(index, 6) * 45}ms`;
        revealObserver.observe(element);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector(".header");
    const nav = document.querySelector(".nav");
    const navToggle = document.querySelector(".nav-toggle");

    const updateHeader = () => header.classList.toggle("is-stuck", window.scrollY > 8);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

    navToggle.addEventListener("click", () => {
        const isOpen = nav.classList.toggle("is-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.addEventListener("click", (event) => {
        if (!event.target.closest("a")) return;
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
    });

    const bindings = {
        "[data-site-name]": SITE.name,
        "[data-role]": SITE.role,
        "[data-location]": SITE.location,
        "[data-github-handle]": `@${SITE.githubUsername}`,
        "[data-year]": new Date().getFullYear(),
    };

    for (const [selector, value] of Object.entries(bindings)) {
        document.querySelectorAll(selector).forEach((element) => {
            element.textContent = value;
        });
    }

    document.querySelectorAll("[data-github-url]").forEach((element) => {
        element.href = SITE.social.github || `https://github.com/${SITE.githubUsername}`;
    });

    observeReveals();
});
