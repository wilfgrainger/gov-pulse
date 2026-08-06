import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClientOnlyChart from "@/app/components/ClientOnlyChart";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ClientOnlyChart", () => {
  it("fails closed with an explicit message before client hydration", () => {
    const html = renderToStaticMarkup(
      <ClientOnlyChart heightClass="h-64">
        <div>Rendered chart</div>
      </ClientOnlyChart>,
    );

    expect(html).toContain("Interactive chart unavailable");
    expect(html).toContain("published figures remain available");
    expect(html).not.toContain("Loading chart");
    expect(html).not.toContain("Rendered chart");
  });

  it("supports a chart-specific fallback explanation", () => {
    const html = renderToStaticMarkup(
      <ClientOnlyChart heightClass="h-64" fallbackLabel="Polling chart unavailable; recent poll values are listed below.">
        <div>Rendered chart</div>
      </ClientOnlyChart>,
    );

    expect(html).toContain("Polling chart unavailable");
  });

  it("does not mount Recharts while its container is hidden", async () => {
    let resizeCallback: (() => void) | undefined;
    class MockResizeObserver {
      constructor(callback: () => void) {
        resizeCallback = callback;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const bounds = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: 0, height: 300 } as DOMRect);

    render(
      <ClientOnlyChart heightClass="h-64">
        <div>Rendered chart</div>
      </ClientOnlyChart>,
    );

    await waitFor(() => expect(resizeCallback).toBeDefined());
    expect(screen.queryByText("Rendered chart")).not.toBeInTheDocument();

    bounds.mockReturnValue({ width: 640, height: 300 } as DOMRect);
    act(() => resizeCallback?.());
    expect(await screen.findByText("Rendered chart")).toBeInTheDocument();
  });
});
