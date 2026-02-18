"use client";

/**
 * Two-Click Signature Demo - Nutrient Web SDK
 *
 * Custom signature field behavior:
 * - Default: shows "sign here" on all signature fields
 * - First click: changes to "click to sign"
 * - Click elsewhere or focus away: reverts to "sign here"
 * - Second click: opens the signing UI
 */

import type { Instance } from "@nutrient-sdk/viewer";
import { useCallback, useEffect, useRef, useState } from "react";
import "./styles.css";

/**
 * Creates a non-interactive TextAnnotation to serve as a form field label.
 */
function createLabel(
  NV: NonNullable<typeof window.NutrientViewer>,
  text: string,
  x: number,
  y: number,
  width: number,
  height = 20,
) {
  return new NV.Annotations.TextAnnotation({
    pageIndex: 0,
    boundingBox: new NV.Geometry.Rect({ left: x, top: y, width, height }),
    text: { format: "plain", value: text },
    fontSize: 11,
    isBold: false,
    horizontalAlign: "left",
    verticalAlign: "center",
    locked: true,
    lockedContents: true,
    readOnly: true,
    isDeletable: false,
    isEditable: false,
    customData: { type: "form-label" },
  });
}

export default function TwoClickSignatureViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<Instance | null>(null);
  const hasLoadedRef = useRef(false);
  const [status, setStatus] = useState<string>("");

  /**
   * Tracks which annotation is currently in "click to sign" state.
   * Only one field can be active at a time.
   */
  const activeAnnotationIdRef = useRef<string | null>(null);

  /**
   * Resets the currently active annotation back to "sign here".
   * Called when the user clicks elsewhere or focuses away.
   */
  const resetActiveAnnotation = useCallback(async () => {
    const activeId = activeAnnotationIdRef.current;
    if (!activeId) return;

    activeAnnotationIdRef.current = null;

    const instance = instanceRef.current;
    const NV = window.NutrientViewer;
    if (!instance || !NV) return;

    const totalPages = instance.totalPageCount;
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const annotations = await instance.getAnnotations(pageIndex);
      const widget = annotations.find(
        (ann) =>
          ann instanceof NV.Annotations.WidgetAnnotation && ann.id === activeId,
      );
      if (widget?.customData) {
        await instance.update(
          widget.set("customData", {
            ...widget.customData,
            clickedOnce: false,
          }),
        );
        break;
      }
    }
  }, []);

  /**
   * Marks signed fields by checking for overlapping signature image annotations.
   * When a field is signed, its overlay is removed by returning null from the renderer.
   */
  const updateSignedFieldOverlays = async () => {
    const instance = instanceRef.current;
    const NV = window.NutrientViewer;
    if (!instance || !NV) return;

    try {
      const formFields = await instance.getFormFields();
      const totalPages = instance.totalPageCount;

      for (const field of formFields) {
        if (field instanceof NV.FormFields.SignatureFormField) {
          const overlapping = await instance.getOverlappingAnnotations(field);

          if (overlapping.size > 0) {
            for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
              const annotations = await instance.getAnnotations(pageIndex);
              const widget = annotations.find(
                (ann) =>
                  ann instanceof NV.Annotations.WidgetAnnotation &&
                  ann.formFieldName === field.name,
              );
              if (widget?.customData) {
                await instance.update(
                  widget.set("customData", {
                    ...widget.customData,
                    isSigned: true,
                    clickedOnce: false,
                  }),
                );
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error updating signed field overlays:", error);
    }
  };

  /**
   * Native container listener to detect "click elsewhere".
   *
   * Signature overlay handlers use pointerdown + capture:true + stopImmediatePropagation,
   * so clicks ON overlays never reach the bubble phase. Any click that does reach here
   * means the user clicked outside a custom overlay.
   *
   * Also resets any text-field overlay that was opened (activated) but not filled,
   * unless the click was on a text input itself (user repositioning cursor).
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClickElsewhere = (event: Event) => {
      resetActiveAnnotation();

      // Don't reset when clicking inside a text input (repositioning cursor)
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" &&
        (target as HTMLInputElement).type === "text"
      )
        return;

      // Reset any text-field overlay opened but not filled
      const inst = instanceRef.current;
      const NV3 = window.NutrientViewer;
      if (!inst || !NV3) return;

      (async () => {
        const annotations = await inst.getAnnotations(0);
        for (const ann of annotations) {
          if (
            ann instanceof NV3.Annotations.WidgetAnnotation &&
            ann.customData?.type === "text-field" &&
            ann.customData?.activated === true &&
            !ann.customData?.hasValue
          ) {
            await inst.update(
              ann.set("customData", { ...ann.customData, activated: false }),
            );
          }
        }
      })().catch(console.error);
    };

    container.addEventListener("pointerdown", handleClickElsewhere);

    return () => {
      container.removeEventListener("pointerdown", handleClickElsewhere);
    };
  }, [resetActiveAnnotation]);

  /**
   * Initialize Nutrient Web SDK Viewer
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only load viewer once
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !window.NutrientViewer || hasLoadedRef.current) return;

    hasLoadedRef.current = true;
    let isMounted = true;

    const loadViewer = async () => {
      const NV = window.NutrientViewer;
      if (!NV) return;

      try {
        // biome-ignore lint/suspicious/noExplicitAny: NutrientViewer configuration types not fully available
        const configuration: any = {
          container,
          document: "/documents/blank.pdf",
          licenseKey: process.env.NEXT_PUBLIC_NUTRIENT_LICENSE_KEY,
          useCDN: true,
          styleSheets: ["/form-field-styles.css"],

          /**
           * CUSTOM RENDERER: Implements two-click signature behavior
           *
           * - Default:      "sign here"
           * - After click:  "click to sign"  (customData.clickedOnce = true)
           * - After signing: overlay removed  (customData.isSigned = true)
           */
          customRenderers: {
            // biome-ignore lint/suspicious/noExplicitAny: annotation type not fully available
            Annotation: ({ annotation }: any) => {
              const NV2 = window.NutrientViewer;
              if (!NV2) return null;

              if (!(annotation instanceof NV2.Annotations.WidgetAnnotation)) {
                return null;
              }

              /**
               * TEXT FIELD OVERLAY
               *
               * Shows a styled badge (T + signer name) over the field.
               * On click: removes the overlay and focuses the native SDK input.
               */
              if (annotation.customData?.type === "text-field") {
                const { signerName, signerColor, activated, hasValue } =
                  annotation.customData as {
                    signerName: string;
                    signerColor: string;
                    activated?: boolean;
                    hasValue?: boolean;
                  };

                // Hide overlay when value present or field is being edited
                if (hasValue || activated) return null;

                const node = document.createElement("div");
                node.style.cssText = `
                  position: absolute;
                  inset: 0;
                  border: 2px solid ${signerColor};
                  background-color: ${signerColor}15;
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 0 6px;
                  cursor: text;
                  user-select: none;
                  pointer-events: auto;
                  box-sizing: border-box;
                  z-index: 1;
                `;

                const badge = document.createElement("span");
                badge.textContent = "T";
                badge.style.cssText = `
                  background-color: ${signerColor};
                  color: white;
                  font-size: 10px;
                  font-weight: bold;
                  padding: 1px 5px;
                  border-radius: 3px;
                  flex-shrink: 0;
                `;

                const nameSpan = document.createElement("span");
                nameSpan.textContent = signerName.toUpperCase();
                nameSpan.style.cssText = `
                  font-size: 10px;
                  font-weight: 600;
                  color: ${signerColor};
                  letter-spacing: 0.5px;
                `;

                node.appendChild(badge);
                node.appendChild(nameSpan);

                function handleTextFieldClick(event: PointerEvent) {
                  event.stopImmediatePropagation();
                  const instance = instanceRef.current;
                  if (!instance) return;

                  instance.update(
                    annotation.set("customData", {
                      ...annotation.customData,
                      activated: true,
                    }),
                  );

                  // Focus the SDK input after the overlay is removed
                  const c = containerRef.current;
                  setTimeout(() => {
                    c?.querySelector<HTMLInputElement>(
                      `input[name="${annotation.formFieldName}"]`,
                    )?.focus();
                  }, 100);
                }

                node.addEventListener("pointerdown", handleTextFieldClick, {
                  capture: true,
                });

                return {
                  node,
                  append: true,
                  onDisappear: () => {
                    node.removeEventListener(
                      "pointerdown",
                      handleTextFieldClick,
                      { capture: true },
                    );
                  },
                };
              }

              if (annotation.customData?.type !== "signature") {
                return null;
              }

              const customData = annotation.customData as {
                signerName: string;
                signerColor: string;
                clickedOnce?: boolean;
                isSigned?: boolean;
              };
              const { signerName, signerColor, clickedOnce, isSigned } =
                customData;

              // Field has been signed — remove the overlay
              if (isSigned) return null;

              const initials = signerName
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              const node = document.createElement("div");
              node.className = clickedOnce
                ? "signature-overlay clicked"
                : "signature-overlay";
              node.setAttribute(
                "data-form-field-name",
                annotation.formFieldName || "",
              );
              node.style.cssText = `
                position: relative;
                width: 100%;
                height: 100%;
                border: 2px solid ${signerColor};
                background-color: ${signerColor}15;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 500;
                color: #333;
                cursor: pointer;
                user-select: none;
                pointer-events: auto;
              `;

              const textSpan = document.createElement("span");
              textSpan.textContent = clickedOnce
                ? "click to sign"
                : "sign here";
              node.appendChild(textSpan);

              const initialsBadge = document.createElement("span");
              initialsBadge.textContent = initials;
              initialsBadge.style.cssText = `
                position: absolute;
                top: 2px;
                right: 3px;
                background-color: ${signerColor};
                color: white;
                font-size: 9px;
                font-weight: bold;
                font-style: normal;
                padding: 1px 4px;
                border-radius: 3px;
                letter-spacing: 0.3px;
              `;
              node.appendChild(initialsBadge);

              /**
               * TWO-CLICK HANDLER
               *
               * capture:true + stopImmediatePropagation ensures this intercepts
               * the event before the SDK's default signature UI behavior.
               *
               * First click:  marks this annotation as active ("click to sign")
               *               and resets any previously active annotation
               * Second click: opens the signing UI via setSelectedAnnotations
               */
              function handleClick(event: PointerEvent) {
                event.stopImmediatePropagation();

                const instance = instanceRef.current;
                const NV3 = window.NutrientViewer;
                if (!instance || !NV3) return;

                const isAlreadyActive =
                  activeAnnotationIdRef.current === annotation.id;

                if (isAlreadyActive) {
                  // Second click: open signing UI
                  // Leave activeAnnotationIdRef set — annotationSelection.change
                  // will reset it when the signing UI closes
                  instance.setSelectedAnnotations(
                    NV3.Immutable.List([annotation.id]),
                  );
                } else {
                  // First click: reset any other active annotation, then activate this one
                  if (activeAnnotationIdRef.current) {
                    resetActiveAnnotation();
                  }
                  activeAnnotationIdRef.current = annotation.id;
                  instance.update(
                    annotation.set("customData", {
                      ...customData,
                      clickedOnce: true,
                    }),
                  );
                }
              }

              node.addEventListener("pointerdown", handleClick, {
                capture: true,
              });

              return {
                node,
                append: true,
                onDisappear: () => {
                  node.removeEventListener("pointerdown", handleClick, {
                    capture: true,
                  });
                },
              };
            },
          },
        };

        const instance = await NV.load(configuration);
        if (!isMounted) return;

        instanceRef.current = instance;

        /**
         * annotationSelection.change handles revert-on-dismiss after the second click.
         * When the signing UI closes (cancel or apply), the annotation is deselected
         * and this event fires, resetting the "click to sign" state.
         */
        instance.addEventListener("annotationSelection.change", () => {
          resetActiveAnnotation();
        });

        // Detect signed fields after a signature is created or updated
        instance.addEventListener("annotations.create", () => {
          setTimeout(() => updateSignedFieldOverlays(), 100);
          setTimeout(() => updateSignedFieldOverlays(), 300);
        });

        instance.addEventListener("annotations.update", () => {
          setTimeout(() => updateSignedFieldOverlays(), 100);
        });

        /**
         * Keep text-field overlay visibility in sync with the field's value.
         * When the value becomes non-empty the overlay is hidden; when cleared
         * it reappears. hasValue is stored in customData so the custom renderer
         * can read it synchronously.
         */
        instance.addEventListener(
          "formFieldValues.update",
          (formFieldValues) => {
            const NV3 = window.NutrientViewer;
            if (!NV3) return;
            // biome-ignore lint/suspicious/noExplicitAny: FormFieldValues type not fully available
            const values = (formFieldValues as any).toJS() as Record<
              string,
              unknown
            >;

            (async () => {
              const annotations = await instance.getAnnotations(0);
              for (const ann of annotations) {
                if (
                  ann instanceof NV3.Annotations.WidgetAnnotation &&
                  ann.customData?.type === "text-field" &&
                  ann.formFieldName in values
                ) {
                  const rawValue = values[ann.formFieldName];
                  const hasValue =
                    typeof rawValue === "string" && rawValue.length > 0;
                  if ((ann.customData?.hasValue ?? false) !== hasValue) {
                    await instance.update(
                      ann.set("customData", {
                        ...ann.customData,
                        hasValue,
                        activated: false,
                      }),
                    );
                  }
                }
              }
            })().catch(console.error);
          },
        );

        setTimeout(() => updateSignedFieldOverlays(), 500);
      } catch (error) {
        console.error("Error loading viewer:", error);
        hasLoadedRef.current = false;
      }
    };

    loadViewer();

    return () => {
      isMounted = false;
      hasLoadedRef.current = false;
      const NV = window.NutrientViewer;
      if (container && NV) {
        NV.unload(container);
      }
    };
  }, []);

  /**
   * Load all form fields onto the document (text, checkboxes, radio, signature)
   */
  const handleLoadFields = async () => {
    const instance = instanceRef.current;
    const NV = window.NutrientViewer;
    if (!instance || !NV) return;

    try {
      setStatus("Loading form fields...");

      // Clear existing form fields (widget annotations are deleted automatically)
      const existingFields = await instance.getFormFields();
      for (const field of existingFields) {
        await instance.delete(field);
      }

      // Clear existing label annotations (TextAnnotations tagged form-label)
      const existingAnnotations = await instance.getAnnotations(0);
      const labelAnnotations = existingAnnotations.filter(
        // biome-ignore lint/suspicious/noExplicitAny: annotation type not fully available
        (ann: any) => ann.customData?.type === "form-label",
      );
      for (const label of labelAnnotations) {
        await instance.delete(label);
      }

      // ── Text fields ─────────────────────────────────────────
      const fullNameId = `text-full-name-${Date.now()}-${Math.random()}`;
      const fullNameWidget = new NV.Annotations.WidgetAnnotation({
        id: fullNameId,
        pageIndex: 0,
        formFieldName: fullNameId,
        boundingBox: new NV.Geometry.Rect({
          left: 160,
          top: 50,
          width: 280,
          height: 24,
        }),
        customData: {
          type: "text-field",
          signerName: "John Doe",
          signerColor: "#4A90E2",
          activated: false,
          hasValue: false,
        },
      });
      const fullNameField = new NV.FormFields.TextFormField({
        name: fullNameId,
        annotationIds: NV.Immutable.List([fullNameId]),
        value: "",
        required: true,
      });

      const dateId = `text-date-${Date.now()}-${Math.random()}`;
      const dateWidget = new NV.Annotations.WidgetAnnotation({
        id: dateId,
        pageIndex: 0,
        formFieldName: dateId,
        boundingBox: new NV.Geometry.Rect({
          left: 160,
          top: 100,
          width: 150,
          height: 24,
        }),
        customData: {
          type: "text-field",
          signerName: "Jane Smith",
          signerColor: "#7B68EE",
          activated: false,
          hasValue: false,
        },
      });
      const dateField = new NV.FormFields.TextFormField({
        name: dateId,
        annotationIds: NV.Immutable.List([dateId]),
        value: "",
        required: true,
      });

      await instance.create([
        createLabel(NV, "Full Name: *", 50, 52, 106),
        fullNameWidget,
        fullNameField,
        createLabel(NV, "Date: *", 50, 102, 106),
        dateWidget,
        dateField,
      ]);

      // ── Checkboxes ───────────────────────────────────────────
      const agreeId = `checkbox-agree-${Date.now()}-${Math.random()}`;
      const agreeWidget = new NV.Annotations.WidgetAnnotation({
        id: agreeId,
        pageIndex: 0,
        formFieldName: agreeId,
        boundingBox: new NV.Geometry.Rect({
          left: 50,
          top: 150,
          width: 20,
          height: 20,
        }),
      });
      const agreeField = new NV.FormFields.CheckBoxFormField({
        name: agreeId,
        annotationIds: NV.Immutable.List([agreeId]),
        options: NV.Immutable.List([
          new NV.FormOption({ label: "Agree to terms", value: "Yes" }),
        ]),
        required: true,
      });

      const updatesId = `checkbox-updates-${Date.now()}-${Math.random()}`;
      const updatesWidget = new NV.Annotations.WidgetAnnotation({
        id: updatesId,
        pageIndex: 0,
        formFieldName: updatesId,
        boundingBox: new NV.Geometry.Rect({
          left: 220,
          top: 150,
          width: 20,
          height: 20,
        }),
      });
      const updatesField = new NV.FormFields.CheckBoxFormField({
        name: updatesId,
        annotationIds: NV.Immutable.List([updatesId]),
        options: NV.Immutable.List([
          new NV.FormOption({ label: "Receive updates", value: "Yes" }),
        ]),
      });

      await instance.create([
        agreeWidget,
        agreeField,
        createLabel(NV, "Agree to terms *", 78, 150, 140),
        updatesWidget,
        updatesField,
        createLabel(NV, "Receive updates", 248, 150, 130),
      ]);

      // ── Radio buttons ────────────────────────────────────────
      const contactFieldName = `radio-contact-${Date.now()}-${Math.random()}`;
      const emailRadioId = `${contactFieldName}-email`;
      const phoneRadioId = `${contactFieldName}-phone`;

      const emailWidget = new NV.Annotations.WidgetAnnotation({
        id: emailRadioId,
        pageIndex: 0,
        formFieldName: contactFieldName,
        boundingBox: new NV.Geometry.Rect({
          left: 180,
          top: 200,
          width: 20,
          height: 20,
        }),
      });
      const phoneWidget = new NV.Annotations.WidgetAnnotation({
        id: phoneRadioId,
        pageIndex: 0,
        formFieldName: contactFieldName,
        boundingBox: new NV.Geometry.Rect({
          left: 260,
          top: 200,
          width: 20,
          height: 20,
        }),
      });
      const contactField = new NV.FormFields.RadioButtonFormField({
        name: contactFieldName,
        annotationIds: NV.Immutable.List([emailRadioId, phoneRadioId]),
        options: NV.Immutable.List([
          new NV.FormOption({ label: "Email", value: "email" }),
          new NV.FormOption({ label: "Phone", value: "phone" }),
        ]),
        defaultValue: "email",
        required: true,
      });

      await instance.create([
        createLabel(NV, "Preferred contact: *", 50, 202, 135),
        emailWidget,
        phoneWidget,
        contactField,
        createLabel(NV, "Email", 206, 202, 45),
        createLabel(NV, "Phone", 286, 202, 45),
      ]);

      // Two rows of signature fields, 100px apart
      const fields = [
        { name: "John Doe", color: "#4A90E2", x: 96, y: 300 },
        { name: "Jane Smith", color: "#7B68EE", x: 318, y: 300 },
        { name: "John Doe", color: "#4A90E2", x: 96, y: 400 },
        { name: "Jane Smith", color: "#7B68EE", x: 318, y: 400 },
      ];

      for (const field of fields) {
        const fieldId = `signature-${Date.now()}-${Math.random()}`;

        const annotation = new NV.Annotations.WidgetAnnotation({
          id: fieldId,
          pageIndex: 0,
          boundingBox: new NV.Geometry.Rect({
            left: field.x,
            top: field.y,
            width: 150,
            height: 50,
          }),
          formFieldName: fieldId,
          customData: {
            signerName: field.name,
            signerColor: field.color,
            type: "signature",
          },
        });

        const formField = new NV.FormFields.SignatureFormField({
          name: fieldId,
          annotationIds: NV.Immutable.List([fieldId]),
        });

        await instance.create([annotation, formField]);
      }

      setStatus("Form fields loaded!");
      setTimeout(() => setStatus(""), 2000);
    } catch (error) {
      console.error("Error loading fields:", error);
      setStatus("Error loading fields");
      setTimeout(() => setStatus(""), 3000);
    }
  };

  return (
    <div className="demo-wrapper">
      {/* Sidebar */}
      <div className="demo-sidebar">
        <div className="sidebar-section">
          <div className="sidebar-label">Actions</div>
          <button
            type="button"
            className="load-fields-btn"
            onClick={handleLoadFields}
          >
            Load Form Fields
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Instructions</div>
          <div className="instructions">
            <ol>
              <li>Click "Load Form Fields" to populate the document</li>
              <li>
                Fill in the <strong>text fields</strong>, toggle{" "}
                <strong>checkboxes</strong>, and select a{" "}
                <strong>radio option</strong>
              </li>
              <li>
                <strong>First click</strong> on a signature field changes it to
                "click to sign"
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
          </div>
        </div>
      </div>

      {/* Viewer */}
      <section
        ref={containerRef}
        className="demo-viewer"
        aria-label="PDF Viewer"
      />

      {/* Status */}
      {status && (
        <div className="status-overlay">
          <div className="status-message">{status}</div>
        </div>
      )}
    </div>
  );
}
