import { useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { Body, Button, Choice, Field, FormGroup, H1 } from "../components/ui";
import { FormShell, SendError, ThankYou } from "../components/FormShell";
import { QUOTE_THANKS, buildQuote } from "../lib/forms";
import { submitInquiry } from "../lib/inquiry";

export default function Quote() {
  const params = useLocalSearchParams();
  const [v, setV] = useState({ fullName: "", phone: "", email: "", dateNeeded: "", fulfillment: "", people: params.people || "", pickupTime: "", foodItems: params.foodItems || "", specialRequests: "", budget: "", notes: "", occasion: params.occasion || "" });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, done: false, error: "" });
  const set = (k) => (t) => { setV((cur) => ({ ...cur, [k]: t })); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })); };

  async function submit() {
    const built = buildQuote(v);
    setErrors(built.errors);
    if (Object.keys(built.errors).length) { setState({ busy: false, done: false, error: "Please check the highlighted fields." }); return; }
    setState({ busy: true, done: false, error: "" });
    const res = await submitInquiry("large-order", built.fields);
    if (res.ok) { setState({ busy: false, done: true, error: "" }); return; }
    if (res.fields?.length) setErrors(Object.fromEntries(res.fields.map((f) => [f, "Please check this field."])));
    setState({ busy: false, done: false, error: res.error });
  }

  return (
    <FormShell>
      <Stack.Screen options={{ title: "Large order quote" }} />
      {state.done ? <ThankYou message={QUOTE_THANKS} /> : (
        <>
          <H1>Get a large order quote</H1>
          <Body>{v.occasion ? `Occasion: ${v.occasion}. ` : ""}Tell us about your order and Maruf Cafe will get back to you with a quote.</Body>
          <FormGroup title="About you">
            <Field label="Full Name" required value={v.fullName} onChangeText={set("fullName")} error={errors.fullName} autoComplete="name" textContentType="name" />
            <Field label="Phone Number" required value={v.phone} onChangeText={set("phone")} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
            <Field label="Email" required value={v.email} onChangeText={set("email")} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
          </FormGroup>
          <FormGroup title="Your order">
            <Field label="Date Needed" required value={v.dateNeeded} onChangeText={set("dateNeeded")} error={errors.dateNeeded} placeholder="MM/DD/YYYY" keyboardType="numbers-and-punctuation" />
            <Choice label="Pickup or Delivery" required value={v.fulfillment} onChange={set("fulfillment")} error={errors.fulfillment} options={[{ value: "pickup", label: "Pickup" }, { value: "delivery", label: "Delivery" }]} />
            <Field label="Number of People" required value={v.people} onChangeText={(t) => set("people")(t.replace(/[^0-9]/g, ""))} error={errors.people} keyboardType="number-pad" maxLength={4} />
            <Field label="Preferred Pickup Time" value={v.pickupTime} onChangeText={set("pickupTime")} error={errors.pickupTime} placeholder="For example, 5:30 PM" />
            <Field label="Food Items" required multiline value={v.foodItems} onChangeText={set("foodItems")} error={errors.foodItems} placeholder="What would you like to order?" />
            <Field label="Special Requests" multiline value={v.specialRequests} onChangeText={set("specialRequests")} />
            <Field label="Budget" value={v.budget} onChangeText={set("budget")} placeholder="Optional" />
            <Field label="Additional Notes" multiline value={v.notes} onChangeText={set("notes")} />
          </FormGroup>
          <SendError message={state.error} />
          <Button title={state.busy ? "Sending…" : "Request my quote"} variant="gold" disabled={state.busy} onPress={submit} />
        </>
      )}
    </FormShell>
  );
}
