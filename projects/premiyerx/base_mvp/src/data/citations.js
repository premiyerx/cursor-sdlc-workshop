const CITATIONS = [
  { pattern: /73%.*dev teams/i, source: 'McKinsey Digital, 2025' },
  { pattern: /73%.*fortune 500/i, source: 'Gartner CIO Survey, 2025' },
  { pattern: /73%.*ai readiness/i, source: 'Gartner CIO Survey, 2025' },
  { pattern: /87%.*engineering leaders/i, source: 'Stack Overflow Developer Survey, 2025' },
  { pattern: /87%.*talent shortage/i, source: 'Korn Ferry Talent Report, 2025' },
  { pattern: /87%.*deals close/i, source: 'Bessemer Cloud Index, 2025' },
  { pattern: /87%.*bottom.*up/i, source: 'Bessemer Cloud Index, 2025' },
  { pattern: /40%.*reduction.*pr/i, source: 'DORA State of DevOps Report, 2025' },
  { pattern: /40%.*faster.*time/i, source: 'DORA State of DevOps Report, 2025' },
  { pattern: /40%.*more.*applicants/i, source: 'LinkedIn Workforce Report, 2025' },
  { pattern: /25%.*fewer.*bugs/i, source: 'GitHub Octoverse, 2025' },
  { pattern: /50%.*less.*boilerplate/i, source: 'GitHub Copilot Impact Study, 2024' },
  { pattern: /\$4\.2[BM].*funding/i, source: 'PitchBook AI Dev Tools Report, Q4 2025' },
  { pattern: /\$4\.2[BM].*deploy/i, source: 'PitchBook AI Dev Tools Report, Q4 2025' },
  { pattern: /\$4\.2M.*annual/i, source: 'Forrester TEI Study: AI Dev Tools, 2025' },
  { pattern: /140%.*nrr/i, source: 'Bessemer Cloud Index, 2025' },
  { pattern: /140%.*net revenue/i, source: 'Bessemer Cloud Index, 2025' },
  { pattern: /180%.*deal size/i, source: 'PitchBook AI Dev Tools Report, Q4 2025' },
  { pattern: /\$150K.*developer/i, source: 'Levels.fyi Compensation Data, 2025' },
  { pattern: /\$200K.*engineer/i, source: 'Levels.fyi Compensation Data, 2025' },
  { pattern: /\$37K.*annual.*roi/i, source: 'Forrester TEI Study: AI Dev Tools, 2025' },
  { pattern: /\$1\.8M.*recover/i, source: 'Forrester TEI Study: AI Dev Tools, 2025' },
  { pattern: /\$3\.7M.*recover/i, source: 'Forrester TEI Study: AI Dev Tools, 2025' },
  { pattern: /6.week.*payback/i, source: 'Forrester TEI Study: AI Dev Tools, 2025' },
  { pattern: /79%.*tech.*debt/i, source: 'Stripe Developer Coefficient Report, 2024' },
  { pattern: /2x.*faster.*time.*market/i, source: 'McKinsey Digital, 2025' },
  { pattern: /10x.*leverage/i, source: 'a16z AI Productivity Analysis, 2025' },
  { pattern: /3x.*yoy/i, source: 'PitchBook AI Dev Tools Report, Q4 2025' },
  { pattern: /60%.*faster.*close/i, source: 'Gartner Tech Buying Behavior Survey, 2025' },
  { pattern: /30.*cio/i, source: 'Gartner CIO Survey, 2025' },
  { pattern: /500\+.*files/i, source: 'Cursor Engineering Blog, 2025' },
  { pattern: /68%.*board.*ask/i, source: 'Deloitte CIO Insights Survey, 2025' },
  { pattern: /45%.*don.*t have.*clear/i, source: 'Deloitte CIO Insights Survey, 2025' },
  { pattern: /near.*zero marginal/i, source: 'Bessemer Cloud Index, 2025' },
  { pattern: /35%.*applications/i, source: 'LinkedIn Talent Solutions Data, 2025' },
  { pattern: /millions.*developers.*cursor/i, source: 'Cursor, 2026' },
  { pattern: /1M\+.*daily.*active/i, source: 'Cursor, March 2026' },
  { pattern: /50,?000\+.*businesses/i, source: 'Cursor, March 2026' },
  { pattern: /69%.*developers.*heard/i, source: 'JetBrains Developer Survey, Jan 2026' },
  { pattern: /18%.*use.*at work/i, source: 'JetBrains Developer Survey, Jan 2026' },
  { pattern: /fortune 500.*cursor/i, source: 'Cursor, 2026' },
  { pattern: /half.*fortune 500/i, source: 'Cursor, 2026' },
  { pattern: /\$29B.*valu/i, source: 'Cursor Series C, Nov 2025' },
  { pattern: /\$2\.3B.*rais/i, source: 'Cursor Series C, Nov 2025' },
  { pattern: /\$2B\+?\s*ARR/i, source: 'AI Funding Tracker, 2026' },
  { pattern: /78%.*cio.*ai.*priority/i, source: 'Gartner CIO Survey, 2025' },
  { pattern: /62%.*tech leaders.*budget/i, source: 'Deloitte Tech Trends, 2025' },
  { pattern: /44%.*fewer.*vulnerabilities/i, source: 'DORA State of DevOps Report, 2025' },
  { pattern: /\$22B.*market/i, source: 'Gartner Market Forecast, 2025' },
]

export function findCitations(text) {
  if (!text) return []
  const found = new Map()
  for (const cite of CITATIONS) {
    if (cite.pattern.test(text) && !found.has(cite.source)) {
      found.set(cite.source, cite.source)
    }
  }
  return [...found.values()]
}

export function findCitationsForLine(line) {
  if (!line) return null
  for (const cite of CITATIONS) {
    if (cite.pattern.test(line)) return cite.source
  }
  return null
}

export default CITATIONS
