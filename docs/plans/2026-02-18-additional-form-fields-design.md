# Additional Form Fields — Two-Click Signature Demo

**Date:** 2026-02-18
**File:** `app/web-sdk/two-click-signature-demo/viewer.tsx`

## Goal

Add non-signature form fields (text, checkbox, radio) to the blank PDF so users have other interactive elements to click on, which also exercises the "revert to sign here on focus elsewhere" behavior of the signature fields.

## Layout

A blank PDF page is 612 × 792 pts. New fields occupy the top portion; existing signature rows remain at y=300 and y=400.

```
y=60   [Full Name:      ] [_________TextFormField_________]
y=110  [Date:           ] [_________TextFormField_________]
y=160  ☐ [Agree to terms]   ☐ [Receive updates]
y=210  [Preferred contact:] ● [Email]  ○ [Phone]
──────────────────────────────────────────────────────────
y=300  [John Doe sig]   [Jane Smith sig]    ← existing
y=400  [John Doe sig]   [Jane Smith sig]    ← existing
```

## New Annotations

| Row | Type | SDK Class | Details |
|-----|------|-----------|---------|
| Labels | FreeText | `FreeTextAnnotation` | "Full Name:", "Date:", "Agree to terms", "Receive updates", "Preferred contact:", "Email", "Phone" |
| y=60 | Text input | `TextFormField` + `WidgetAnnotation` | name="full-name", width=300, height=30 |
| y=110 | Text input | `TextFormField` + `WidgetAnnotation` | name="date", width=150, height=30 |
| y=160 | Checkbox | `CheckBoxFormField` + `WidgetAnnotation` | name="agree-terms", 20×20 |
| y=160 | Checkbox | `CheckBoxFormField` + `WidgetAnnotation` | name="receive-updates", 20×20 |
| y=210 | Radio | `RadioButtonFormField` + 2 `WidgetAnnotation`s | name="preferred-contact", buttonValues "email"/"phone" |

## Implementation Notes

- Labels use `FreeTextAnnotation` placed immediately left of (or beside) their field.
- The custom renderer checks `customData?.type === "signature"` — non-signature fields are unaffected.
- Radio buttons share a `formFieldName` and are distinguished by unique `buttonValue` on each `WidgetAnnotation`.
- All new fields are created in `handleLoadFields` alongside the existing signature fields.
- Button text: "Load Signature Fields" → "Load Form Fields".
- Sidebar instructions updated to mention the new field types.

## Out of Scope

- No custom styling/overlays for the non-signature fields (SDK defaults).
- No form submission or validation logic.
