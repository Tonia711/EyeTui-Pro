import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { extractSerialNumberSmart } from "../utils/barcodeApi";
import { parseGS1Frontend } from "../utils/gs1";
import { correctBarcodeErrors, is1DBarcode, is2DCode, type DetectedCode } from "../utils/barcode";

interface ParsedEntry {
  sn: string;
  type?: string;
  power?: string;
}

interface UseCameraCaptureParams {
  apiBaseUrl: string;
  showStudyMode: boolean;
  addEntries: (
    items: {
      sn: string;
      date?: string;
      company?: string;
      type?: string;
      power?: string;
      originalBarcode?: string;
    }[],
    // extra args allowed
  ) => void;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  setUploadMessage: Dispatch<SetStateAction<string>>;
}

export const useCameraCapture = ({
  apiBaseUrl,
  showStudyMode,
  addEntries,
  setErrorMessage,
  setUploadMessage,
}: UseCameraCaptureParams) => {
  const [showCamera, setShowCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [isFrontCamera, setIsFrontCamera] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const lastDecodeErrorTsRef = useRef<number>(0);
  const lastScanTsRef = useRef<number>(0);
  const lastScanTextRef = useRef<string>("");

  const updateLastScanned = (sn: string) => {
    setLastScanned(sn);
    setTimeout(() => setLastScanned((prev) => (prev === sn ? null : prev)), 1500);
  };

  const startCamera = () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage(
        "Camera access is unavailable. Please use HTTPS and a supported browser.",
      );
      return;
    }
    setShowCamera(true);
    setUploadMessage("");
    setErrorMessage("");
  };

  const stopCamera = () => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;

    setShowCamera(false);
    setIsScanning(false);

    const v = videoRef.current;
    const s = v?.srcObject as MediaStream | undefined;
    s?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;

    setCapturedDataUrl(null);
    setProcessing(false);

    setErrorMessage((prev) => {
      if (
        prev.includes("No barcode detected") ||
        (prev.includes("Detected") && prev.includes("but unable to extract")) ||
        prev.includes("Serial number from") ||
        prev.includes("Serial number recognized") ||
        prev.includes("Please adjust angle/lighting")
      ) {
        return "";
      }
      return prev;
    });
  };

  const parseBarcodePayload = async (
    barcodeData: string | string[],
    merge: boolean,
  ) => {
    if (typeof barcodeData === "string") {
      const frontendResult = parseGS1Frontend(barcodeData);
      if (frontendResult && frontendResult.sn && frontendResult.type && frontendResult.power) {
        console.log(`[PARSE] Frontend parsing complete:`, frontendResult);
        return frontendResult;
      } else if (frontendResult && frontendResult.sn) {
        console.log(
          `[PARSE] Frontend got SN but missing type/power, trying backend...`,
        );
      }
    }

    const res = await fetch(`${apiBaseUrl}/parse-barcode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode_data: barcodeData, merge }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Parse barcode failed");
    }
    const backendResult = (await res.json()) as {
      sn?: string;
      model?: string;
      power?: string;
    };

    if (typeof barcodeData === "string") {
      const frontendResult = parseGS1Frontend(barcodeData);
      if (frontendResult) {
        return {
          sn: frontendResult.sn || backendResult.sn,
          type: frontendResult.type || backendResult.model,
          power: frontendResult.power || backendResult.power,
        };
      }
    }

    return {
      sn: backendResult.sn,
      type: backendResult.model,
      power: backendResult.power,
    };
  };

  const parseBarcodesToEntries = async (codes: string[]): Promise<ParsedEntry[]> => {
    const cleaned = Array.from(new Set(codes.map((c) => c?.trim()).filter(Boolean)));
    if (!cleaned.length) return [];

    const individualResults = await Promise.all(
      cleaned.map(async (code) => {
        try {
          const smart = await extractSerialNumberSmart(apiBaseUrl, code);
          if (smart?.sn) {
            const result = {
              sn: smart.sn,
              type: smart.type || undefined,
              power: smart.power || undefined,
            } as ParsedEntry;
            console.log(`[PARSE] Smart parsed entry:`, result);
            return result;
          }

          const parsed = await parseBarcodePayload(code, false);
          console.log(
            `[PARSE] Backend response for "${code.substring(0, 30)}...":`,
            parsed,
          );
          const isValidSN =
            parsed.sn || (code.match(/^\d{10,}$/) && !code.startsWith("01") ? code : null);
          const result = {
            sn: isValidSN || undefined,
            type: parsed.type || undefined,
            power: parsed.power || undefined,
          } as ParsedEntry;
          console.log(`[PARSE] Parsed entry:`, result);
          return result;
        } catch {
          const isValidSN =
            code.match(/^\d{10,}$/) && !code.startsWith("01") ? code : undefined;
          return { sn: isValidSN } as ParsedEntry;
        }
      }),
    );

    const entriesWithSN = individualResults.filter((e) => e.sn);
    const entriesWithTypePowerOnly = individualResults.filter(
      (e) => !e.sn && (e.type || e.power),
    );

    const score = (e: ParsedEntry) => Number(Boolean(e.type)) + Number(Boolean(e.power));
    const map = new Map<string, ParsedEntry>();
    for (const e of entriesWithSN) {
      const existing = map.get(e.sn!);
      if (!existing || score(e) > score(existing)) map.set(e.sn!, e);
    }

    if (entriesWithTypePowerOnly.length > 0 && entriesWithSN.length > 0) {
      const bestTypePower = entriesWithTypePowerOnly.reduce((best, current) => {
        if (score(current) > score(best)) return current;
        return best;
      }, entriesWithTypePowerOnly[0]);

      for (const [sn, entry] of map.entries()) {
        if (!entry.type || !entry.power) {
          map.set(sn, {
            sn: entry.sn,
            type: entry.type || bestTypePower.type,
            power: entry.power || bestTypePower.power,
          });
        }
      }
    }

    const allEntriesHaveCompleteInfo = Array.from(map.values()).every(
      (e) => e.type && e.power,
    );
    if (cleaned.length > 1 && !allEntriesHaveCompleteInfo) {
      try {
        const merged = await parseBarcodePayload(cleaned, true);
        if (merged.type || merged.power) {
          for (const [sn, entry] of map.entries()) {
            if (!entry.type || !entry.power) {
              map.set(sn, {
                sn: entry.sn,
                type: entry.type || merged.type,
                power: entry.power || merged.power,
              });
            }
          }

          if (merged.sn && !map.has(merged.sn)) {
            map.set(merged.sn, {
              sn: merged.sn,
              type: merged.type,
              power: merged.power,
            });
          }
        }
      } catch {
        // ignore merge failures
      }
    }

    const finalEntries = Array.from(map.values());
    console.log(`[PARSE] Final entries: ${finalEntries.length} product(s)`, finalEntries);
    return finalEntries;
  };

  const startLiveDecode = async () => {
    if (!videoRef.current) return;
    if (scannerControlsRef.current) return;

    try {
      setIsScanning(true);

      const localReader = new BrowserMultiFormatReader();
      scannerRef.current = localReader;

      const controls = await localReader.decodeFromVideoElement(
        videoRef.current,
        (result, err) => {
          if (result) {
            const text = result.getText().trim();
            if (!text) return;

            const now = Date.now();
            if (text === lastScanTextRef.current && now - lastScanTsRef.current < 1500) return;

            lastScanTextRef.current = text;
            lastScanTsRef.current = now;

            parseBarcodePayload(text, false)
              .then((parsed) => {
                if (parsed.sn) {
                  const isSimpleNumericSN = text.match(/^\d{10,11}$/) !== null;
                  const isGS1Format = text.startsWith("01") && text.length > 20;

                  if (isSimpleNumericSN && parsed.sn === text) {
                    addEntries([
                      {
                        sn: parsed.sn,
                        type: parsed.type,
                        power: parsed.power,
                        originalBarcode: showStudyMode ? text : undefined,
                      },
                    ]);
                    updateLastScanned(parsed.sn);
                  } else if (isGS1Format || parsed.sn !== text) {
                    addEntries([
                      {
                        sn: parsed.sn,
                        type: parsed.type,
                        power: parsed.power,
                        originalBarcode: showStudyMode ? text : undefined,
                      },
                    ]);
                    updateLastScanned(parsed.sn);
                  } else {
                    console.warn(
                      `[SCAN] Skipping potentially partial SN: ${text.substring(0, 30)}...`,
                    );
                  }
                } else {
                  console.warn(`[SCAN] No SN parsed from: ${text.substring(0, 30)}...`);
                }
              })
              .catch((parseErr) => {
                const isSimpleNumericSN = text.match(/^\d{10,11}$/) !== null;
                const isGS1Format = text.startsWith("01") && text.length > 20;

                if (isSimpleNumericSN && !isGS1Format) {
                  console.warn(
                    `[SCAN] Parse failed, using raw text as SN (fallback): ${text.substring(
                      0,
                      30,
                    )}...`,
                  );
                  addEntries([
                    {
                      sn: text,
                      originalBarcode: showStudyMode ? text : undefined,
                    },
                  ]);
                  updateLastScanned(text);
                } else {
                  console.warn(
                    `[SCAN] Failed to parse and not a simple SN: ${text.substring(0, 30)}...`,
                    parseErr,
                  );
                }
              });
            addEntries([
              {
                sn: text,
                originalBarcode: showStudyMode ? text : undefined,
              },
            ]);
            updateLastScanned(text);
          }

          if (err) {
            if ((err as any).name === "NotFoundException") return;
            const now = Date.now();
            if (now - lastDecodeErrorTsRef.current > 2000) {
              console.error(err);
              lastDecodeErrorTsRef.current = now;
            }
          }
        },
      );

      scannerControlsRef.current = controls;
    } catch (e) {
      console.error(e);
      setErrorMessage("Unable to start live scan.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleCaptureAndScan = async () => {
    if (!videoRef.current) return;

    setErrorMessage("");
    try {
      const video = videoRef.current;

      const videoWidth = video.videoWidth || video.clientWidth || 1280;
      const videoHeight = video.videoHeight || video.clientHeight || 720;
      const dpr = window.devicePixelRatio || 1;

      console.log(
        `[EXTRACT] Video dimensions: ${videoWidth}x${videoHeight}, DPR: ${dpr}`,
      );

      const optimalSize = 1800;
      let targetWidth = videoWidth;
      let targetHeight = videoHeight;

      if (videoWidth > optimalSize || videoHeight > optimalSize) {
        const scale = optimalSize / Math.max(videoWidth, videoHeight);
        targetWidth = Math.floor(videoWidth * scale);
        targetHeight = Math.floor(videoHeight * scale);
      } else if (videoWidth < 1000 || videoHeight < 1000) {
        const scale = 1000 / Math.min(videoWidth, videoHeight);
        targetWidth = Math.floor(videoWidth * scale);
        targetHeight = Math.floor(videoHeight * scale);
      }

      targetWidth = Math.max(targetWidth, 1000);
      targetHeight = Math.max(targetHeight, 1000);

      console.log(`[EXTRACT] Target canvas size: ${targetWidth}x${targetHeight}`);

      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvasRef.current = canvas;
      }
      canvas.width = Math.floor(targetWidth * dpr);
      canvas.height = Math.floor(targetHeight * dpr);

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas not supported");

      ctx.save();
      ctx.scale(dpr, dpr);

      if (isFrontCamera) {
        ctx.translate(targetWidth, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      ctx.restore();

      console.log(
        `[EXTRACT] Captured canvas: ${canvas.width}x${canvas.height} (video: ${videoWidth}x${videoHeight})`,
      );
      console.log(
        `[EXTRACT] Canvas actual size: ${canvas.width}x${canvas.height}, scaled size: ${targetWidth}x${targetHeight}`,
      );

      const dataUrl = canvas.toDataURL("image/png");
      setCapturedDataUrl(dataUrl);
      console.log(
        `[EXTRACT] Display image set (user sees this): ${dataUrl.substring(0, 50)}...`,
      );

      const stream = video.srcObject as MediaStream | null;
      stream?.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;

      setProcessing(true);

      const processedCanvases: Array<{ canvas: HTMLCanvasElement; label: string }> = [];

      const createProcessedCanvas = (
        label: string,
        processor: (data: Uint8ClampedArray) => void,
      ): HTMLCanvasElement => {
        const procCanvas = document.createElement("canvas");
        procCanvas.width = canvas.width;
        procCanvas.height = canvas.height;
        const pctx = procCanvas.getContext("2d", { willReadFrequently: true });
        if (!pctx) throw new Error("Canvas processing failed");

        pctx.drawImage(canvas, 0, 0);
        const imageData = pctx.getImageData(0, 0, procCanvas.width, procCanvas.height);
        processor(imageData.data);
        pctx.putImageData(imageData, 0, 0);

        return procCanvas;
      };

      const highContrastCanvas = createProcessedCanvas("high-contrast", (data) => {
        const contrastFactor = 2.5;
        const brightnessAdjust = 20;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.max(
            0,
            Math.min(255, (data[i] - 128) * contrastFactor + 128 + brightnessAdjust),
          );
          data[i + 1] = Math.max(
            0,
            Math.min(255, (data[i + 1] - 128) * contrastFactor + 128 + brightnessAdjust),
          );
          data[i + 2] = Math.max(
            0,
            Math.min(255, (data[i + 2] - 128) * contrastFactor + 128 + brightnessAdjust),
          );
        }
      });
      processedCanvases.push({ canvas: highContrastCanvas, label: "high-contrast" });

      const processedCanvas = highContrastCanvas;

      console.log(
        `[EXTRACT] Created ${processedCanvases.length} preprocessed versions: ${processedCanvases
          .map((c) => c.label)
          .join(", ")}`,
      );
      console.log(`[EXTRACT] Canvas size: ${canvas.width}x${canvas.height}`);

      console.log(
        `[EXTRACT] Display image (capturedDataUrl): ${canvas.width}x${canvas.height} (from original canvas)`,
      );
      console.log(
        `[EXTRACT] Extraction images: original canvas + ${processedCanvases.length} preprocessed versions`,
      );

      const allDetectedCodes: DetectedCode[] = [];

      const DETECTOR_ATTEMPTS = 3;
      const ZXING_ATTEMPTS = 3;

      const BD: any = (window as any).BarcodeDetector;
      console.log("[EXTRACT] BarcodeDetector available:", !!BD);
      if (BD) {
        try {
          const detector = new BD({
            formats: [
              "code_128",
              "code_39",
              "code_93",
              "ean_13",
              "ean_8",
              "upc_a",
              "upc_e",
              "qr_code",
              "data_matrix",
            ],
          });

          const canvasesToTry = [
            ...processedCanvases,
            { canvas: canvas, label: "original" },
          ];

          for (const { canvas: testCanvas, label } of canvasesToTry) {
            for (let attempt = 0; attempt < DETECTOR_ATTEMPTS; attempt++) {
              try {
                let imageSource: ImageBitmapSource = testCanvas;
                try {
                  if (typeof createImageBitmap !== "undefined") {
                    imageSource = await createImageBitmap(testCanvas);
                  }
                } catch {
                  imageSource = testCanvas as unknown as ImageBitmapSource;
                }

                const codes: Array<{ rawValue: string }> | undefined =
                  await detector.detect(imageSource);

                console.log(
                  `[EXTRACT] BarcodeDetector found codes on ${label} (attempt ${
                    attempt + 1
                  }):`,
                  codes?.length || 0,
                );
                if (codes && codes.length > 0) {
                  console.log(
                    `[EXTRACT] BarcodeDetector raw codes:`,
                    codes.map((c: any) => ({
                      format: c.format || "unknown",
                      rawValue: c.rawValue?.substring(0, 50),
                    })),
                  );
                }
                if (codes && codes.length > 0) {
                  let newCodesCount = 0;
                  codes.forEach((c: any) => {
                    let code =
                      c.rawValue?.trim() || c.value?.trim() || c.data?.trim() || "";
                    const format = c.format;
                    if (!code) return;

                    code = correctBarcodeErrors(code);

                    if (c.rawValue && c.rawValue.length > 50) {
                      console.log(
                        `[EXTRACT] Full rawValue length: ${c.rawValue.length}, first 50: ${c.rawValue.substring(0, 50)}`,
                      );
                    }

                    const existing = allDetectedCodes.find((dc) => dc.text === code);
                    if (existing) {
                      if (!existing.format || (is1DBarcode(format) && is2DCode(existing.format))) {
                        existing.format = format;
                      }
                      return;
                    }

                    allDetectedCodes.push({ text: code, format });
                    newCodesCount++;
                    console.log(
                      `[EXTRACT] Added new BD code (${format}): ${code.substring(0, 30)}...`,
                    );
                  });
                  if (newCodesCount > 0) {
                    console.log(
                      `[EXTRACT] Added ${newCodesCount} new code(s) from ${label} (total: ${allDetectedCodes.length})`,
                    );
                  }
                  break;
                } else {
                  if (attempt < DETECTOR_ATTEMPTS - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 60));
                  }
                }
              } catch (e) {
                console.warn(
                  `[EXTRACT] BarcodeDetector error on ${label} (attempt ${attempt + 1}):`,
                  e,
                );
              }
            }
          }
        } catch (e) {
          console.error("BarcodeDetector failed:", e);
        }
      }

      const onceReader = new BrowserMultiFormatReader();
      const detectedCodes: DetectedCode[] = [];

      const canvasesToTry = [
        ...processedCanvases,
        { canvas: canvas, label: "original" },
      ];

      for (const { canvas: testCanvas, label } of canvasesToTry) {
        for (let attempt = 0; attempt < ZXING_ATTEMPTS; attempt++) {
          try {
            const res = await onceReader.decodeFromCanvas(testCanvas);
            const text = res.getText().trim();
            if (text) {
              console.log(
                `[EXTRACT] ZXing detected code from ${label} canvas (attempt ${attempt + 1}):`,
                text,
              );
              const existing = detectedCodes.find((dc) => dc.text === text);
              if (!existing) {
                detectedCodes.push({ text, format: undefined });
                console.log(
                  `[EXTRACT] Added new ZXing code from ${label} (total: ${detectedCodes.length})`,
                );
              }
              break;
            } else {
              if (attempt < ZXING_ATTEMPTS - 1) {
                await new Promise((resolve) => setTimeout(resolve, 60));
              }
            }
          } catch {
            if (attempt < ZXING_ATTEMPTS - 1) {
              console.log(
                `[EXTRACT] ZXing found no barcode from ${label} canvas on first attempt, continuing...`,
              );
            }
          }
        }
      }

      detectedCodes.forEach((code) => {
        if (code && code.text) {
          const correctedText = correctBarcodeErrors(code.text);

          const existing = allDetectedCodes.find((dc) => dc.text === correctedText);
          if (!existing) {
            allDetectedCodes.push({ ...code, text: correctedText });
          } else if (!existing.format && code.format) {
            existing.format = code.format;
          }
        }
      });

      console.log("[EXTRACT] Attempting region-based scanning...");
      const regionCanvas = document.createElement("canvas");
      const regionCtx = regionCanvas.getContext("2d", { willReadFrequently: true });
      if (regionCtx) {
        regionCanvas.width = processedCanvas.width;

        const tryDecodeRegion = async (
          sx: number,
          sy: number,
          sw: number,
          sh: number,
          label: string,
          sourceCanvas: HTMLCanvasElement,
        ) => {
          regionCanvas.height = sh;
          regionCtx.clearRect(0, 0, regionCanvas.width, regionCanvas.height);
          regionCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

          const BD: any = (window as any).BarcodeDetector;
          if (BD) {
            try {
              const detector = new BD({
                formats: [
                  "code_128",
                  "code_39",
                  "code_93",
                  "ean_13",
                  "ean_8",
                  "upc_a",
                  "upc_e",
                  "qr_code",
                  "data_matrix",
                ],
              });
              const regionCodes:
                | Array<{ rawValue: string; format?: string }>
                | undefined = await detector.detect(
                regionCanvas as unknown as ImageBitmapSource,
              );
              if (regionCodes && regionCodes.length) {
                console.log(
                  `[EXTRACT] BD found ${regionCodes.length} code(s) in ${label}`,
                );
                regionCodes.forEach((c: any) => {
                  const code = c.rawValue?.trim();
                  const format = c.format;
                  if (!code) return;

                  const existing = detectedCodes.find((dc) => dc.text === code);
                  if (!existing) {
                    detectedCodes.push({ text: code, format });
                    console.log(
                      `[EXTRACT] Added new BD code from ${label} (${format}, total: ${detectedCodes.length})`,
                    );
                  } else if (
                    !existing.format ||
                    (is1DBarcode(format) && is2DCode(existing.format))
                  ) {
                    existing.format = format;
                  }
                });
              }
            } catch {
              // silently continue
            }
          }

          try {
            const res = await onceReader.decodeFromCanvas(regionCanvas);
            const text = res.getText().trim();
            if (text) {
              console.log(`[EXTRACT] ZXing detected code from ${label}:`, text);
              const existing = detectedCodes.find((dc) => dc.text === text);
              if (!existing) {
                detectedCodes.push({ text, format: undefined });
                console.log(
                  `[EXTRACT] Added new ZXing code from ${label} (total: ${detectedCodes.length})`,
                );
              }
            }
          } catch {
            // ignore
          }
        };

        const scanVersions = [{ canvas: highContrastCanvas, label: "high-contrast" }];

        for (const { canvas: scanCanvas, label: scanLabel } of scanVersions) {
          console.log(`[EXTRACT] Scanning with ${scanLabel} preprocessing...`);

          if (allDetectedCodes.length >= 4) {
            console.log(
              `[EXTRACT] Already found ${allDetectedCodes.length} total codes, skipping region scanning`,
            );
            break;
          }

          const OVERLAP_RATIO = 0.5;

          const verticalBands = 12;
          const bandHeight = scanCanvas.height / verticalBands;
          console.log(
            `[EXTRACT] STAGE 1 - Vertical band scanning (${scanLabel}): ${verticalBands} bands with 50% overlap`,
          );
          for (let i = 0; i < verticalBands; i++) {
            if (allDetectedCodes.length >= 4) {
              console.log(
                `[EXTRACT] Stage 1 complete: found ${allDetectedCodes.length} codes`,
              );
              break;
            }

            const bandTop = Math.max(
              0,
              bandHeight * i - bandHeight * OVERLAP_RATIO * 0.5,
            );
            const bandHeightWithOverlap = bandHeight * (1 + OVERLAP_RATIO);

            await tryDecodeRegion(
              0,
              bandTop,
              scanCanvas.width,
              bandHeightWithOverlap,
              `${scanLabel} vertical band ${i + 1}`,
              scanCanvas,
            );
          }

          if (allDetectedCodes.length < 4) {
            const gridRows = 8;
            const gridCols = 6;
            const cellWidth = scanCanvas.width / gridCols;
            const cellHeight = scanCanvas.height / gridRows;

            console.log(
              `[EXTRACT] STAGE 2 - Fine grid scanning (${scanLabel}): ${gridRows}x${gridCols} grid with 50% overlap`,
            );
            for (let row = 0; row < gridRows; row++) {
              if (allDetectedCodes.length >= 4) {
                console.log(
                  `[EXTRACT] Stage 2 complete: found ${allDetectedCodes.length} codes`,
                );
                break;
              }
              for (let col = 0; col < gridCols; col++) {
                if (allDetectedCodes.length >= 4) break;

                const cellX = Math.max(
                  0,
                  cellWidth * col - cellWidth * OVERLAP_RATIO * 0.5,
                );
                const cellY = Math.max(
                  0,
                  cellHeight * row - cellHeight * OVERLAP_RATIO * 0.5,
                );
                const cellWidthWithOverlap = cellWidth * (1 + OVERLAP_RATIO);
                const cellHeightWithOverlap = cellHeight * (1 + OVERLAP_RATIO);

                await tryDecodeRegion(
                  cellX,
                  cellY,
                  cellWidthWithOverlap,
                  cellHeightWithOverlap,
                  `${scanLabel} grid [${row},${col}]`,
                  scanCanvas,
                );
              }
            }
          }

          if (allDetectedCodes.length < 4) {
            const horizontalBands = 4;
            const bandWidth = scanCanvas.width / horizontalBands;

            console.log(
              `[EXTRACT] STAGE 3 - Horizontal band scanning (${scanLabel}): ${horizontalBands} bands with 50% overlap`,
            );
            for (let i = 0; i < horizontalBands; i++) {
              if (allDetectedCodes.length >= 4) {
                console.log(
                  `[EXTRACT] Stage 3 complete: found ${allDetectedCodes.length} codes`,
                );
                break;
              }

              const bandLeft = Math.max(
                0,
                bandWidth * i - bandWidth * OVERLAP_RATIO * 0.5,
              );
              const bandWidthWithOverlap = bandWidth * (1 + OVERLAP_RATIO);

              await tryDecodeRegion(
                bandLeft,
                0,
                bandWidthWithOverlap,
                scanCanvas.height,
                `${scanLabel} horizontal band ${i + 1}`,
                scanCanvas,
              );
            }
          }
        }
      }

      console.log(`[EXTRACT] Region scanning found ${detectedCodes.length} code(s)`);
      detectedCodes.forEach((code) => {
        if (code && code.text) {
          const correctedText = correctBarcodeErrors(code.text);

          const existing = allDetectedCodes.find((dc) => dc.text === correctedText);
          if (!existing) {
            allDetectedCodes.push({ ...code, text: correctedText });
            console.log(
              `[EXTRACT] Added region-scanned code: ${correctedText.substring(0, 30)}...`,
            );
          } else if (!existing.format && code.format) {
            existing.format = code.format;
          } else if (is1DBarcode(code.format) && is2DCode(existing.format)) {
            existing.format = code.format;
          }
        }
      });
      console.log(`[EXTRACT] Total codes after region scanning: ${allDetectedCodes.length}`);

      const frontend1DCount = allDetectedCodes.filter((dc) =>
        is1DBarcode(dc.format),
      ).length;
      const frontend2DCount = allDetectedCodes.filter((dc) => is2DCode(dc.format)).length;

      const hasLikelyNumericSN = allDetectedCodes.some((dc) => /^\d{9,20}$/.test(dc.text));
      const hasLikelyGS1 = allDetectedCodes.some(
        (dc) => dc.text.startsWith("01") && dc.text.length > 20,
      );

      const hasNumeric1D = allDetectedCodes.some(
        (dc) =>
          is1DBarcode(dc.format) &&
          /^\d{10,20}$/.test(dc.text) &&
          !dc.text.startsWith("01"),
      );

      const ENABLE_BACKEND_FALLBACK = true;
      const shouldUseBackend =
        ENABLE_BACKEND_FALLBACK &&
        allDetectedCodes.length < 4 &&
        (frontend1DCount === 0 ||
          (!hasLikelyNumericSN && !hasLikelyGS1) ||
          (frontend1DCount === 1 && !hasNumeric1D));

      if (!shouldUseBackend) {
        console.log(
          `[EXTRACT] Frontend confident (${frontend1DCount} 1D, ${frontend2DCount} 2D, numeric1D=${hasNumeric1D}, likelySN=${hasLikelyNumericSN}). Skipping backend decoding.`,
        );
      } else {
        console.log(
          `[EXTRACT] Frontend found ${allDetectedCodes.length} code(s) (${frontend1DCount} 1D, ${frontend2DCount} 2D). Attempting backend decoding for additional codes...`,
        );

        try {
          const blob: Blob = await new Promise((resolve, reject) => {
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
              "image/png",
            );
          });

          const formData = new FormData();
          formData.append("image", blob, "capture.png");

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          console.log(
            `[EXTRACT] Sending request to backend: ${apiBaseUrl}/barcode/decode`,
          );
          const requestStartTime = Date.now();

          let backendResponse: Response;
          try {
            backendResponse = await fetch(`${apiBaseUrl}/barcode/decode`, {
              method: "POST",
              body: formData,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const requestDuration = Date.now() - requestStartTime;
            console.log(
              `[EXTRACT] Backend response received in ${requestDuration}ms, status: ${backendResponse.status}`,
            );
          } catch (fetchErr: any) {
            clearTimeout(timeoutId);
            const requestDuration = Date.now() - requestStartTime;
            console.error(
              `[EXTRACT] Backend request failed after ${requestDuration}ms:`,
              fetchErr,
            );
            if (fetchErr.name === "AbortError") {
              throw new Error("TIMEOUT");
            }
            throw fetchErr;
          }

          if (backendResponse.ok) {
            const backendResult = await backendResponse.json();
            console.log("[EXTRACT] Backend decoded:", backendResult);
            if (backendResult.results && backendResult.results.length > 0) {
              backendResult.results.forEach((result: any) => {
                const code = result.text?.trim();
                const format = result.format;
                if (!code) return;

                const existing = allDetectedCodes.find((dc) => dc.text === code);
                if (!existing) {
                  allDetectedCodes.push({ text: code, format });
                  console.log(
                    `[EXTRACT] Backend found additional code (${format}):`,
                    code,
                  );
                } else if (!existing.format && format) {
                  existing.format = format;
                } else if (is1DBarcode(format) && is2DCode(existing.format)) {
                  existing.format = format;
                }
              });
            }
          } else if (backendResponse.status === 503) {
            console.warn(
              "[EXTRACT] Backend barcode service unavailable (503). Using frontend detection results only.",
            );
          } else {
            console.log(
              `[EXTRACT] Backend decode returned ${backendResponse.status}, using frontend detection results.`,
            );
          }
        } catch (backendErr: any) {
          if (backendErr.name === "AbortError" || backendErr.message === "TIMEOUT") {
            console.warn(
              "[EXTRACT] Backend barcode decode timeout (30s), using frontend detection results only.",
            );
          } else if (
            backendErr.message?.includes("Failed to fetch") ||
            backendErr.message?.includes("NetworkError")
          ) {
            console.warn(
              "[EXTRACT] Backend barcode decode network error (backend may be down), using frontend detection results only.",
            );
          } else {
            console.log(
              "[EXTRACT] Backend barcode decode failed, using frontend detection results:",
              backendErr,
            );
          }
        }
      }

      const has1DBarcodes = allDetectedCodes.some((dc) => is1DBarcode(dc.format));
      console.log(
        `[EXTRACT] Format check - Has 1D barcodes: ${has1DBarcodes}, All codes:`,
        allDetectedCodes.map((dc) => ({
          format: dc.format || "unknown",
          text: dc.text.substring(0, 30),
          is1D: is1DBarcode(dc.format),
          is2D: is2DCode(dc.format),
        })),
      );
      const filteredCodes = has1DBarcodes
        ? allDetectedCodes.filter((dc) => !is2DCode(dc.format))
        : allDetectedCodes;

      console.log(
        `[EXTRACT] After filtering - Filtered codes:`,
        filteredCodes.map((dc) => ({
          format: dc.format,
          text: dc.text.substring(0, 30),
        })),
      );

      const uniqueCodesMap = new Map<string, DetectedCode>();
      filteredCodes.forEach((dc) => {
        if (!uniqueCodesMap.has(dc.text)) {
          uniqueCodesMap.set(dc.text, dc);
        }
      });
      const uniqueCodes = Array.from(uniqueCodesMap.values());

      console.log("[EXTRACT] ========================================");
      console.log("[EXTRACT] Detection Summary:");
      console.log(`[EXTRACT] Total raw detections: ${allDetectedCodes.length}`);
      console.log(`[EXTRACT] Has 1D barcodes: ${has1DBarcodes}`);
      console.log(
        `[EXTRACT] Filtered codes (after removing 2D if 1D exists): ${filteredCodes.length}`,
      );
      console.log(`[EXTRACT] Total unique codes: ${uniqueCodes.length}`);
      console.log("[EXTRACT] All unique codes:");
      uniqueCodes.forEach((dc, idx) => {
        console.log(
          `[EXTRACT]   ${idx + 1}. [${dc.format || "unknown"}] ${dc.text.substring(0, 50)}${
            dc.text.length > 50 ? "..." : ""
          } (length: ${dc.text.length})`,
        );
      });

      const frontendCount = allDetectedCodes.filter(
        (dc) =>
          dc.format && (dc.format.includes("data_matrix") || dc.format.includes("code_128")),
      ).length;
      if (uniqueCodes.length < 4 && frontendCount > 0) {
        console.log(
          `[EXTRACT] Detected ${uniqueCodes.length} unique barcode(s) from frontend (${frontendCount} from BarcodeDetector). Expected 4 if scanning multiple boxes. Frontend results will be used.`,
        );
      } else if (uniqueCodes.length === 0) {
        console.warn(
          `[EXTRACT] ⚠️ No barcodes detected. Please check image quality and try again.`,
        );
      }
      console.log("[EXTRACT] ========================================");

      if (uniqueCodes.length > 0) {
        const codeTexts = uniqueCodes.map((dc) => dc.text);

        const parsed = await parseBarcodesToEntries(codeTexts);
        if (parsed.length > 0) {
          const missingInfo = parsed.filter((p) => !p.type || !p.power);
          if (missingInfo.length > 0) {
            console.log(
              "[OCR] Some entries missing type/power, trying OCR extraction...",
            );
            try {
              const ocrBlob: Blob = await new Promise((resolve, reject) => {
                canvas.toBlob(
                  (b) => (b ? resolve(b) : reject(new Error("OCR toBlob failed"))),
                  "image/png",
                );
              });

              const ocrFormData = new FormData();
              ocrFormData.append("image", ocrBlob, "capture.png");

              const ocrController = new AbortController();
              const ocrTimeoutId = setTimeout(() => ocrController.abort(), 30000);

              const ocrResponse = await fetch(
                `${apiBaseUrl}/ocr/extract-lens-info?extract_model=true&extract_power=true&extract_sn=false`,
                {
                  method: "POST",
                  body: ocrFormData,
                  signal: ocrController.signal,
                },
              );
              clearTimeout(ocrTimeoutId);

              if (ocrResponse.ok) {
                const ocrResult = await ocrResponse.json();
                console.log("[OCR] OCR extraction result:", ocrResult);

                if (ocrResult.success && (ocrResult.model || ocrResult.power)) {
                  missingInfo.forEach((entry) => {
                    if (!entry.type && ocrResult.model) {
                      entry.type = ocrResult.model;
                      console.log(`[OCR] Filled type from OCR: ${ocrResult.model}`);
                    }
                    if (!entry.power && ocrResult.power) {
                      entry.power = ocrResult.power;
                      console.log(`[OCR] Filled power from OCR: ${ocrResult.power}`);
                    }
                  });

                  const stillMissing = parsed.filter((p) => !p.type || !p.power);
                  if (stillMissing.length === 0) {
                    setErrorMessage("");
                    setUploadMessage(
                      `✓ All information extracted successfully (OCR confidence: ${(ocrResult.confidence * 100).toFixed(0)}%).`,
                    );
                  } else {
                    const missingSNs = stillMissing.map((p) => p.sn).join(", ");
                    setErrorMessage(
                      `Serial number recognized: ${missingSNs}. OCR found some info but not complete. Please manually enter missing Type and Power.`,
                    );
                  }
                } else {
                  const missingSNs = missingInfo.map((p) => p.sn).join(", ");
                  const hasQRCode = uniqueCodes.some((dc) => is2DCode(dc.format));
                  const codeType = hasQRCode ? "QR code" : "barcode";
                  setErrorMessage(
                    `Serial number from ${codeType} recognized: ${missingSNs}. ${hasQRCode ? "QR codes typically only contain serial number information. " : ""}OCR extraction failed. Please manually enter Type and Power.`,
                  );
                }
              } else {
                const missingSNs = missingInfo.map((p) => p.sn).join(", ");
                const hasQRCode = uniqueCodes.some((dc) => is2DCode(dc.format));
                const codeType = hasQRCode ? "QR code" : "barcode";
                setErrorMessage(
                  `Serial number from ${codeType} recognized: ${missingSNs}. ${hasQRCode ? "QR codes typically only contain serial number information. " : ""}Please manually enter Type and Power.`,
                );
              }
            } catch (ocrErr) {
              console.log("[OCR] OCR extraction failed:", ocrErr);
              const missingSNs = missingInfo.map((p) => p.sn).join(", ");
              const hasQRCode = uniqueCodes.some((dc) => is2DCode(dc.format));
              const codeType = hasQRCode ? "QR code" : "barcode";
              setErrorMessage(
                `Serial number from ${codeType} recognized: ${missingSNs}. ${hasQRCode ? "QR codes typically only contain serial number information. " : ""}Please manually enter Type and Power.`,
              );
            }
          } else {
            setErrorMessage("");
            setUploadMessage("✓ All information extracted successfully.");
          }

          addEntries(
            parsed.map((p) => {
              const originalBarcode = uniqueCodes.find((dc) => {
                return dc.text.includes(p.sn || "");
              })?.text;

              return {
                sn: p.sn,
                type: p.type,
                power: p.power,
                originalBarcode: showStudyMode ? originalBarcode : undefined,
              };
            }),
          );

          if (!showStudyMode) {
            parsed.forEach(async (p) => {
              if (p.sn) {
                const originalBarcode = uniqueCodes.find((dc) => {
                  return dc.text.includes(p.sn || "");
                })?.text;

                if (originalBarcode) {
                  try {
                    await fetch(`${apiBaseUrl}/barcode/learn`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        barcode: originalBarcode.trim(),
                        serial_number: p.sn,
                        type: p.type,
                        power: p.power,
                      }),
                    });
                    console.log("[CAPTURE PHOTO] Pattern learned automatically:", {
                      barcode: originalBarcode.substring(0, 30),
                      sn: p.sn,
                    });
                  } catch (error) {
                    console.warn("[CAPTURE PHOTO] Failed to learn pattern:", error);
                  }
                }
              }
            });
          }

          updateLastScanned(parsed[parsed.length - 1].sn);
          return;
        }

        const validSNs = codeTexts.filter((text) => {
          if (text.startsWith("01") && text.length > 20) {
            console.warn(
              `[EXTRACT] Skipping GS1 format string as SN: ${text.substring(0, 30)}...`,
            );
            return false;
          }
          return text.match(/^\d{10,}$/) !== null;
        });

        if (validSNs.length > 0) {
          addEntries(
            validSNs.map((sn) => {
              const originalBarcode = uniqueCodes.find((dc) => dc.text.includes(sn))?.text;
              return {
                sn,
                originalBarcode: showStudyMode ? originalBarcode : undefined,
              };
            }),
          );

          if (!showStudyMode) {
            validSNs.forEach(async (sn) => {
              const originalBarcode = uniqueCodes.find((dc) => dc.text.includes(sn))?.text;

              if (originalBarcode) {
                try {
                  await fetch(`${apiBaseUrl}/barcode/learn`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      barcode: originalBarcode.trim(),
                      serial_number: sn,
                    }),
                  });
                  console.log("[CAPTURE PHOTO] Pattern learned automatically:", {
                    barcode: originalBarcode.substring(0, 30),
                    sn: sn,
                  });
                } catch (error) {
                  console.warn("[CAPTURE PHOTO] Failed to learn pattern:", error);
                }
              }
            });
          }

          const hasQRCode = uniqueCodes.some((dc) => is2DCode(dc.format));
          const codeType = hasQRCode ? "QR code" : "barcode";
          setErrorMessage(
            `Serial number from ${codeType} recognized, but unable to automatically extract Type and Power information. ${hasQRCode ? "QR codes typically only contain serial number information. " : ""}Please manually enter Type and Power.`,
          );
          updateLastScanned(validSNs[validSNs.length - 1]);
          return;
        } else {
          const hasQRCode = uniqueCodes.some((dc) => is2DCode(dc.format));
          const codeType = hasQRCode ? "QR code" : "barcode";
          setErrorMessage(
            `Detected ${codeType} but unable to extract serial number. Please try again or manually enter the serial number.`,
          );
          return;
        }
      }

      throw new Error("No barcode detected");
    } catch (err: any) {
      console.error("Capture and scan failed:", err);
      setErrorMessage(
        "No barcode detected. Please adjust angle/lighting and try again.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleRetake = () => {
    setCapturedDataUrl(null);
    setErrorMessage("");

    const video = videoRef.current;
    if (video) {
      const stream = video.srcObject as MediaStream | null;
      stream?.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });
    }

    console.log(
      "[CAMERA] Camera enabled. Click 'Capture and Scan' to scan barcodes.",
    );
  };

  useEffect(() => {
    if (!showCamera || !videoRef.current) return;

    let cancelled = false;
    let reader: BrowserMultiFormatReader | null = null;
    const videoEl = videoRef.current;

    const start = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setErrorMessage(
          "Camera access is unavailable. Please use HTTPS and a supported browser.",
        );
        setShowCamera(false);
        return;
      }

      try {
        setIsScanning(true);

        reader = new BrowserMultiFormatReader();
        scannerRef.current = reader;

        const cameras = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;

        setAvailableDevices(cameras);

        const deviceId =
          selectedDeviceId || (cameras.length ? cameras[cameras.length - 1].deviceId : undefined);
        if (!selectedDeviceId && deviceId) setSelectedDeviceId(deviceId);

        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        videoEl.srcObject = stream;

        try {
          const facing = stream.getVideoTracks?.()[0]?.getSettings?.().facingMode;
          setIsFrontCamera(facing === "user");
        } catch {
          setIsFrontCamera(false);
        }

        console.log(
          "[CAMERA] Camera started. Click 'Capture and Scan' to scan barcodes.",
        );
        setIsScanning(false);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setErrorMessage(
            "Unable to start camera. Please allow access or try another browser/device.",
          );
          setShowCamera(false);
          setIsScanning(false);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;

      const s = videoEl?.srcObject as MediaStream | undefined;
      s?.getTracks().forEach((t) => t.stop());
      videoEl.srcObject = null;

      setIsScanning(false);
      setCapturedDataUrl(null);
      setProcessing(false);
    };
  }, [showCamera, selectedDeviceId, setErrorMessage]);

  useEffect(() => {
    if (!showCamera) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stopCamera();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCamera]);

  return {
    showCamera,
    setShowCamera,
    isScanning,
    lastScanned,
    capturedDataUrl,
    processing,
    availableDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    isFrontCamera,
    videoRef,
    startCamera,
    stopCamera,
    handleCaptureAndScan,
    handleRetake,
    startLiveDecode,
  };
};
