"use client";

import { useState } from "react";
import MetricsStatus from "@/app/components/MetricsStatus";

const QUESTIONS = [
  { text: "The government should provide universal healthcare free at the point of use", axis: "economic", direction: -1 },
  { text: "A strong military is essential to national security", axis: "social", direction: 1 },
  { text: "Corporations should face higher taxes to fund public services", axis: "economic", direction: -1 },
  { text: "Immigration enriches our culture and economy", axis: "social", direction: -1 },
  { text: "The free market is the best way to allocate resources", axis: "economic", direction: 1 },
  { text: "Traditional family values should be promoted by the state", axis: "social", direction: 1 },
  { text: "Climate change action should take priority over economic growth", axis: "economic", direction: -1 },
  { text: "Law enforcement should have broader surveillance powers", axis: "social", direction: 1 },
  { text: "Wealth inequality is the biggest threat to society", axis: "economic", direction: -1 },
  { text: "Individual liberty matters more than collective security", axis: "social", direction: -1 },
] as const;

const LABELS = ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] as const;
const INTERACTIVE_STATUS = {
  isLive: false,
  lastUpdated: null,
  source: "fallback" as const,
  cacheState: null,
  observationPeriod: null,
  observationStatus: null,
  observedAt: null,
};

function getLabel(economic: number, social: number): string {
  const parts: string[] = [];

  if (economic < -2) parts.push("Left");
  else if (economic > 2) parts.push("Right");
  else parts.push("Centre");

  if (social < -2) parts.push("Libertarian");
  else if (social > 2) parts.push("Authoritarian");

  return parts.join("-");
}

