window.ELEVATOR_EXAM_CONFIG = {
  // Paste a public Google Sheet URL here. The app will convert standard sheet links
  // into a CSV export automatically. Leave blank to use the built-in local sample bank.
  questionSheetUrl: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?usp=sharing",
  questionSheetTabs: [
    {
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?usp=sharing",
      gid: "0",
      pool: "main",
    },
    {
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?usp=sharing",
      sheet: "Escalators",
      pool: "escalator",
    },
  ],
  localQuestionBankUrl: "./question-bank-1000.csv",
  fullQuestionCount: 50,
  fullDurationMinutes: 180,
  sampleQuestionCount: 5,
  sampleDurationMinutes: 18,
  fullSourceBlueprint: [
    { pool: "main", count: 36 },
    { pool: "escalator", count: 14 },
  ],
  sampleSourceBlueprint: [
    { pool: "main", count: 3 },
    { pool: "escalator", count: 2 },
  ],
  // Leave this empty to randomly pull every exam from the full live Sheet range.
  // Any valid new rows added to the Google Sheet become eligible automatically.
  sourceBlueprint: [],
};
