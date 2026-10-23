import { defineConfig } from "tanstack-router-scoped-trees";
import { SECTION_COUNT, sectionName } from "./scripts/shape.ts";

const sectionNames = Array.from({ length: SECTION_COUNT }, (_, index) => sectionName(index + 1));

export default defineConfig({
  sections: Object.fromEntries(sectionNames.map((name) => [name, [`/${name}`]])),
});
