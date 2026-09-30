# ITSRR Compiler

A Windows desktop application for capturing IT service reports and exporting them as an Excel workbook.

All report fields are optional. Missing values are retained as blank cells in the exported source log; undated records are still included in rankings and identified in the analysis summary.

The report form uses **Pending** instead of **In Progress**. The records table can be filtered by any saved status or by **Pending tickets**. Status filtering is case-insensitive, so values such as `Working`, `working`, and `WORKING` are grouped together. Pending tickets include blank, Open, Pending, legacy In Progress records, and custom unfinished statuses; Resolved, Closed, Working, Completed, Complete, and Done are treated as finished.

## Month-end archiving

Select **Archive finished** to move every ticket except those explicitly marked `Pending` out of the active list. Pending tickets carry forward into the new month. Each archive is stored locally with its month, archive date, and ticket count, and can be restored to the active list at any time.

## Setup

1. Run `npm install`.
2. Run `npm start` to open the desktop GUI.
3. Add one or more reports and select **Export to Excel**.

To use the browser version instead, run `npm run start:web` and open `http://localhost:4173`.

## Build a Windows app

Run `npm run build:windows`. The portable application is created in the `dist` folder and can be launched without installing it.

Records are stored locally in the current browser. The exported `.xlsx` file includes filters, useful column widths, and Excel date/time values.

## Quick Paste

Paste a labeled report into the **Quick Paste** box. The application recognizes the ITSRR number, users, dates, problem, cause, solution, and status, then automatically adds the record. Both `MM/DD/YYYY, h:mm AM` and `MM/DD/YY - h:mm PM` date styles are supported.

## Excel summaries

The workbook follows the supplied monthly-analysis template:

- **Sheet1** — branded monthly source log.
- **Analysis Summary** — monthly metrics, data-quality notes, top requesters, and top issue categories.
- **User Ranking** — requesters ranked by frequency with consolidated workstation IDs.
- **Asset Ranking** — separate sections for general workstations, printers, and explicit Shopfloor PCs.
- **Issue Summary** — normalized issue categories, frequency, and examples.
- **Classification** — a row-level audit trail with physical connection, configuration, and Direc-support flags.

The exporter analyzes the current month when current-month records exist; otherwise it analyzes the latest month represented in the saved records. Department can be entered explicitly or inferred from known ITSRR prefixes such as `SO` (Safety Officer), `HR`, `HLT` (Health), and `CSPQA` (Cavite SPQA).
"# ITSRR-Compiler" 
