import { useNavigate, useParams } from "react-router-dom";
import { useChildren } from "../context/ChildrenContext";
import ChildForm from "../components/ChildProfile/ChildForm";

// Adding a child, and editing one from a direct link (/children/:id/edit). From a child's
// profile card, editing opens in a window instead (ChildEditDialog).
function ChildFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getChild } = useChildren();
  const isEdit = Boolean(id);
  const child = isEdit ? getChild(id) : null;

  function goBack() {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/dashboard", { replace: true });
  }

  if (isEdit && !child) {
    return (
      <div className="min-h-screen px-4 pb-16 pt-10 dark:bg-slate-900">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xs dark:border-slate-700 dark:bg-slate-800">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Child not found</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This profile doesn&apos;t exist or was removed.</p>
          <button
            type="button"
            onClick={() => navigate("/dashboard", { replace: true })}
            className="mt-5 rounded-full bg-[#056559] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#03443c] dark:bg-teal-400 dark:text-slate-950"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pb-16 pt-10 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-700 dark:bg-slate-800 sm:p-8">
        <h1 className="text-xl font-bold text-[#056559] dark:text-teal-300">
          {child?.myRole === "DOCTOR" ? `Hospital number for ${child.fullName}` : isEdit ? "Edit child" : "Add your child"}
        </h1>
        <p className="mb-6 mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isEdit ? "Changes are shared with everyone who follows this child." : "We use this to personalise growth tracking and charts."}
        </p>
        <ChildForm child={child} onDone={goBack} />
      </div>
    </div>
  );
}

export default ChildFormPage;
