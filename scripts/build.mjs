import { copyFile, cp, mkdir, rm } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const outputDirectory = new URL("dist/", projectRoot);
const pages = [
    "index.html",
    "projects.html",
    "github_pushes.html",
    "about.html",
    "blog.html",
    "blog-rpkartellshop.html",
    "blog-botcontrol-dashboard.html",
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(new URL("server/", outputDirectory), { recursive: true });
await mkdir(new URL(".openai/", outputDirectory), { recursive: true });

await Promise.all([
    ...pages.map((page) => copyFile(new URL(page, projectRoot), new URL(page, outputDirectory))),
    cp(new URL("assets/", projectRoot), new URL("assets/", outputDirectory), { recursive: true }),
    copyFile(new URL("worker/index.js", projectRoot), new URL("server/index.js", outputDirectory)),
    copyFile(new URL(".openai/hosting.json", projectRoot), new URL(".openai/hosting.json", outputDirectory)),
]);
