import type { Metadata } from "next";

/** Metadata fragment for routes that render a withheld/held state: crawlers must not index it. */
export function withheldRobots(available: boolean): Pick<Metadata, "robots"> {
  return available ? {} : { robots: { index: false, follow: true } };
}
