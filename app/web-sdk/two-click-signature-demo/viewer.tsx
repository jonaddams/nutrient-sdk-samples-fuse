"use client";

/**
 * Two-Click Signature Demo - Minimal Implementation
 *
 * Demonstrates custom signature behavior requiring two clicks:
 * 1. First click: Shows "click to sign" text
 * 2. Second click: Opens the signing UI
 */

import type { Instance } from "@nutrient-sdk/viewer";
import { useEffect, useRef, useState } from "react";
import "./styles.css";

export default function TwoClickSignatureViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<Instance | null>(null);
  const hasLoadedRef = useRef(false);
  const [status, setStatus] = useState<string>("");

  /**
   * Updates signed field overlays by checking for overlapping annotations
   */
  const updateSignedFieldOverlays = async () => {
    const instance = instanceRef.current;
    const NV = window.NutrientViewer;
    if (!instance || !NV) return;

    try {
      const formFields = await instance.getFormFields();
      const totalPages = await instance.totalPageCount;

      for (const field of formFields) {
        if (field instanceof NV.FormFields.SignatureFormField) {
          const overlapping = await instance.getOverlappingAnnotations(field);

          if (overlapping.size > 0) {
            // Field is signed - mark it in customData
            for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
              const annotations = await instance.getAnnotations(pageIndex);
              const widget = annotations.find(
                (ann) =>
                  ann instanceof NV.Annotations.WidgetAnnotation &&
                  ann.formFieldName === field.name
              );

              if (widget?.customData) {
                const updatedAnnotation = widget.set("customData", {
                  ...widget.customData,
                  isSigned: true,
                  clickedOnce: false,
                });
                await instance.update(updatedAnnotation);
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
          document: "/documents/service-agreement.pdf",
          licenseKey: process.env.NEXT_PUBLIC_NUTRIENT_LICENSE_KEY,
          useCDN: true,

          /**
           * CUSTOM RENDERER: Implements two-click signature behavior
           */
          customRenderers: {
            // biome-ignore lint/suspicious/noExplicitAny: annotation type not fully available
            Annotation: ({ annotation }: any) => {
              const NV2 = window.NutrientViewer;
              if (!NV2) return null;

              // Only customize signature fields
              if (
                annotation instanceof NV2.Annotations.WidgetAnnotation &&
                annotation.customData?.type === "signature"
              ) {
                const customData = annotation.customData as {
                  signerName: string;
                  signerColor: string;
                  clickedOnce?: boolean;
                  isSigned?: boolean;
                };
                const { signerName, signerColor, clickedOnce, isSigned } = customData;

                // Skip rendering overlay for signed fields
                if (isSigned) return null;

                // Create custom overlay
                const node = document.createElement("div");
                node.className = clickedOnce
                  ? "signature-overlay clicked"
                  : "signature-overlay";
                node.setAttribute(
                  "data-form-field-name",
                  annotation.formFieldName || ""
                );

                node.style.cssText = `
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

                // Display text based on click state
                node.textContent = clickedOnce ? "click to sign" : signerName;

                /**
                 * TWO-CLICK HANDLER
                 */
                function handleClick(event: PointerEvent) {
                  event.stopImmediatePropagation();

                  const instance = instanceRef.current;
                  const NV3 = window.NutrientViewer;
                  if (!instance || !NV3) return;

                  if (!clickedOnce) {
                    // First click: Mark as clicked
                    console.log("✓ First click - showing 'click to sign'");
                    const updatedAnnotation = annotation.set("customData", {
                      ...customData,
                      clickedOnce: true,
                    });
                    instance.update(updatedAnnotation);
                  } else {
                    // Second click: Open signing UI
                    console.log("✓ Second click - opening signing UI");
                    // @ts-expect-error - Immutable.List constructor type not fully available
                    instance.setSelectedAnnotations(
                      new NV3.Immutable.List([annotation.id])
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
              }

              return null;
            },
          },
        };

        const instance = await NV.load(configuration);
        if (!isMounted) return;

        instanceRef.current = instance;

        // Listen for signature creation to update overlays
        instance.addEventListener("annotations.create", () => {
          setTimeout(() => updateSignedFieldOverlays(), 100);
          setTimeout(() => updateSignedFieldOverlays(), 300);
        });

        instance.addEventListener("annotations.update", () => {
          setTimeout(() => updateSignedFieldOverlays(), 100);
        });

        // Initial check
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
   * Load default signature fields
   */
  const handleLoadFields = async () => {
    const instance = instanceRef.current;
    const NV = window.NutrientViewer;
    if (!instance || !NV) return;

    try {
      setStatus("Loading signature fields...");

      // Clear existing fields
      const existingFields = await instance.getFormFields();
      for (const field of existingFields) {
        await instance.delete(field);
      }

      // Create signature fields for two signers
      const signers = [
        { name: "John Doe", color: "#4A90E2", x: 96, y: 553 },
        { name: "Jane Smith", color: "#7B68EE", x: 318, y: 553 },
      ];

      for (const signer of signers) {
        const fieldId = `signature-${Date.now()}-${Math.random()}`;

        const annotation = new NV.Annotations.WidgetAnnotation({
          id: fieldId,
          pageIndex: 1, // Page 2
          boundingBox: new NV.Geometry.Rect({
            left: signer.x,
            top: signer.y,
            width: 150,
            height: 50,
          }),
          formFieldName: fieldId,
          customData: {
            signerName: signer.name,
            signerColor: signer.color,
            type: "signature",
          },
        });

        const formField = new NV.FormFields.SignatureFormField({
          name: fieldId,
          // @ts-expect-error - Immutable.List constructor type not available
          annotationIds: new NV.Immutable.List([fieldId]),
        });

        await instance.create([annotation, formField]);
      }

      setStatus("Signature fields loaded!");
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
            Load Signature Fields
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Instructions</div>
          <div className="instructions">
            <ol>
              <li>Click "Load Signature Fields" to add fields to the document</li>
              <li>
                <strong>First click</strong> on a signature field shows "click
                to sign"
              </li>
              <li>
                <strong>Second click</strong> opens the signing interface
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
