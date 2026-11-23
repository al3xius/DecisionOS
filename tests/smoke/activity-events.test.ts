import { assertEqual } from "./run";
import {
  activityEventVerb,
  activityEventLabel,
  activityEventDetail,
  tagEventJson,
  audienceEventJson,
} from "../../src/lib/activity-events";

/**
 * Human-readable labels for the activity feed. Pure lookup + fallback logic;
 * cheap to test and easy to regress when new event types are added.
 */
export const activityEventsTests = {
  "known event types map to their verb phrase"() {
    assertEqual(activityEventVerb("status_changed"), "changed the status of");
    assertEqual(activityEventVerb("note_added"), "added a note to");
    assertEqual(activityEventVerb("note_replied"), "replied to a note on");
    assertEqual(activityEventVerb("updated"), "edited");
  },

  "unknown event types fall back to underscores-as-spaces"() {
    assertEqual(activityEventVerb("some_new_event"), "some new event");
    assertEqual(activityEventVerb("reopened"), "reopened");
  },

  "label capitalizes the first letter of the verb"() {
    assertEqual(activityEventLabel("created"), "Created");
    assertEqual(activityEventLabel("status_changed"), "Changed the status of");
    assertEqual(activityEventLabel("some_new_event"), "Some new event");
  },

  "tag events show the tag name stored on the event"() {
    const json = tagEventJson({ id: "t1", name: "finance" });
    assertEqual(activityEventVerb("tag_added"), "added a tag to");
    assertEqual(activityEventVerb("tag_removed"), "removed a tag from");
    assertEqual(activityEventDetail("tag_added", json), '"finance"');
    assertEqual(activityEventDetail("tag_removed", json), '"finance"');
  },

  "audience changes show before → after, with empty meaning everyone"() {
    const before = audienceEventJson([]);
    const after = audienceEventJson([{ name: "legal" }, { name: "finance" }]);
    assertEqual(
      activityEventDetail("audience_changed", after, before),
      'everyone in the workspace → "finance", "legal"',
    );
  },

  "detail is null for events without one, and tolerates bad JSON"() {
    assertEqual(activityEventDetail("note_added", null), null);
    assertEqual(activityEventDetail("tag_added", "not json"), null);
    assertEqual(activityEventDetail("status_changed", JSON.stringify({ status: "approved" })), "→ approved");
  },
};
