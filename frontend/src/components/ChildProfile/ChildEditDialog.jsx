import { Dialog, DialogContent, DialogTitle, IconButton, useMediaQuery } from "@mui/material";
import { X } from "lucide-react";
import ChildForm from "./ChildForm";

/** Edit a child's profile in a window over the current page, like switching child. */
export default function ChildEditDialog({ child, open, onClose }) {
  const fullScreen = useMediaQuery("(max-width:640px)");
  const doctor = child?.myRole === "DOCTOR";
  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        {doctor ? `Hospital number for ${child?.fullName}` : `Edit ${child?.fullName ?? "child"}`}
        <IconButton aria-label="Close" onClick={onClose} sx={{ position: "absolute", right: 12, top: 12 }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {/* Keyed so reopening starts from the saved values, not the last unsaved edit. */}
        {child && <ChildForm key={child.id + String(open)} child={child} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
