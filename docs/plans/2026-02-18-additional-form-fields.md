# Additional Form Fields Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add text, checkbox, and radio form fields (with labels) above the existing signature rows so users have other interactive elements to click on.

**Architecture:** All new fields are created inside the existing `handleLoadFields` function alongside the signature fields. Labels use `TextAnnotation` (always-visible, non-interactive). The field-clearing step is extended to also remove label annotations (identified via `customData.type = "form-label"`).

**Tech Stack:** Nutrient Web SDK (`NutrientViewer`), React, TypeScript/TSX

---

## Layout (PDF coordinates, page 0)

```
y=50   [Full Name:    ] [___TextFormField___ w=280]
y=100  [Date:         ] [___TextFormField___ w=150]
y=150  ☐ Agree to terms         ☐ Receive updates
y=200  [Preferred contact:]  ● Email   ○ Phone
──────────────────────────────────────────────────
y=300  [John Doe sig]   [Jane Smith sig]   ← existing
y=400  [John Doe sig]   [Jane Smith sig]   ← existing
```

Coordinate constants:
- Left margin: `x=50`
- Field start: `x=160` (label 100px wide + 10px gap)
- Checkbox/radio size: 20×20 px

---

## Task 1: Extend field clearing to also delete labels

**File:** `app/web-sdk/two-click-signature-demo/viewer.tsx`
Modify lines ~316–320 inside `handleLoadFields`.

**Step 1: Replace the existing clear block**

Find this in `handleLoadFields`:
```typescript
// Clear existing fields
const existingFields = await instance.getFormFields();
for (const field of existingFields) {
  await instance.delete(field);
}
```

Replace with:
```typescript
// Clear existing form fields (widget annotations are deleted automatically)
const existingFields = await instance.getFormFields();
for (const field of existingFields) {
  await instance.delete(field);
}

// Clear existing label annotations (TextAnnotations tagged form-label)
const existingAnnotations = await instance.getAnnotations(0);
const labelAnnotations = existingAnnotations.filter(
  (ann: any) => ann.customData?.type === "form-label",
);
for (const label of labelAnnotations) {
  await instance.delete(label);
}
```

**Step 2: Add `createLabel` helper above `handleLoadFields`**

Insert this function directly above the `handleLoadFields` declaration:
```typescript
/**
 * Creates a non-interactive TextAnnotation to serve as a form field label.
 */
const createLabel = (
  NV: typeof window.NutrientViewer,
  text: string,
  x: number,
  y: number,
  width: number,
  height = 20,
) =>
  new NV.Annotations.TextAnnotation({
    pageIndex: 0,
    boundingBox: new NV.Geometry.Rect({ left: x, top: y, width, height }),
    text: { format: "plain", value: text },
    fontSize: 11,
    isBold: false,
    horizontalAlign: "left",
    verticalAlign: "center",
    locked: true,
    isDeletable: false,
    isEditable: false,
    customData: { type: "form-label" },
  });
```

**Step 3: Verify in browser**

1. Run `npm run dev` (or it is already running)
2. Navigate to the two-click signature demo
3. Click "Load Signature Fields" — signature fields should appear as before
4. Click it a second time — fields should reload cleanly with no ghost labels

**Step 4: Commit**

```bash
git add app/web-sdk/two-click-signature-demo/viewer.tsx
git commit -m "feat: extend field clearing to remove label annotations on reload"
```

---

## Task 2: Add Full Name and Date text fields

**File:** `app/web-sdk/two-click-signature-demo/viewer.tsx`

**Step 1: Add text fields after the label-clearing block**

Append inside the `try` block of `handleLoadFields`, after the label-clearing code and before the signature field loop:

