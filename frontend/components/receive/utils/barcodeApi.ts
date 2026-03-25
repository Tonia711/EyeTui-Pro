export const extractSerialNumberSmart = async (
  apiBaseUrl: string,
  barcode: string,
): Promise<{ sn: string | null; type?: string; power?: string } | null> => {
  try {
    const res = await fetch(`${apiBaseUrl}/barcode/extract-sn-smart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode }),
    });

    if (!res.ok) {
      throw new Error(`Smart parser API failed: ${res.status}`);
    }

    const result = await res.json();
    return {
      sn: result.serial_number || null,
      type: result.type,
      power: result.power,
    };
  } catch (error) {
    console.warn(
      "[BARCODE SCANNER] Smart extraction failed, using fallback:",
      error,
    );
    return null;
  }
};
