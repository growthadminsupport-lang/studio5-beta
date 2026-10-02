import { useChildren } from "../context/ChildrenContext";
import ChildProfileCard, { NoChildState } from "../components/ChildProfile/ChildProfileCard";
import PeoplePanel from "../components/People/PeoplePanel";

/** The People window as a page, for links from notifications and emails. */
function PeoplePage() {
  const { activeChild: child } = useChildren();
  if (!child) return <NoChildState />;
  return (
    <div className="min-h-screen bg-slate-50/50 py-8 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8">
        <ChildProfileCard />
        <PeoplePanel child={child} />
      </div>
    </div>
  );
}

export default PeoplePage;
