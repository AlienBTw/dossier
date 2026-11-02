/**
 * Playwright's Chromium is installed in the Docker image. A checkout that
 * runs the server on the host does not have it until this command is run.
 */
export const PDF_BROWSER_INSTALL = "node node_modules/playwright-core/cli.js install --only-shell chromium";

export const PDF_BROWSER_MISSING = `PDF printing needs Playwright's Chromium, and it isn't installed. The Docker image includes it. On a checkout, run ${PDF_BROWSER_INSTALL}`;

/** The browser that prints PDFs is not installed. The message is safe to show. */
export class PdfBrowserMissingError extends Error {
  constructor() {
    super(PDF_BROWSER_MISSING);
    this.name = "PdfBrowserMissingError";
  }
}

const MISSING_BROWSER = /Executable doesn't exist|download new browsers/i;

/**
 * Playwright's own message names a path on the server. Swap that for the
 * install command; leave every other launch failure unchanged.
 */
export function explainBrowserLaunch(error: unknown): unknown {
  const message = error instanceof Error ? error.message : "";
  return MISSING_BROWSER.test(message) ? new PdfBrowserMissingError() : error;
}
