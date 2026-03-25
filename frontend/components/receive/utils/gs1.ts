export const parseGS1Frontend = (
  data: string,
): { sn?: string; type?: string; power?: string } | null => {
  if (!data.startsWith("01") || data.length < 16) {
    return null;
  }

  try {
    const cleanData = data.replace(/\x1D/g, "");

    let pos = 0;
    let sn: string | null = null;
    let model: string | null = null;
    let power: string | null = null;

    const knownModels = ["DIB00", "DIU150", "DIU100", "DCB00", "DEN00V", "DET", "DIU"];

    while (pos < cleanData.length - 1) {
      const aiCode = cleanData.substring(pos, pos + 2);
      pos += 2;

      if (aiCode === "01") {
        if (pos + 14 <= cleanData.length) {
          pos += 14;
        } else {
          break;
        }
      } else if (aiCode === "11") {
        if (pos + 6 <= cleanData.length) {
          pos += 6;
        } else {
          break;
        }
      } else if (aiCode === "17") {
        if (pos + 6 <= cleanData.length) {
          pos += 6;
        } else {
          break;
        }
      } else if (aiCode === "20") {
        if (pos + 2 <= cleanData.length) {
          pos += 2;
        } else {
          break;
        }
      } else if (aiCode === "21") {
        const remaining = cleanData.substring(pos);

        if (remaining.length >= 13 && remaining.substring(10, 13) === "240") {
          sn = remaining.substring(0, 10);
          pos += 10;

          pos += 3;
          const after240 = cleanData.substring(pos);

          let matchedModel: string | null = null;
          for (const knownModel of knownModels.sort(
            (a, b) => b.length - a.length,
          )) {
            if (after240.startsWith(knownModel)) {
              matchedModel = knownModel;
              break;
            }
          }

          if (matchedModel) {
            model = matchedModel;
            pos += matchedModel.length;

            const powerPart = cleanData.substring(pos);

            if (powerPart.length > 0 && powerPart[0] === "I" && powerPart.length > 1) {
              const digitsPart = powerPart.substring(1);
              if (digitsPart.length >= 4 && /^\d{4,}$/.test(digitsPart)) {
                if (digitsPart[0] === "0") {
                  const powerDigits = digitsPart.substring(
                    digitsPart.length - 3,
                  );
                  power = `+${powerDigits[0]}${powerDigits[1]}.${powerDigits[2]}D`;
                } else if (digitsPart.substring(0, 2) === "00") {
                  const powerDigits = digitsPart.substring(2, 5);
                  power = `+${powerDigits[0]}${powerDigits[1]}.${powerDigits[2]}D`;
                }
              } else if (digitsPart.length >= 3 && /^\d{3}$/.test(digitsPart)) {
                const powerDigits = digitsPart.substring(0, 3);
                power = `+${powerDigits[0]}${powerDigits[1]}.${powerDigits[2]}D`;
              }
            } else if (powerPart.length >= 5 && /^\d{5}$/.test(powerPart)) {
              if (powerPart.substring(0, 2) === "00") {
                const powerDigits = powerPart.substring(2, 5);
                power = `+${powerDigits[0]}${powerDigits[1]}.${powerDigits[2]}D`;
              }
            } else if (powerPart.length >= 3 && /^\d{3}$/.test(powerPart)) {
              const powerDigits = powerPart.substring(0, 3);
              power = `+${powerDigits[0]}${powerDigits[1]}.${powerDigits[2]}D`;
            }
          }
          break;
        } else {
          const alphanumericMatch = remaining.match(/^([0-9][A-Z][0-9]{10})/);
          if (alphanumericMatch) {
            sn = alphanumericMatch[1];
            pos += sn.length;
          } else {
            const numericMatch = remaining.match(/^(\d{10,20})/);
            if (numericMatch) {
              sn = numericMatch[1];
              pos += sn.length;
            } else {
              sn = remaining.trim();
              break;
            }
          }
        }
      } else if (aiCode === "24" && pos < cleanData.length && cleanData[pos] === "0") {
        pos += 1;
        const remaining = cleanData.substring(pos);

        let matchedModel: string | null = null;
        for (const knownModel of knownModels.sort(
          (a, b) => b.length - a.length,
        )) {
          if (remaining.startsWith(knownModel)) {
            matchedModel = knownModel;
            break;
          }
        }

        if (matchedModel) {
          model = matchedModel;
          pos += matchedModel.length;

          const powerPart = cleanData.substring(pos);

          if (powerPart.length > 0 && powerPart[0] === "I" && powerPart.length > 1) {
            const digitsPart = powerPart.substring(1);
            if (digitsPart.length >= 4 && /^\d{4,}$/.test(digitsPart)) {
              if (digitsPart[0] === "0") {
                const powerDigits = digitsPart.substring(
                  digitsPart.length - 3,
                );
                power = `+${powerDigits[0]}${powerDigits[1]}.${powerDigits[2]}D`;
              } else if (digitsPart.substring(0, 2) === "00") {
                const powerDigits = digitsPart.substring(2, 5);
                power = `+${powerDigits[0]}${powerDigits[1]}.${powerDigits[2]}D`;
              }
            } else if (digitsPart.length >= 3 && /^\d{3}$/.test(digitsPart)) {
              const powerDigits = digitsPart.substring(0, 3);
              power = `+${powerDigits[0]}${powerDigits[1]}.${powerDigits[2]}D`;
            }
          } else if (powerPart.length >= 5 && /^\d{5}$/.test(powerPart)) {
            if (powerPart.substring(0, 2) === "00") {
              const powerDigits = powerPart.substring(2, 5);
              power = `+${powerDigits[0]}${powerDigits[1]}.${powerDigits[2]}D`;
            }
          } else if (powerPart.length >= 3 && /^\d{3}$/.test(powerPart)) {
            const powerDigits = powerPart.substring(0, 3);
            power = `+${powerDigits[0]}${powerDigits[1]}.${powerDigits[2]}D`;
          }
        }
        break;
      } else {
        break;
      }
    }

    return sn || model || power
      ? {
          sn: sn || undefined,
          type: model || undefined,
          power: power || undefined,
        }
      : null;
  } catch (e) {
    console.warn("[FRONTEND GS1] Parse error:", e);
    return null;
  }
};
