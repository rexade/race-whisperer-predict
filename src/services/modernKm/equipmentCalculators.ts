
export const calculateShoeAdjustment = (frontShoes: string, backShoes: string): number => {
  let adjustment = 0;
  if (frontShoes === "0" || frontShoes === "") adjustment -= 0.1;
  if (backShoes === "0" || backShoes === "") adjustment -= 0.1;
  return adjustment;
};

export const calculateSulkyAdjustment = (sulkyType: string): number => {
  if (sulkyType === "AM") return -0.2;
  return 0;
};
