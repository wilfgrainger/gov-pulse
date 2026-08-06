import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PMApproval from "@/app/components/PMApproval";
import PolarizationMeter from "@/app/components/PolarizationMeter";
import TrendLines from "@/app/components/TrendLines";
import GeographicHeatmap from "@/app/components/GeographicHeatmap";
import EchoChamberMap from "@/app/components/EchoChamberMap";

const sections = [
  {
    name: "PM approval",
    component: <PMApproval />,
    heading: "No current PM approval series is published by public-data.org.",
  },
  {
    name: "polarization",
    component: <PolarizationMeter />,
    heading: "The polarization measure remains withdrawn.",
  },
  {
    name: "government satisfaction",
    component: <TrendLines />,
    heading: "The government satisfaction trend has been withdrawn.",
  },
  {
    name: "regional comparison",
    component: <GeographicHeatmap />,
    heading: "The UK regional comparison has been withdrawn.",
  },
  {
    name: "policy relationships",
    component: <EchoChamberMap />,
    heading: "The policy relationship matrix remains withdrawn.",
  },
];

afterEach(() => cleanup());

describe("withdrawn evidence sections", () => {
  it.each(sections)("renders $name as an explicit unavailable state", ({ component, heading }) => {
    render(component);

    expect(screen.getByRole("region", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByText("Withdrawn evidence")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "What must be true before this evidence returns",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read the evidence and withdrawal policy" })).toHaveAttribute(
      "href",
      "/sources"
    );
  });

  it("removes every hardcoded government satisfaction value and event claim", () => {
    render(<TrendLines />);

    expect(screen.queryByText("24%")).not.toBeInTheDocument();
    expect(screen.queryByText(/DOWN 21pp/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/HISTORIC LOW/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/COVID-19 Lockdown/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mini-Budget Crisis/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ipsos Political Monitor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/YouGov government approval/i)).not.toBeInTheDocument();
  });

  it("does not infer replacement values for the earlier withdrawn sections", () => {
    const { rerender } = render(<PMApproval />);
    expect(screen.queryByText(/current approval figure/i)).not.toBeInTheDocument();

    rerender(<PolarizationMeter />);
    expect(screen.getByText(/No approval, division or polarization value is being inferred/i)).toBeInTheDocument();
  });

  it("removes every former regional value and ranking claim", () => {
    render(<GeographicHeatmap />);

    expect(screen.queryByText("Scotland")).not.toBeInTheDocument();
    expect(screen.queryByText("Midlands")).not.toBeInTheDocument();
    expect(screen.queryByText(/Q3 2025/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/year ending September 2025/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/highest value/i)).not.toBeInTheDocument();
    expect(screen.getByText(/not carrying forward any regional unemployment, crime, voting or income value/i)).toBeInTheDocument();
  });

  it("does not infer or display a replacement policy relationship", () => {
    render(<EchoChamberMap />);

    expect(screen.getByText(/No relationship strength, ideological cluster or causal link is being inferred/i)).toBeInTheDocument();
    expect(screen.queryByText(/strong positive/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NHS Funding/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0\.62/)).not.toBeInTheDocument();
  });
});
