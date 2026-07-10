import { describe, expect, it } from "vitest";
import {
  buildImagePasteInsertText,
  buildImageRelativePath,
  deriveImageName,
  extensionForMimeType,
  resolveNonCollidingName,
} from "../../src/core/image-paste";

/**
 * `extensionForMimeType` suggests a file extension for a MIME type, used when
 * the OS-provided file name is missing/generic (plan
 * `docs/planning/2026-07-09-image-paste-plan.md` §1, §3 Q3).
 */
describe("extensionForMimeType", () => {
  it("maps image/png to png", () => {
    expect(extensionForMimeType("image/png")).toBe("png");
  });

  it("returns undefined for an unrecognized mime type", () => {
    expect(extensionForMimeType("application/octet-stream")).toBeUndefined();
  });

  it("maps the other common clipboard/drag image mime types", () => {
    expect(extensionForMimeType("image/jpeg")).toBe("jpg");
    expect(extensionForMimeType("image/gif")).toBe("gif");
    expect(extensionForMimeType("image/webp")).toBe("webp");
    expect(extensionForMimeType("image/svg+xml")).toBe("svg");
    expect(extensionForMimeType("image/bmp")).toBe("bmp");
  });

  it("mime type lookups are case-insensitive", () => {
    expect(extensionForMimeType("IMAGE/PNG")).toBe("png");
  });
});

/**
 * `deriveImageName` implements plan §3 Q3: trust the OS-provided file name
 * when present/non-empty (mirrors VS Code's own built-in behavior); fall
 * back to a generated name only when it's empty.
 */
describe("deriveImageName", () => {
  it("splits a present, non-empty file name with an extension", () => {
    expect(deriveImageName("photo.png", "image/png")).toEqual({
      baseName: "photo",
      ext: "png",
    });
  });

  it("trusts a present file name with no extension, guessing the extension from the mime type", () => {
    expect(deriveImageName("screenshot", "image/jpeg")).toEqual({
      baseName: "screenshot",
      ext: "jpg",
    });
  });

  it("generates \"image\" when the file name is undefined (e.g. a raw clipboard paste)", () => {
    expect(deriveImageName(undefined, "image/png")).toEqual({
      baseName: "image",
      ext: "png",
    });
  });

  it("generates \"image\" when the file name is empty or whitespace-only", () => {
    expect(deriveImageName("   ", "image/gif")).toEqual({
      baseName: "image",
      ext: "gif",
    });
  });

  it("defaults to png when the file name is absent and the mime type is unrecognized", () => {
    expect(deriveImageName(undefined, "application/octet-stream")).toEqual({
      baseName: "image",
      ext: "png",
    });
  });

  it("treats a name that is only a dotted extension (e.g. \".png\") as a base name, not an empty one", () => {
    expect(deriveImageName(".png", "image/jpeg")).toEqual({
      baseName: ".png",
      ext: "jpg",
    });
  });
});

/**
 * `resolveNonCollidingName` mirrors VS Code's own built-in
 * `newFilePathGenerator.ts` collision-avoidance loop (MIT, read for
 * precedent per plan §0 — not copied verbatim): `name.ext`, then
 * `name-1.ext`, `name-2.ext`, ... until `exists` returns false.
 */
describe("resolveNonCollidingName", () => {
  it("returns the plain name when nothing exists yet", () => {
    expect(resolveNonCollidingName("photo", "png", () => false)).toBe(
      "photo.png",
    );
  });

  it("appends -1, -2, ... until a non-colliding name is found", () => {
    const taken = new Set(["photo.png", "photo-1.png", "photo-2.png"]);
    expect(
      resolveNonCollidingName("photo", "png", (name) => taken.has(name)),
    ).toBe("photo-3.png");
  });
});

/**
 * `buildImageRelativePath` implements plan §3 Q1 (operator decision, amended
 * from the plan's own recommendation): images are written under an
 * `images/` subfolder next to the document.
 */
describe("buildImageRelativePath", () => {
  it("prefixes the file name with the images/ subfolder", () => {
    expect(buildImageRelativePath("photo.png")).toBe("images/photo.png");
  });
});

/**
 * `buildImagePasteInsertText` builds the Markdown image-reference text to
 * insert, POSIX-slash-normalized regardless of host platform (plan §1 —
 * a Windows-built path may arrive with backslashes).
 */
describe("buildImagePasteInsertText", () => {
  it("wraps a relative path in Markdown image syntax", () => {
    expect(buildImagePasteInsertText("images/photo.png")).toBe(
      "![](images/photo.png)",
    );
  });

  it("normalizes backslashes to forward slashes", () => {
    expect(buildImagePasteInsertText("images\\photo.png")).toBe(
      "![](images/photo.png)",
    );
  });
});
