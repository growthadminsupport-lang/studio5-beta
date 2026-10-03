import { useState } from "react";
import { Check } from "lucide-react";
import { useChildren } from "../../context/ChildrenContext";
import { errorMessage } from "../../lib/api";
import { AVATAR_SETS, BABY_OUTFITS, EYE_COLORS, HAIR_COLORS, MOUTH_LABELS, SKIN_TONES, avatarVersion, hairCount, withDefaults } from "../../lib/avatar";
import { AvatarFigure, AvatarZoom } from "./ChildAvatar";

function dueMaxIso() {
  const d = new Date(Date.now() + 300 * 86_400_000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const field =
  "w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#056559] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-teal-400";

/** `group` for a set of buttons: a <label> would forward clicks on its text to the first one. */
function Field({ label, hint, children, group }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </Tag>
  );
}

// The person who adds a child is that child's parent in GrowTH, with full say over the
// profile and who else can see it. What they call themselves is recorded too; it changes
// nothing about what they can do.
const RELATIONS = [
  { value: "PARENT", label: "Mother or father" },
  { value: "GUARDIAN", label: "Legal guardian" },
  { value: "RELATIVE", label: "Relative raising the child", hint: "For example a grandparent" },
];

const TABS = [
  { id: "skin", label: "Skin" },
  { id: "hair", label: "Hair" },
  { id: "face", label: "Face", babyOnly: true },
  { id: "clothes", label: "Clothes", babyOnly: true },
];

function Section({ title, children }) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      {children}
    </div>
  );
}

function Swatch({ color, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`relative h-10 w-10 rounded-full border border-black/10 transition active:scale-95 ${
        active ? "ring-2 ring-[#056559] ring-offset-2 dark:ring-teal-400 dark:ring-offset-slate-800" : "hover:scale-105"
      }`}
      style={{ backgroundColor: color }}
    >
      {active && <Check size={16} className="absolute inset-0 m-auto text-white drop-shadow" strokeWidth={3} />}
    </button>
  );
}