```typescript
// ── Text fields ─────────────────────────────────────────
const fullNameId = `text-full-name-${Date.now()}`;
const fullNameWidget = new NV.Annotations.WidgetAnnotation({
  id: fullNameId,
  pageIndex: 0,
  formFieldName: fullNameId,
  boundingBox: new NV.Geometry.Rect({ left: 160, top: 50, width: 280, height: 24 }),
});
const fullNameField = new NV.FormFields.TextFormField({
  name: fullNameId,
  annotationIds: NV.Immutable.List([fullNameId]),
  value: "",
});

const dateId = `text-date-${Date.now()}`;
const dateWidget = new NV.Annotations.WidgetAnnotation({
  id: dateId,
  pageIndex: 0,
  formFieldName: dateId,
  boundingBox: new NV.Geometry.Rect({ left: 160, top: 100, width: 150, height: 24 }),
});
const dateField = new NV.FormFields.TextFormField({
  name: dateId,
  annotationIds: NV.Immutable.List([dateId]),
  value: "",
});

await instance.create([
  createLabel(NV, "Full Name:", 50, 52, 100),
  fullNameWidget,
  fullNameField,
  createLabel(NV, "Date:", 50, 102, 100),
  dateWidget,
  dateField,
]);
```

**Step 2: Verify in browser**

Click "Load Signature Fields". Expect:
- A "Full Name:" label with a text input box to its right at the top of the page
- A "Date:" label with a narrower text input box below it
- Clicking a text field should NOT trigger any signature behavior
- Clicking a text field, then clicking a signature field should NOT interfere with signature state

**Step 3: Commit**

```bash
git add app/web-sdk/two-click-signature-demo/viewer.tsx
git commit -m "feat: add Full Name and Date text form fields"
```

---

## Task 3: Add checkbox form fields

**File:** `app/web-sdk/two-click-signature-demo/viewer.tsx`

**Step 1: Add checkboxes after the text fields block**

Append immediately after the `instance.create([...text fields...])` call:

```typescript
// ── Checkboxes ───────────────────────────────────────────
const agreeId = `checkbox-agree-${Date.now()}`;
const agreeWidget = new NV.Annotations.WidgetAnnotation({
  id: agreeId,
  pageIndex: 0,
  formFieldName: agreeId,
  boundingBox: new NV.Geometry.Rect({ left: 50, top: 150, width: 20, height: 20 }),
});
const agreeField = new NV.FormFields.CheckBoxFormField({
  name: agreeId,
  annotationIds: NV.Immutable.List([agreeId]),
});

const updatesId = `checkbox-updates-${Date.now() + 1}`;
const updatesWidget = new NV.Annotations.WidgetAnnotation({
  id: updatesId,
  pageIndex: 0,
  formFieldName: updatesId,
  boundingBox: new NV.Geometry.Rect({ left: 220, top: 150, width: 20, height: 20 }),
});
const updatesField = new NV.FormFields.CheckBoxFormField({
  name: updatesId,
  annotationIds: NV.Immutable.List([updatesId]),
});

await instance.create([
  agreeWidget,
  agreeField,
  createLabel(NV, "Agree to terms", 78, 150, 130),
  updatesWidget,
  updatesField,
  createLabel(NV, "Receive updates", 248, 150, 130),
]);
```

**Step 2: Verify in browser**

Click "Load Signature Fields". Expect:
- Two checkboxes in a row at y≈150, each with a label to its right
- Checkboxes are independently togglable
- Clicking a checkbox should not affect signature field state

**Step 3: Commit**

```bash
git add app/web-sdk/two-click-signature-demo/viewer.tsx
git commit -m "feat: add Agree to terms and Receive updates checkbox fields"
```

---

## Task 4: Add radio button form field

**File:** `app/web-sdk/two-click-signature-demo/viewer.tsx`

**Step 1: Add radio buttons after the checkboxes block**

Append immediately after the `instance.create([...checkboxes...])` call:

