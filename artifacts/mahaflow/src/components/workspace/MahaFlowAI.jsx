import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bot, BusFront, Check, Clock3, MapPin, Send, Sparkles, Users, X } from "lucide-react";
import { listCrowdPredictions, listCrowdReadings, listFacilities, listTransportServices } from "@/lib/supabaseData";
import { ErrorState, LoadingState, SectionHeader } from "@/components/workspace/WorkspaceUI";

const initialMessage = {
  role: "assistant",
  content: "Namaste. I’m MahaFlow AI, your Maharashtra public transportation assistant. Ask me about verified buses, railways, timings, routes, or crowd levels.",
};

const cleanAIText = value => String(value || "")
  .replace(/\*\*/g, "")
  .replace(/\*/g, "")
  .replace(/^\s*[-]\s?/gm, "• ")
  .trim();

const compactService = service => ({
  id: service.id,
  mode: service.mode,
  service_number: service.service_number,
  service_name: service.service_name,
  origin: service.origin,
  destination: service.destination,
  service_date: service.service_date,
  departure_time: service.departure_time,
  arrival_time: service.arrival_time,
  status: service.status,
  capacity: service.capacity,
  facility_id: service.facility_id,
});

const compactReading = reading => ({
  facility_id: reading.facility_id,
  zone: reading.zone,
  people_count: reading.people_count,
  crowd_level: reading.crowd_level,
  recorded_at: reading.recorded_at,
  source: reading.source,
  model_version: reading.model_version,
});

const compactPrediction = prediction => ({
  facility_id: prediction.facility_id,
  zone: prediction.zone,
  predicted_count: prediction.predicted_count,
  crowd_level: prediction.crowd_level,
  prediction_for: prediction.prediction_for,
  model_version: prediction.model_version,
});

