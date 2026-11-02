import { describe, expect, it } from "vitest";

import { explainBrowserLaunch, PDF_BROWSER_INSTALL, PdfBrowserMissingError } from "./missing-browser";

describe("explainBrowserLaunch", () => {
  it("replaces Playwright's missing-browser error with the install command", () => {
    const error = explainBrowserLaunch(
      new Error("browserType.launch: Executable doesn't exist at C:\\Users\\someone\\chrome-headless-shell.exe\nPlease run the following command to download new browsers"),
    );
    expect(error).toBeInstanceOf(PdfBrowserMissingError);
    expect(error).toMatchObject({ message: expect.stringContaining(PDF_BROWSER_INSTALL) });
    expect((error as Error).message).not.toContain("Users");
    expect((error as Error).message).not.toContain("chrome-headless-shell");
  });

  it("keeps any other launch failure", () => {
    const original = new Error("Chromium crashed");
    expect(explainBrowserLaunch(original)).toBe(original);
    expect(explainBrowserLaunch("not an error")).toBe("not an error");
  });
});
