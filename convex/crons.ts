import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up file uploads stuck in "pending" status for over 30 minutes.
// These are uploads that were started but never completed (tab closed, network drop, etc.).
crons.interval(
  "cleanup orphaned uploads",
  { minutes: 30 },
  internal.storage.files.cleanupOrphanedRecords,
);

export default crons;