export default function PoliticalCompass() {
  const [answers, setAnswers] = useState<number[]>(new Array(QUESTIONS.length).fill(2));
  const [submitted, setSubmitted] = useState(false);

  const handleAnswer = (index: number, value: number) => {
    const next = [...answers];
    next[index] = value;
    setAnswers(next);
  };

  const economic = QUESTIONS.reduce((sum, question, index) => {
    if (question.axis !== "economic") {
      return sum;
    }

    return sum + (answers[index] - 2) * question.direction;
  }, 0);

  const social = QUESTIONS.reduce((sum, question, index) => {
    if (question.axis !== "social") {
      return sum;
    }

    return sum + (answers[index] - 2) * question.direction;
  }, 0);

  const maxEconomic = QUESTIONS.filter((question) => question.axis === "economic").length * 2;
  const maxSocial = QUESTIONS.filter((question) => question.axis === "social").length * 2;
  const economicScore = (economic / maxEconomic) * 10;
  const socialScore = (social / maxSocial) * 10;
  const label = getLabel(economicScore, socialScore);

  if (!submitted) {
    return (
      <div>
        <div className="space-y-6">
          {QUESTIONS.map((question, index) => (
            <div key={index} className="border border-[#d8d3c8] bg-white p-5">
              <p className="mb-1 text-xs font-semibold text-accent">Question {index + 1}</p>
              <p className="mb-4 text-sm font-semibold leading-6 text-[#172234]">
                {question.text}
              </p>
              <div className="flex flex-wrap gap-2">
                {LABELS.map((labelText, value) => (
                  <button
                    key={value}
                    onClick={() => handleAnswer(index, value)}
                    className={`border px-3 py-2 text-xs font-medium transition-colors ${
                      answers[index] === value
                        ? "border-[#172234] bg-[#172234] text-white"
                        : "border-[#cbc4b8] bg-white text-[#172234] hover:bg-[#f7f3eb]"
                    }`}
                  >
                    {labelText}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setSubmitted(true)}
          className="mt-6 w-full border border-[#172234] bg-[#172234] px-5 py-4 text-base font-semibold text-white transition-colors hover:bg-[#8a3540]"
        >
          Show my position →
        </button>
        <MetricsStatus section="politicalCompass" status={INTERACTIVE_STATUS} />
      </div>
    );
  }

  return (
    <div>
      <div className="relative mx-auto max-w-80 border border-[#d8d3c8] bg-white p-3">
        <svg viewBox="0 0 320 320" className="h-full w-full">
          <rect x="0" y="0" width="160" height="160" fill="#fee2e2" opacity="0.5" />
          <rect x="160" y="0" width="160" height="160" fill="#dbeafe" opacity="0.5" />
          <rect x="0" y="160" width="160" height="160" fill="#dcfce7" opacity="0.5" />
          <rect x="160" y="160" width="160" height="160" fill="#fef9c3" opacity="0.5" />

          <line x1="160" y1="0" x2="160" y2="320" stroke="#172234" strokeWidth="1.5" />
          <line x1="0" y1="160" x2="320" y2="160" stroke="#172234" strokeWidth="1.5" />
          {[80, 240].map((value) => (
            <g key={value}>
              <line x1={value} y1="0" x2={value} y2="320" stroke="#172234" strokeWidth="0.5" opacity="0.2" />
              <line x1="0" y1={value} x2="320" y2={value} stroke="#172234" strokeWidth="0.5" opacity="0.2" />
            </g>
          ))}

          <text x="160" y="14" textAnchor="middle" className="font-mono" fontSize="11" fontWeight="bold">
            Authoritarian
          </text>
          <text x="160" y="314" textAnchor="middle" className="font-mono" fontSize="11" fontWeight="bold">
            Libertarian
          </text>
          <text x="8" y="164" textAnchor="start" className="font-mono" fontSize="11" fontWeight="bold">
            Left
          </text>
          <text x="312" y="164" textAnchor="end" className="font-mono" fontSize="11" fontWeight="bold">
            Right
          </text>

          <text x="80" y="80" textAnchor="middle" fontSize="9" opacity="0.4" className="font-mono">
            Authoritarian left
          </text>
          <text x="240" y="80" textAnchor="middle" fontSize="9" opacity="0.4" className="font-mono">
            Authoritarian right
          </text>
          <text x="80" y="240" textAnchor="middle" fontSize="9" opacity="0.4" className="font-mono">
            Libertarian left
          </text>
          <text x="240" y="240" textAnchor="middle" fontSize="9" opacity="0.4" className="font-mono">
            Libertarian right
          </text>

          <circle
            cx={160 + (economicScore / 10) * 150}
            cy={160 - (socialScore / 10) * -150}
            r="12"
            fill="#8a3540"
            stroke="#172234"
            strokeWidth="2"
          />
          <text
            x={160 + (economicScore / 10) * 150}
            y={160 - (socialScore / 10) * -150 + 4}
            textAnchor="middle"
            fill="white"
            fontSize="10"
            fontWeight="bold"
          >
            You
          </text>
        </svg>
      </div>

      <div className="mt-6 border border-[#172234] bg-[#172234] p-5 text-center text-white">
        <p className="mb-2 text-sm text-white/70">Your political position</p>
        <p className="font-display text-4xl">
          {label}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="border border-[#d8d3c8] bg-white p-4 text-center">
          <p className="text-xs text-gray-500">Economic axis</p>
          <p className="mt-1 text-2xl font-semibold">
            {economicScore > 0 ? "+" : ""}
            {economicScore.toFixed(1)}
          </p>
          <p className="text-xs">{economicScore < -2 ? "Left" : economicScore > 2 ? "Right" : "Centre"}</p>
        </div>
        <div className="border border-[#d8d3c8] bg-white p-4 text-center">
          <p className="text-xs text-gray-500">Social axis</p>
          <p className="mt-1 text-2xl font-semibold">
            {socialScore > 0 ? "+" : ""}
            {socialScore.toFixed(1)}
          </p>
          <p className="text-xs">{socialScore > 2 ? "Authoritarian" : socialScore < -2 ? "Libertarian" : "Moderate"}</p>
        </div>
      </div>

      <button
        onClick={() => setSubmitted(false)}
        className="mt-4 w-full border border-[#172234] bg-white py-3 text-sm font-semibold text-[#172234] transition-colors hover:bg-[#f7f3eb]"
      >
        ← Retake quiz
      </button>

      <p className="mt-4 text-xs leading-5 text-gray-500">
        This simplified self-assessment is illustrative. It is not a validated political measure or a population estimate.
      </p>
      <MetricsStatus section="politicalCompass" status={INTERACTIVE_STATUS} />
    </div>
  );
}
