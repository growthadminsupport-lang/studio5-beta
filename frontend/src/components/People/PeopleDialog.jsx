import { Dialog, DialogContent, DialogTitle, IconButton, useMediaQuery } from "@mui/material";
import { X } from "lucide-react";
import PeoplePanel from "./PeoplePanel";

/** Members and invitations for a child, in a window over the current page. */
export default function PeopleDialog({ child, open, onClose }) {
  const fullScreen = useMediaQuery("(max-width:640px)");
  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        People who follow {child?.fullName}
        <IconButton aria-label="Close" onClick={onClose} sx={{ position: "absolute", right: 12, top: 12 }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{child && open && <PeoplePanel child={child} inWindow />}</DialogContent>
    </Dialog>
  );
}
