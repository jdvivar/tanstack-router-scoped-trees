import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pageName, ROUTES_PER_SECTION, SECTION_COUNT, sectionName } from "./shape.ts";

const routesDirectory = fileURLToPath(new URL("../src/routes/", import.meta.url));
const PAGES_PER_SECTION = ROUTES_PER_SECTION - 2;

function layoutFile(section: string): string {
  return `import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/${section}")({
  component: () => (
    <section>
      <h1>${section}</h1>
      <Outlet />
    </section>
  ),
});
`;
}

function pageFile(routePath: string, heading: string): string {
  return `import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("${routePath}")({
  component: () => <h2>${heading}</h2>,
});
`;
}

async function removeGeneratedSections(): Promise<void> {
  const entries = await readdir(routesDirectory);

  for (const entry of entries.filter((name) => name.startsWith("section-"))) {
    await rm(path.join(routesDirectory, entry), { recursive: true, force: true });
  }
}

async function writeSection(section: string): Promise<void> {
  const directory = path.join(routesDirectory, section);

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "route.tsx"), layoutFile(section));
  await writeFile(path.join(directory, "index.tsx"), pageFile(`/${section}/`, `${section} home`));

  for (let page = 1; page <= PAGES_PER_SECTION; page += 1) {
    const name = pageName(page);

    await writeFile(
      path.join(directory, `${name}.tsx`),
      pageFile(`/${section}/${name}`, `${section} ${name}`),
    );
  }
}

await removeGeneratedSections();

for (let section = 1; section <= SECTION_COUNT; section += 1) {
  await writeSection(sectionName(section));
}

console.log(`Wrote ${SECTION_COUNT} sections x ${ROUTES_PER_SECTION} routes to ${routesDirectory}`);
