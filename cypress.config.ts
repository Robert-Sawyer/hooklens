import { defineConfig } from "cypress";

export default defineConfig({
  allowCypressEnv: false,
  e2e: {
    baseUrl: "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: false,
  },
  reporter: "junit",
  reporterOptions: {
    mochaFile: "cypress/results/junit-[hash].xml",
    toConsole: true,
  },
  screenshotOnRunFailure: true,
  video: false,
});