```typescript
// ── Radio buttons ────────────────────────────────────────
const contactFieldName = `radio-contact-${Date.now()}`;
const emailRadioId = `${contactFieldName}-email`;
const phoneRadioId = `${contactFieldName}-phone`;

const emailWidget = new NV.Annotations.WidgetAnnotation({
  id: emailRadioId,
  pageIndex: 0,
  formFieldName: contactFieldName,
  boundingBox: new NV.Geometry.Rect({ left: 180, top: 200, width: 20, height: 20 }),
});
const phoneWidget = new NV.Annotations.WidgetAnnotation({
  id: phoneRadioId,
  pageIndex: 0,
  formFieldName: contactFieldName,
  boundingBox: new NV.Geometry.Rect({ left: 260, top: 200, width: 20, height: 20 }),
});
const contactField = new NV.FormFields.RadioButtonFormField({
  name: contactFieldName,
  annotationIds: NV.Immutable.List([emailRadioId, phoneRadioId]),
  options: NV.Immutable.List([
    new NV.FormOption({ label: "Email", value: "email" }),
    new NV.FormOption({ label: "Phone", value: "phone" }),
  ]),
  defaultValue: "email",
});

await instance.create([
  createLabel(NV, "Preferred contact:", 50, 202, 125),
  emailWidget,
  phoneWidget,
  contactField,
  createLabel(NV, "Email", 206, 202, 45),
  createLabel(NV, "Phone", 286, 202, 45),
]);
```

**Step 2: Verify in browser**

Click "Load Signature Fields". Expect:
- "Preferred contact:" label at y≈200
- Two radio buttons to its right, labeled "Email" and "Phone"
- Selecting one deselects the other (standard radio behavior)
- "Email" is selected by default

**Step 3: Commit**

```bash
git add app/web-sdk/two-click-signature-demo/viewer.tsx
git commit -m "feat: add Preferred contact radio button field"
```

---

## Task 5: Update button text and sidebar instructions

**File:** `app/web-sdk/two-click-signature-demo/viewer.tsx`

**Step 1: Change button text**

Find (in the JSX):
```tsx
Load Signature Fields
```

Replace with:
```tsx
Load Form Fields
```

**Step 2: Update sidebar instructions**

Find:
```tsx
<ol>
  <li>Click "Load Signature Fields" to add fields to the document</li>
  <li>
    <strong>First click</strong> on a field changes it to "click to
    sign"
  </li>
  <li>
    Clicking <strong>elsewhere</strong> reverts the field back to
    "sign here"
  </li>
  <li>
    <strong>Second click</strong> on an active field opens the
    signing interface
  </li>
  <li>After signing, the overlay is removed automatically</li>
</ol>
```

Replace with:
```tsx
<ol>
  <li>Click "Load Form Fields" to populate the document</li>
  <li>
    Fill in the <strong>text fields</strong>, toggle{" "}
    <strong>checkboxes</strong>, and select a{" "}
    <strong>radio option</strong>
  </li>
  <li>
    <strong>First click</strong> on a signature field changes it
    to "click to sign"
  </li>
  <li>
    Clicking <strong>elsewhere</strong> reverts it back to "sign
    here"
  </li>
  <li>
    <strong>Second click</strong> on an active field opens the
    signing interface
  </li>
  <li>After signing, the overlay is removed automatically</li>
</ol>
```

**Step 3: Verify in browser**

- Button reads "Load Form Fields"
- Sidebar instructions list all field types

**Step 4: Commit**

```bash
git add app/web-sdk/two-click-signature-demo/viewer.tsx
git commit -m "feat: update button text and sidebar instructions for new form fields"
```

---

## Final Verification

1. Click "Load Form Fields" — all 4 rows of non-signature fields appear above the signature rows
2. Interact with each field type — text, checkboxes, radio
3. Click a signature field — "sign here" → "click to sign"
4. Click a text/checkbox/radio field — signature field reverts to "sign here" ✓
5. Click "Load Form Fields" a second time — page reloads cleanly, no duplicate labels
6. Complete a signature — overlay removes ✓
