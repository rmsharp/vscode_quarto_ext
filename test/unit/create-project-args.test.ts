import { describe, expect, it } from "vitest";
import { buildCreateProjectArgs } from "../../src/core/create-project-args";

describe("buildCreateProjectArgs", () => {
  it("builds argv for a default-type project", () => {
    expect(
      buildCreateProjectArgs("/abs/myproject", "default", "My Project"),
    ).toEqual([
      "create-project",
      "/abs/myproject",
      "--type",
      "default",
      "--title",
      "My Project",
    ]);
  });

  it.each(["website", "book", "manuscript"] as const)(
    "builds argv for a %s-type project",
    (type) => {
      expect(buildCreateProjectArgs("/abs/proj", type, "T")).toEqual([
        "create-project",
        "/abs/proj",
        "--type",
        type,
        "--title",
        "T",
      ]);
    },
  );

  it("passes the target directory through verbatim, never bare/cwd-relative (mirrors render-project.ts's D1 discipline)", () => {
    const args = buildCreateProjectArgs(
      "/Users/dev/projects/my new site",
      "website",
      "T",
    );
    expect(args[1]).toBe("/Users/dev/projects/my new site");
  });

  it("keeps a title containing spaces as one argv element (argv array bypasses shell parsing — no manual quoting needed)", () => {
    const args = buildCreateProjectArgs(
      "/abs/proj",
      "default",
      "My New Project",
    );
    expect(args).toHaveLength(6);
    expect(args[5]).toBe("My New Project");
  });
});
