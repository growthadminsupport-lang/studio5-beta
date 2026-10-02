import { useState } from "react";
import { Check } from "lucide-react";
import { useChildren } from "../../context/ChildrenContext";
import { errorMessage } from "../../lib/api";
import { BABY_OUTFITS, HAIR_COLORS, SKIN_TONES, avatarVersion, hairCount, withDefaults } from "../../lib/avatar";
import ChildAvatar, { AvatarFigure } from "./ChildAvatar";

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
  { id: "hair", label: "Hairstyle" },
  { id: "color", label: "Hair colour" },
  { id: "outfit", label: "Clothes", babyOnly: true },
];

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
          : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

/** Preview on top, one row of choices underneath; the drawing follows the child's age. */
function AvatarEditor({ sex, dateOfBirth, avatar, onChange }) {
  const [tab, setTab] = useState("skin");
  const version = avatarVersion(dateOfBirth);
  const a = withDefaults(avatar, sex);
  const set = (patch) => onChange({ ...a, ...patch });
  const tabs = TABS.filter((t) => !t.babyOnly || version === "baby");
  const current = tabs.some((t) => t.id === tab) ? tab : "skin";
  const preview = (patch) => ({ sex, dateOfBirth, avatar: { ...a, ...patch } });

  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-end justify-center rounded-xl bg-gradient-to-b from-[#eaf6f3] to-white py-3 dark:from-teal-500/10 dark:to-slate-800">
        <AvatarFigure version={version} sex={sex} avatar={a} height={170} />
      </div>
      <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
        {version === "baby"
          ? "Baby and toddler drawing, until 3 years. It changes to the young-child drawing as your child grows."
          : "Young-child drawing, from 3 years."}
      </p>

      <div role="tablist" className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={current === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
              current === t.id
                ? "bg-white text-[#056559] shadow-sm dark:bg-slate-700 dark:text-teal-300"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 min-h-[64px]">
        {current === "skin" && (
          <div className="flex flex-wrap gap-3">
            {SKIN_TONES.map((s) => (
              <Swatch key={s.id} color={s.swatch} label={s.label} active={a.skin === s.id} onClick={() => set({ skin: s.id })} />
            ))}
          </div>
        )}
        {current === "color" && (
          <div className="flex flex-wrap gap-3">
            {HAIR_COLORS.map((c) => (
              <Swatch key={c.hex} color={c.hex} label={c.label} active={a.hairColor === c.hex} onClick={() => set({ hairColor: c.hex })} />
            ))}
          </div>
        )}
        {current === "hair" && (
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: hairCount(version) }, (_, i) => i + 1).map((n) => {
              const key = version === "baby" ? "babyHair" : "youngHair";
              return (
                <OptionTile key={n} label={`Hairstyle ${n}`} active={a[key] === n} onClick={() => set({ [key]: n })}>
                  <ChildAvatar child={preview({ [key]: n })} size={48} />
                </OptionTile>
              );
            })}
          </div>
        )}
        {current === "outfit" && (
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: BABY_OUTFITS }, (_, i) => i + 1).map((n) => (
              <OptionTile key={n} label={`Outfit ${n}`} active={a.babyOutfit === n} onClick={() => set({ babyOutfit: n })}>
                <img src={`/avatars/baby/outfit-${n}.webp`} alt="" className="h-14 object-contain" style={{ objectPosition: "center 70%" }} />
              </OptionTile>
            ))}
          </div>
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
  const [sex, setSex] = useState(child?.sex ?? "FEMALE");
  const [relation, setRelation] = useState(child?.myRelation ?? "PARENT");
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
      if (!dateOfBirth || dateOfBirth > todayIso()) return setError("Please enter a date of birth that isn’t in the future.");
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
        <Field label="Hospital number (HN)" hint="You find patients by this number. The family can see it; caretakers cannot.">
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
      <Field label="Date of birth">
        <input type="date" required max={todayIso()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={field} />
      </Field>

      <Field group label="Sex" hint="Growth charts and bone age differ for girls and boys, so this sets which references are used.">
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

      <Field label="Hospital number (HN), optional" hint="Helps the child’s doctor find them. Caretakers do not see it.">
        <input type="text" value={hn} onChange={(e) => setHn(e.target.value)} className={field} />
      </Field>

      {(!isEdit || child.myRole === "PARENT") && (
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">You are this child’s</legend>
          <div className="grid gap-2">
            {RELATIONS.map((r) => (
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
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
            {isEdit ? "As the person who manages this profile, you" : "You will manage this profile. You"} can edit it, invite or
            remove a caretaker and the child’s doctor, and delete it. A caretaker (for example a nanny or a teacher) and the
            doctor join only by your invitation, and can do less.
          </p>
        </fieldset>
      )}

      {submitButton}
    </form>
  );
}
