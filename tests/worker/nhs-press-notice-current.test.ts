// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parseNhsRttPressNotice } from "@/worker/nhs-press-notice";

const specialties = [
  "General Surgery Service 381,497 62.7%",
  "Urology Service 378,077 64.7%",
  "Trauma and Orthopaedic Service 827,960 60.1%",
  "Ear Nose and Throat Service 594,331 58.9%",
  "Ophthalmology Service 624,531 74.1%",
  "Oral Surgery Service 321,311 55.4%",
  "Neurosurgical Service 56,612 61.9%",
  "Plastic Surgery Service 102,390 58.1%",
].join(" ");

describe("current NHS RTT press notice extraction", () => {
  it("reassembles a split integer in the June 2026 long-wait thresholds", () => {
    const result = parseNhsRttPressNotice(`
      Thursday 13 August 2026 Statistical Press Notice
      NHS referral to treatment (RTT) waiting times data June 2026.
      The number of RTT pathways where a patient was waiting to start treatment at the end of
      June 2026 was 7. 3 million. The number of unique patients is estimated to be around 6. 2 million.
      Among the 7. 3 m illion, in 105,711 cases the patient was waiting more than 52 weeks,
      in 7,831 cases they were waiting more than 65 weeks, in 1,099 cases they were waiting more than 78 weeks,
      and in 17 3 cases they were waiting more than 104 weeks. In 65. 8 % of cases the patient had
      been waiting up to 18 weeks. During June 2026 , 1,968,600 new R TT pathway s were started.
      During June 2026 , 324,247 pathways were completed as a result of admitted treatment and
      1,332,290 were completed in other ways (non - admitted). The median waiting time was 11.9 weeks.
      The 92 nd percentile waiting time was 38. 3 weeks. Incomplete pathways) at the end of June 2026
      decreased by 1.0% (73,000) compared to the end of June 2025. ${specialties}
    `);

    expect(result.headline).toMatchObject({
      period: "June 2026",
      publicationDate: "2026-08-13",
      waitingPathwaysEstimate: 7_300_000,
      uniquePatientsEstimate: 6_200_000,
      over52Weeks: 105_711,
      over65Weeks: 7_831,
      over78Weeks: 1_099,
      over104Weeks: 173,
      within18WeeksPercent: 65.8,
      newPathways: 1_968_600,
      admittedCompleted: 324_247,
      nonAdmittedCompleted: 1_332_290,
      medianWaitWeeks: 11.9,
      percentile92WaitWeeks: 38.3,
    });
  });
});
