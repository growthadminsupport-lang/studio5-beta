import { ageInMonths } from "./growth";

// Choices and defaults for the illustrated child avatar (components/ChildProfile/ChildAvatar.jsx).

export const BABY_UNTIL_MONTHS = 36;

export const SKIN_TONES = [
  { id: "fair", label: "Light", swatch: "#f6cdb2" },
  { id: "rosy", label: "Light pink", swatch: "#fbe1da" },
  { id: "tan", label: "Tan", swatch: "#e2a487" },
  { id: "deep", label: "Deep", swatch: "#7a4b3a" },
];

export const HAIR_COLORS = [
  { hex: "#1f1a17", label: "Black" },
  { hex: "#3b2416", label: "Dark brown" },
  { hex: "#6b4226", label: "Brown" },
  { hex: "#9a6a3e", label: "Light brown" },
  { hex: "#d6b25e", label: "Blonde" },
  { hex: "#a33a22", label: "Red" },
];

export const AVATAR_SETS = {
  baby: { aspect: 0.748, hair: 10, outfits: 6, accessories: [1, 2, 6, 10] },
  young: { aspect: 1.0058, hair: 9, accessories: [2] },
};

export function hairCount(version) {
  return AVATAR_SETS[version].hair;
}
export const BABY_OUTFITS = AVATAR_SETS.baby.outfits;

export function avatarVersion(dateOfBirth) {
  return dateOfBirth && ageInMonths(dateOfBirth, new Date()) >= BABY_UNTIL_MONTHS ? "young" : "baby";
}

/** The saved avatar, with sensible defaults for anything not chosen yet. */
export function withDefaults(avatar, sex) {
  const girl = sex !== "MALE";
  return {
    skin: avatar?.skin ?? "fair",
    babyHair: avatar?.babyHair ?? (girl ? 2 : 9),
    youngHair: avatar?.youngHair ?? (girl ? 7 : 5),
    hairColor: avatar?.hairColor ?? HAIR_COLORS[0].hex,
    babyOutfit: avatar?.babyOutfit ?? (girl ? 1 : 6),
  };
}

