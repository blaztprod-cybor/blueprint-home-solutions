window.ELEVATOR_EXAM_CONFIG = {
  // Paste a public Google Sheet URL here. The app will convert standard sheet links
  // into a CSV export automatically. Leave blank to use the built-in local sample bank.
  questionSheetUrl: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?usp=sharing",
  questionSheetTabs: [
    {
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?usp=sharing",
      sheet: "Sheet1",
      pool: "main",
    },
    {
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?usp=sharing",
      sheet: "Escalators",
      pool: "escalator",
    },
    {
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?usp=sharing",
      sheet: "Inspections",
      pool: "inspection",
    },
    {
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?usp=sharing",
      sheet: "Existing",
      pool: "existing",
    },
  ],
  localQuestionBankUrl: "./question-bank-1000.csv",
  fullQuestionCount: 50,
  fullDurationMinutes: 180,
  sampleQuestionCount: 5,
  sampleDurationMinutes: 18,
  fullSourceBlueprint: [
    { pool: "main", count: 20 },
    { pool: "escalator", count: 14 },
    { pool: "inspection", count: 6 },
    { pool: "existing", count: 10 },
  ],
  sampleSourceBlueprint: [
    { pool: "main", count: 2 },
    { pool: "escalator", count: 1 },
    { pool: "inspection", count: 1 },
    { pool: "existing", count: 1 },
  ],
  // Leave this empty to randomly pull every exam from the full live Sheet range.
  // Any valid new rows added to the Google Sheet become eligible automatically.
  sourceBlueprint: [],
};
