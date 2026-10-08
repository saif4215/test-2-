import { useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { Body, Button, Choice, Field, FormGroup, H1 } from "../components/ui";
import { FormShell, SendError, ThankYou } from "../components/FormShell";
import { EVENT_THANKS, buildEvent } from "../lib/forms";
import { submitInquiry } from "../lib/inquiry";

const eventTypes = ["Birthday Party", "Engagement", "Family Gathering", "Private Dinner", "Business Meeting", "Community Event", "Celebration", "Other"].map((t) => ({ value: t, label: t }));
const yesNo = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unsure", label: "Not sure" }];
const venues = [{ value: "private-event", label: "Private event" }, { value: "full-venue", label: "Full venue rental" }, { value: "partial-area", label: "Partial/private area" }, { value: "other", label: "Other" }];

export default function EventRequest() {
  const params = useLocalSearchParams();
  const [v, setV] = useState({ name: "", phone: "", email: "", eventType: "", eventDate: "", startTime: "", endTime: "", guests: "", needFood: "", catering: "", foodBudget: "", venueType: "", specialRequests: "", decorations: "", entertainment: "", notes: "", packageInterest: params.package || "", contactMethod: "", alternateDate: "", budget: "", dietary: "" });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, done: false, error: "" });
  const set = (k) => (t) => { setV((cur) => ({ ...cur, [k]: t })); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })); };

  async function submit() {
    const built = buildEvent(v);
    setErrors(built.errors);
    if (Object.keys(built.errors).length) { setState({ busy: false, done: false, error: "Please check the highlighted fields." }); return; }
    setState({ busy: true, done: false, error: "" });
    const res = await submitInquiry("event", built.fields);
    if (res.ok) { setState({ busy: false, done: true, error: "" }); return; }
    if (res.fields?.length) setErrors(Object.fromEntries(res.fields.map((f) => [f, "Please check this field."])));
    setState({ busy: false, done: false, error: res.error });
  }

  return (
    <FormShell>
      <Stack.Screen options={{ title: "Event rental request" }} />
      {state.done ? <ThankYou message={EVENT_THANKS} /> : (
        <>
          <H1>Event rental request</H1>
          <Body>{v.packageInterest ? `Asking about: ${v.packageInterest}. ` : ""}Tell us about your event and Maruf Cafe will follow up about availability, pricing and food.</Body>
          <FormGroup title="Contact information">
            <Field label="Name" required value={v.name} onChangeText={set("name")} error={errors.name} autoComplete="name" textContentType="name" />
            <Field label="Phone" required value={v.phone} onChangeText={set("phone")} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
            <Field label="Email" required value={v.email} onChangeText={set("email")} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
            <Choice label="Best way to reach you" value={v.contactMethod} onChange={set("contactMethod")} options={[{ value: "phone", label: "Phone call" }, { value: "text", label: "Text" }, { value: "email", label: "Email" }]} />
          </FormGroup>
          <FormGroup title="Event information">
            <Choice label="Type of Event" required value={v.eventType} onChange={set("eventType")} error={errors.eventType} options={eventTypes} />
            <Field label="Event Date" required value={v.eventDate} onChangeText={set("eventDate")} error={errors.eventDate} placeholder="MM/DD/YYYY" keyboardType="numbers-and-punctuation" />
            <Field label="Backup Date" value={v.alternateDate} onChangeText={set("alternateDate")} error={errors.alternateDate} placeholder="Optional, MM/DD/YYYY" keyboardType="numbers-and-punctuation" />
            <Field label="Start Time" value={v.startTime} onChangeText={set("startTime")} error={errors.startTime} placeholder="For example, 6:00 PM" />
            <Field label="End Time" value={v.endTime} onChangeText={set("endTime")} error={errors.endTime} placeholder="For example, 9:00 PM" />
            <Field label="Number of Guests" required value={v.guests} onChangeText={(t) => set("guests")(t.replace(/[^0-9]/g, ""))} error={errors.guests} keyboardType="number-pad" maxLength={4} />
          </FormGroup>
          <FormGroup title="Food">
            <Choice label="Will you need food?" value={v.needFood} onChange={set("needFood")} options={yesNo} />
            <Choice label="Catering required?" value={v.catering} onChange={set("catering")} options={yesNo} />
            <Field label="Estimated food budget" value={v.foodBudget} onChangeText={set("foodBudget")} placeholder="Optional" />
            <Field label="Allergies or dietary needs" multiline value={v.dietary} onChangeText={set("dietary")} placeholder="Optional" />
          </FormGroup>
          <FormGroup title="Venue">
            <Choice label="What are you looking for?" value={v.venueType} onChange={set("venueType")} options={venues} />
          </FormGroup>
          <FormGroup title="Additional information">
            <Field label="Overall event budget" value={v.budget} onChangeText={set("budget")} placeholder="Optional" />
            <Field label="Special requests" multiline value={v.specialRequests} onChangeText={set("specialRequests")} />
            <Field label="Decorations" multiline value={v.decorations} onChangeText={set("decorations")} />
            <Field label="Entertainment" multiline value={v.entertainment} onChangeText={set("entertainment")} />
            <Field label="Other notes" multiline value={v.notes} onChangeText={set("notes")} />
          </FormGroup>
          <SendError message={state.error} />
          <Button title={state.busy ? "Sending…" : "Request event information"} variant="gold" disabled={state.busy} onPress={submit} />
        </>
      )}
    </FormShell>
  );
}