function OptionTile({ active, onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex items-center justify-center rounded-xl border-2 p-1 transition active:scale-95 ${
        active
          ? "border-[#056559] bg-[#eaf6f3] dark:border-teal-400 dark:bg-teal-500/10"
          : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/40"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Preview on top, choices underneath. The drawing follows the child's age by itself (the baby
 * until 3, then the young child), so there is nothing to switch.
 */
function AvatarEditor({ sex, dateOfBirth, avatar, onChange }) {
  const [tab, setTab] = useState("skin");
  const version = avatarVersion(dateOfBirth);
  const a = withDefaults(avatar, sex);
  const set = (patch) => onChange({ ...a, ...patch });
  const tabs = TABS.filter((t) => !t.babyOnly || version === "baby");
  const shown = tabs.some((t) => t.id === tab) ? tab : "skin";
  const range = (n) => Array.from({ length: n }, (_, i) => i + 1);
  const hairKey = version === "baby" ? "babyHair" : "youngHair";
  const zoom = (patch, size = 56) => <AvatarZoom version="baby" sex={sex} avatar={{ ...a, ...patch }} size={size} />;

  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-end justify-center rounded-xl bg-gradient-to-b from-[#eaf6f3] to-white py-3 dark:from-teal-500/10 dark:to-slate-800">
        <AvatarFigure version={version} sex={sex} avatar={a} height={170} />
      </div>
      <div role="tablist" className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={shown === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 whitespace-nowrap rounded-lg px-1 py-1.5 text-xs font-semibold transition ${
              shown === t.id
                ? "bg-white text-[#056559] shadow-sm dark:bg-slate-700 dark:text-teal-300"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 min-h-[64px]">
        {shown === "skin" && (
          <div className="flex flex-wrap gap-3">
            {SKIN_TONES.map((s) => (
              <Swatch key={s.id} color={s.swatch} label={s.label} active={a.skin === s.id} onClick={() => set({ skin: s.id })} />
            ))}
          </div>
        )}

        {shown === "hair" && (
          <>
            <Section title="Colour">
              <div className="flex flex-wrap gap-3">
                {HAIR_COLORS.map((c) => (
                  <Swatch key={c.hex} color={c.hex} label={c.label} active={a.hairColor === c.hex} onClick={() => set({ hairColor: c.hex })} />
                ))}
              </div>
            </Section>
            <Section title="Style">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {range(hairCount(version)).map((n) => (
                  <OptionTile key={n} label={`Hairstyle ${n}`} active={a[hairKey] === n} onClick={() => set({ [hairKey]: n })}>
                    {/* The whole figure, so long styles show their full length. */}
                    <AvatarFigure version={version} sex={sex} avatar={{ ...a, [hairKey]: n }} height={version === "baby" ? 92 : 72} />
                  </OptionTile>
                ))}
              </div>
            </Section>
          </>
        )}

        {shown === "face" && (
          <>
            <Section title="Eye colour">
              <div className="flex flex-wrap gap-3">
                {EYE_COLORS.map((c) => (
                  <Swatch key={c.id} color={c.swatch} label={`${c.label} eyes`} active={a.babyEyes === c.id} onClick={() => set({ babyEyes: c.id })} />
                ))}
              </div>
            </Section>
            <Section title="Eyebrows">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {range(AVATAR_SETS.baby.brows).map((n) => (
                  <OptionTile key={n} label={`Eyebrows ${n}`} active={a.babyBrows === n} onClick={() => set({ babyBrows: n })}>
                    {zoom({ babyBrows: n })}
                  </OptionTile>
                ))}
              </div>
            </Section>
            <Section title="Eyelashes">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {range(AVATAR_SETS.baby.lashes).map((n) => (
                  <OptionTile key={n} label={`Eyelashes ${n}`} active={a.babyLashes === n} onClick={() => set({ babyLashes: n })}>
                    {zoom({ babyLashes: n })}
                  </OptionTile>
                ))}
              </div>
            </Section>
            <Section title="Mouth">
              <div className="grid grid-cols-4 gap-2">
                {range(AVATAR_SETS.baby.mouth).map((n) => (
                  <OptionTile key={n} label={`Mouth: ${MOUTH_LABELS[n - 1]}`} active={a.babyMouth === n} onClick={() => set({ babyMouth: n })}>
                    {zoom({ babyMouth: n })}
                  </OptionTile>
                ))}
              </div>
            </Section>
          </>
        )}

        {shown === "clothes" && (
          <>
            <Section title="Outfit">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {range(BABY_OUTFITS).map((n) => (
                  <OptionTile key={n} label={`Outfit ${n}`} active={a.babyOutfit === n} onClick={() => set({ babyOutfit: n })}>
                    <img src={`/avatars/baby/outfit-${n}-thumb.webp`} alt="" className="h-16 w-full object-contain p-1" draggable={false} />
                  </OptionTile>
                ))}
              </div>
            </Section>
            <Section title="Shoes">
              <div className="grid grid-cols-5 gap-2">
                {range(AVATAR_SETS.baby.shoes).map((n) => (
                  <OptionTile key={n} label={`Shoes ${n}`} active={a.babyShoes === n} onClick={() => set({ babyShoes: n })}>
                    <img src={`/avatars/baby/shoes-${n}-thumb.webp`} alt="" className="h-12 w-full object-contain p-1.5" draggable={false} />
                  </OptionTile>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Adding or editing a child. A doctor only sets the hospital number (docs/user-flows.md §2);
 * the API refuses anything else from them.
 */
export default function ChildForm({ child, onDone, submitLabel }) {
  const { addChild, updateChild } = useChildren();
  const isEdit = Boolean(child);
  const hnOnly = isEdit && child.myRole === "DOCTOR";

  const [fullName, setFullName] = useState(child?.fullName ?? "");
  const [nickname, setNickname] = useState(child?.nickname ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(child?.dateOfBirth ?? "");
  // A baby on the way: the date is the due date (up to 10 months ahead, as the API allows).
  const [notBorn, setNotBorn] = useState(Boolean(child?.dateOfBirth && child.dateOfBirth > todayIso()));
  const [sex, setSex] = useState(child?.sex ?? "FEMALE");
  const [relation, setRelation] = useState(child?.myRelation ?? "PARENT");
  const [changingRelation, setChangingRelation] = useState(false);
  const [hn, setHn] = useState(child?.hn ?? "");
  const [avatar, setAvatar] = useState(child?.avatar ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    let body;
    if (hnOnly) {
      body = { hn: hn.trim() };
    } else {
      if (!fullName.trim()) return setError("Please enter your child’s full name.");
      if (!dateOfBirth) return setError(notBorn ? "Please enter the due date." : "Please enter the date of birth.");
      if (!notBorn && dateOfBirth > todayIso()) return setError("The date of birth can’t be in the future. Not born yet? Tick the box.");
      if (notBorn && dateOfBirth <= todayIso()) return setError("A due date is in the future. Already born? Untick the box.");
      body = {
        fullName: fullName.trim(),
        nickname: nickname.trim() || null,
        sex,
        dateOfBirth,
        relation,
        avatar: withDefaults(avatar, sex),
        ...(hn.trim() || isEdit ? { hn: hn.trim() } : {}),
      };
    }
    setSaving(true);
    try {
      const saved = isEdit ? await updateChild(child.id, body) : await addChild(body);
      onDone?.(saved);
    } catch (err) {
      setError(errorMessage(err, "Couldn’t save. Please try again."));
      setSaving(false);
    }
  }

  const submitButton = (
    <button
      type="submit"
      disabled={saving}
      className="w-full rounded-xl bg-[#056559] py-3 text-sm font-semibold text-white transition hover:bg-[#03443c] active:scale-[0.99] disabled:opacity-60 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
    >
      {saving ? "Saving…" : (submitLabel ?? (isEdit ? "Save changes" : "Save and continue"))}
    </button>
  );

  if (hnOnly) {
    return (
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <Field label="Hospital number (HN)">
          <input type="text" value={hn} onChange={(e) => setHn(e.target.value)} className={field} />
        </Field>
        {submitButton}
      </form>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

      <AvatarEditor sex={sex} dateOfBirth={dateOfBirth} avatar={avatar} onChange={setAvatar} />

      <Field label="Full name">
        <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} />
      </Field>
      <Field label="Nickname (optional)">
        <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} className={field} />
      </Field>
      <label className="-mb-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={notBorn} onChange={(e) => setNotBorn(e.target.checked)} className="h-4 w-4 accent-[#056559]" />
        Not born yet
      </label>
      <Field label={notBorn ? "Due date" : "Date of birth"}>
        <input
          type="date"
          required
          min={notBorn ? todayIso() : undefined}
          max={notBorn ? dueMaxIso() : todayIso()}
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className={field}
        />
      </Field>

      <Field group label="Sex">
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border-2 border-slate-200 dark:border-slate-700">
          {[
            ["FEMALE", "Girl"],
            ["MALE", "Boy"],
          ].map(([v, label], i) => (
            <button
              key={v}
              type="button"
              aria-pressed={sex === v}
              onClick={() => setSex(v)}
              className={`py-2.5 text-sm font-semibold transition ${i ? "border-l-2 border-slate-200 dark:border-slate-700" : ""} ${
                sex === v
                  ? "bg-[#eaf6f3] text-[#056559] dark:bg-teal-500/10 dark:text-teal-300"
                  : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Hospital number (HN), optional">
        <input type="text" value={hn} onChange={(e) => setHn(e.target.value)} className={field} />
      </Field>

      {(!isEdit || child.myRole === "PARENT") && (
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">You are this child’s</legend>
          <div className="grid gap-2">
            {/* Editing shows just the saved answer; the other options open only on request. */}
            {RELATIONS.filter((r) => !isEdit || changingRelation || r.value === relation).map((r) => (
              <label
                key={r.value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-sm transition ${
                  relation === r.value
                    ? "border-[#056559] bg-[#eaf6f3] dark:border-teal-400 dark:bg-teal-500/10"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <input type="radio" name="relation" value={r.value} checked={relation === r.value} onChange={() => setRelation(r.value)} className="accent-[#056559]" />
                <span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{r.label}</span>
                  {r.hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{r.hint}</span>}
                </span>
              </label>
            ))}
          </div>
          {isEdit && !changingRelation && (
            <button
              type="button"
              onClick={() => setChangingRelation(true)}
              className="mt-1.5 text-xs font-semibold text-[#056559] hover:underline dark:text-teal-300"
            >
              Change
            </button>
          )}
        </fieldset>
      )}

      {submitButton}
    </form>
  );
}