const useMahaFlowData = () => {
  const [data, setData] = useState({ services: [], readings: [], predictions: [], facilities: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([listTransportServices(), listCrowdReadings(), listCrowdPredictions(), listFacilities()])
      .then(([services, readings, predictions, facilities]) => {
        if (active) setData({ services, readings, predictions, facilities });
      })
      .catch(requestError => {
        if (active) setError(requestError.message || "Verified MahaFlow data is unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);
  return { data, loading, error };
};

const makeContext = (data, role) => ({
  role,
  services: data.services.map(compactService),
  crowd_readings: data.readings.map(compactReading),
  crowd_predictions: data.predictions.map(compactPrediction),
  facilities: data.facilities.map(facility => ({
    id: facility.id,
    name: facility.name,
    kind: facility.kind,
    district: facility.district,
    state: facility.state,
    address: facility.address,
  })),
});

const askMahaFlowAI = async (messages, context, purpose = "chat") => {
  const response = await fetch("/api/gemini/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, context: { ...context, purpose } }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail || "MahaFlow AI is unavailable.");
  return cleanAIText(body.message);
};

const ChatBubble = ({ message }) => (
  <div className={`mf-ai-message ${message.role === "assistant" ? "assistant" : "user"}`} data-testid={`mf-ai-message-${message.role}`}>
    {message.role === "assistant" && <div className="mf-ai-avatar"><Bot size={16}/></div>}
    <p>{message.content}</p>
  </div>
);

export const MahaFlowAIChat = ({ role, session, onClose }) => {
  const { data, loading: loadingData, error: dataError } = useMahaFlowData();
  const storageKey = `mahaflow-ai-chat-${role}-${session?.user?.id || "local"}`;
  const [messages, setMessages] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      return Array.isArray(stored) && stored.length ? stored : [initialMessage];
    } catch {
      return [initialMessage];
    }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messageError, setMessageError] = useState("");
  const context = useMemo(() => makeContext(data, role), [data, role]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
  }, [messages, storageKey]);

  const sendMessage = async event => {
    event.preventDefault();
    const content = input.trim();
    if (!content || busy) return;
    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setMessageError("");
    try {
      const answer = await askMahaFlowAI(nextMessages, context);
      setMessages(current => [...current, { role: "assistant", content: answer }]);
    } catch (requestError) {
      setMessageError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return <div className="mf-ai-chat-overlay" role="dialog" aria-modal="true" aria-label="Chat with MahaFlow AI">
    <section className="mf-ai-chat-modal" data-testid="mf-ai-chat">
      <div className="mf-ai-panel-heading"><div className="mf-ai-avatar large"><Sparkles size={19}/></div><span><b>MahaFlow AI</b><small>Public transportation assistant for Maharashtra</small></span><button className="icon-button" onClick={onClose} aria-label="Close MahaFlow AI chat"><X size={16}/></button></div>
      {loadingData && <div className="mf-ai-inline-loading"><LoadingState label="Loading verified MahaFlow data…"/></div>}
      {dataError && <div className="mf-ai-inline-error"><ErrorState message={dataError}/></div>}
      <div className="mf-ai-messages">{messages.map((message, index) => <ChatBubble message={message} key={`${message.role}-${index}`}/>)}{busy && <div className="mf-ai-typing"><span/><span/><span/> Checking MahaFlow data…</div>}</div>
      <form className="mf-ai-composer" onSubmit={sendMessage}>
        <input value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about a verified route, timing, delay, or crowd level" aria-label="Ask MahaFlow AI" data-testid="mf-ai-chat-input"/>
        <button className="primary-button" disabled={busy || !input.trim()} data-testid="mf-ai-send-button"><Send size={16}/><span>Ask AI</span></button>
      </form>
      {messageError && <div className="mf-ai-error" data-testid="mf-ai-error">{messageError}</div>}
    </section>
  </div>;
};

export const MahaFlowAI = ({ role, session }) => {
  const [chatOpen, setChatOpen] = useState(false);
  return <div className="mf-ai-page">
    <SectionHeader eyebrow={`${role.toUpperCase()} · MAHAFLOW AI`} title="MahaFlow AI" description="Your verified Maharashtra transportation assistant. Open a chat when you need route, timing, delay, or crowd guidance." action={<span className="mf-ai-status"><i/> Data-aware assistant</span>}/>
    <section className="mf-ai-launch-card" data-testid="mf-ai-launcher">
      <div className="mf-ai-launch-icon"><Sparkles size={26}/></div>
      <div><span className="eyebrow">ASK MAHAFLOW AI</span><h2>Chat with your transport assistant</h2><p>MahaFlow AI checks available Supabase schedules, authority updates, and YOLO records before answering. It will say when verified live data is unavailable.</p><button className="primary-button" onClick={() => setChatOpen(true)} data-testid="mf-ai-open-chat-button"><Bot size={17}/>Chat with MahaFlow AI</button></div>
      <div className="mf-ai-launch-points"><span><Check size={14}/> Verified transport context</span><span><Check size={14}/> No invented live updates</span><span><Check size={14}/> Chat history saved on this device</span></div>
    </section>
    {chatOpen && <MahaFlowAIChat role={role} session={session} onClose={() => setChatOpen(false)}/>}
  </div>;
};

export const AICrowdPrediction = ({ role }) => {
  const { data, loading, error } = useMahaFlowData();
  const [fromFacilityId, setFromFacilityId] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [requestError, setRequestError] = useState("");
  const context = useMemo(() => makeContext(data, role), [data, role]);
  const facilities = data.facilities.filter(facility => facility.kind === "bus" || facility.kind === "railway");

  const predict = async event => {
    event.preventDefault();
    if (!fromFacilityId || !destination.trim() || !date || !time || busy) return;
    const facility = data.facilities.find(item => item.id === fromFacilityId);
    const relevantServices = data.services.filter(service => {
      const matchesOrigin = service.facility_id === fromFacilityId || String(service.origin || "").toLowerCase().includes(String(facility?.name || "").toLowerCase());
      const matchesDestination = String(service.destination || "").toLowerCase().includes(destination.trim().toLowerCase());
      const serviceDate = String(service.service_date || "").slice(0, 10);
      const matchesDate = !serviceDate || serviceDate === date;
      const matchesTime = !service.departure_time || String(service.departure_time).slice(0, 5) === time;
      return matchesOrigin && matchesDestination && matchesDate && matchesTime;
    });
    const relevantReadings = data.readings.filter(reading => reading.facility_id === fromFacilityId);
    const relevantPredictions = data.predictions.filter(prediction => prediction.facility_id === fromFacilityId);
    const query = `Predict the crowd level for a ${facility?.kind === "railway" ? "railway" : "bus"} journey from ${facility?.name || "the selected facility"} to ${destination.trim()} on ${date} at ${time}. Analyze only the supplied YOLO crowd readings and prediction records for this facility and matching verified services. If there is not enough relevant data, say the prediction is currently unavailable. Do not create a number or crowd level.`;
    setBusy(true);
    setResult("");
    setRequestError("");
    try {
      const answer = await askMahaFlowAI([{ role: "user", content: query }], {
        ...context,
        selected_journey: { origin: facility?.name, destination: destination.trim(), date, time },
        services: relevantServices.map(compactService),
        crowd_readings: relevantReadings.map(compactReading),
        crowd_predictions: relevantPredictions.map(compactPrediction),
      }, "crowd_prediction");
      setResult(answer);
    } catch (requestError) {
      setRequestError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return <div className="mf-ai-page">
    <SectionHeader eyebrow={`${role.toUpperCase()} · YOLO ANALYSIS`} title="AI crowd prediction" description="Choose a verified facility and journey. MahaFlow AI will analyze the available authority and YOLO records without fabricating a result."/>
    {loading && <div className="mf-ai-data-note"><LoadingState label="Loading verified MahaFlow data…"/></div>}
    {error && <ErrorState message={error}/>}
    <section className="mf-ai-prediction-panel standalone" data-testid="mf-ai-prediction">
      <div className="mf-ai-panel-heading"><div className="mf-ai-avatar"><Users size={17}/></div><span><b>Predict crowd for a journey</b><small>Use actual detector records from the selected bus stand or station</small></span></div>
      <form className="mf-ai-prediction-form" onSubmit={predict}>
        <label><span><MapPin size={14}/> Bus stand / station</span><select value={fromFacilityId} onChange={event => setFromFacilityId(event.target.value)} data-testid="mf-ai-origin-select" required><option value="">Select a registered facility</option>{facilities.map(facility => <option value={facility.id} key={facility.id}>{facility.name} · {facility.kind === "railway" ? "Railway station" : "Bus stand"}</option>)}</select></label>
        <label><span><ArrowRight size={14}/> Destination</span><input value={destination} onChange={event => setDestination(event.target.value)} placeholder="Enter destination" data-testid="mf-ai-destination-input" required/></label>
        <div className="mf-ai-form-row"><label><span><Clock3 size={14}/> Date</span><input type="date" value={date} onChange={event => setDate(event.target.value)} data-testid="mf-ai-date-input" required/></label><label><span><Clock3 size={14}/> Time</span><input type="time" value={time} onChange={event => setTime(event.target.value)} data-testid="mf-ai-time-input" required/></label></div>
        <button className="primary-button" disabled={busy || !fromFacilityId || !destination.trim() || !date || !time} data-testid="mf-ai-predict-button"><Users size={16}/>{busy ? "Analyzing YOLO data…" : "Predict crowd"}</button>
      </form>
      {result && <div className="mf-ai-prediction-result" data-testid="mf-ai-prediction-result"><span className="eyebrow">MAHAFLOW AI RESULT</span><p>{result}</p></div>}
      {!result && !requestError && <div className="mf-ai-data-boundary"><BusFront size={16}/><span><b>Data boundary</b><small>Only persisted authority and YOLO readings are used. If no matching reading exists, the result will say unavailable.</small></span></div>}
      {requestError && <div className="mf-ai-error" data-testid="mf-ai-error">{requestError}</div>}
    </section>
  </div>;
};