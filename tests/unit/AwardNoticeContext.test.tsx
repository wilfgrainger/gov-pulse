import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AwardNoticeContext } from "@/app/components/NationalEvidenceEdition";

describe("AwardNoticeContext", () => {
  it("explains the limits of procurement award values and links to the records", () => {
    render(<AwardNoticeContext />);

    expect(
      screen.getByRole("heading", {
        name: "Contract awards show commitments, not cash paid.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/framework ceilings or multiple lots/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore public-money records/ })).toHaveAttribute(
      "href",
      "/money",
    );
    expect(document.body).not.toHaveTextContent(/£13\.15B|£2\.66B|30\.8%|£4\.05B|£1\.46B/);
  });
});
