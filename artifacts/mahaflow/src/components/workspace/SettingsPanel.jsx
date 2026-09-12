import React, { useEffect, useState } from "react";
import { Bell, Check, Clock3, Cpu, Languages, RefreshCw, Save, ShieldCheck, SunMoon, UserRound } from "lucide-react";
import { getUserSettings, saveUserSettings, updateProfile } from "@/lib/supabaseData";
import { SectionHeader } from "@/components/workspace/WorkspaceUI";
import { useLanguage } from "@/i18n";

const defaults = { language: "en", theme: "system", notifications_enabled: true, crowd_alerts_enabled: true, staff_alerts_enabled: true, operating_hours_start: "06:00", operating_hours_end: "23:00", yolo_worker_url: "", yolo_model_name: "YOLO26n", advanced_config: {} };

export const SettingsPanel = ({ role, session, profile, theme, setTheme, onSignOut }) => {
  const { setLanguage } = useLanguage();
  const [settings, setSettings] = useState(defaults);
  const [identity, setIdentity] = useState({ display_name: profile?.full_name || "", mobile: profile?.mobile || "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [workerState, setWorkerState] = useState({ status: "idle", message: "Not scanned yet." });

  useEffect(() => { getUserSettings(session.user.id).then(data => { if (data) setSettings({ ...defaults, ...data }); }).catch(error => setMessage(error.message)); }, [session.user.id]);

  const save = async () => {
    setBusy(true); setMessage("");
    try {
      await Promise.all([
        updateProfile(session.user.id, identity),
        saveUserSettings({ ...settings, owner_user_id: session.user.id, theme, updated_at: new Date().toISOString() }),
      ]);
      setMessage("Settings saved securely.");
    } catch (error) { setMessage(error.message || "Settings could not be saved."); }
    finally { setBusy(false); }
  };

  const toggle = (key) => setSettings(value => ({ ...value, [key]: !value[key] }));
  const scanWorker = async () => {
    setWorkerState({ status: "scanning", message: "Checking the YOLO worker…" });
    try {
      const endpoint = (settings.yolo_worker_url || "/api").replace(/\/$/, "");
      const response = await fetch(`${endpoint}/health`);
      const data = await response.json();
      if (data.inference === "yolo" && data.model_configured === false) {
        setWorkerState({ status: "warning", message: "Worker responded, but no server-side .pt model is configured." });
        return;
      }
      if (!response.ok) throw new Error(data.detail || `Worker returned ${response.status}.`);
      setWorkerState({ status: data.model_configured ? "connected" : "warning", message: data.model_configured ? `${data.model_name || "YOLO26n"} is connected and ready.` : "Worker responded, but no model is configured." });
    } catch (error) { setWorkerState({ status: "error", message: error.message || "Worker could not be reached." }); }
  };
  return <><SectionHeader eyebrow={`${role.toUpperCase()} · SETTINGS`} title={role === "developer" ? "Advanced settings" : "Settings"} description={role === "developer" ? "Control platform integrations and operational defaults." : "Manage your account and notification preferences."}/><div className="settings-grid">
    <section className="settings-section"><div className="settings-title"><UserRound/><div><h3>Profile</h3><p>Your verified account identity.</p></div></div><label>Display name<input value={identity.display_name} onChange={event => setIdentity({ ...identity, display_name: event.target.value })} data-testid="settings-display-name-input"/></label><label>Email<input value={session.user.email || ""} readOnly data-testid="settings-email-input"/></label><label>Mobile<input value={identity.mobile} onChange={event => setIdentity({ ...identity, mobile: event.target.value })} data-testid="settings-mobile-input"/></label></section>
     <section className="settings-section"><div className="settings-title"><SunMoon/><div><h3>Experience</h3><p>Language, theme, and alerts.</p></div></div><label><Languages size={14}/>Language<select value={settings.language} onChange={event => { setSettings({ ...settings, language: event.target.value }); setLanguage(event.target.value); }} data-testid="settings-language-select"><option value="en">English</option><option value="hi">हिन्दी</option><option value="mr">मराठी</option></select></label><label>Theme<select value={theme} onChange={event => setTheme(event.target.value)} data-testid="settings-theme-select"><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label><button className="setting-toggle" data-testid="settings-notifications-toggle" onClick={() => toggle("notifications_enabled")}><Bell size={16}/><span>Notifications</span><i className={settings.notifications_enabled ? "on" : ""}/></button><button className="setting-toggle" data-testid="settings-crowd-alerts-toggle" onClick={() => toggle("crowd_alerts_enabled")}><ShieldCheck size={16}/><span>Crowd alerts</span><i className={settings.crowd_alerts_enabled ? "on" : ""}/></button></section>
    {role === "authority" && <section className="settings-section"><div className="settings-title"><Clock3/><div><h3>Facility operations</h3><p>Basic authority controls.</p></div></div><label>Opening time<input type="time" value={settings.operating_hours_start || ""} onChange={event => setSettings({ ...settings, operating_hours_start: event.target.value })} data-testid="settings-opening-time-input"/></label><label>Closing time<input type="time" value={settings.operating_hours_end || ""} onChange={event => setSettings({ ...settings, operating_hours_end: event.target.value })} data-testid="settings-closing-time-input"/></label><button className="setting-toggle" data-testid="settings-staff-alerts-toggle" onClick={() => toggle("staff_alerts_enabled")}><Bell size={16}/><span>Staff alerts</span><i className={settings.staff_alerts_enabled ? "on" : ""}/></button></section>}
    {role === "developer" && <section className="settings-section advanced"><div className="settings-title"><Cpu/><div><h3>YOLO26n worker</h3><p>Connect and scan the server-side inference worker. Credentials and the .pt model never leave the server.</p></div></div><label>Worker endpoint<input type="url" value={settings.yolo_worker_url || ""} onChange={event => setSettings({ ...settings, yolo_worker_url: event.target.value })} data-testid="settings-yolo-url-input" placeholder="Leave blank for the built-in /api worker"/></label><label>Model<input readOnly value="YOLO26n" data-testid="settings-yolo-model-input"/></label><button type="button" className="outline-button" onClick={scanWorker} disabled={workerState.status === "scanning"} data-testid="settings-yolo-scan-button"><RefreshCw size={15} className={workerState.status === "scanning" ? "spin" : ""}/>{workerState.status === "scanning" ? "Scanning…" : "Scan connection"}</button><div className={`integration-state ${workerState.status}`}><i/><span><b>{workerState.status === "connected" ? "Connected" : workerState.status === "warning" ? "Needs model" : workerState.status === "error" ? "Connection failed" : workerState.status === "scanning" ? "Scanning" : "Not scanned"}</b><small>{workerState.message} No detections are simulated.</small></span></div></section>}
  </div><div className="settings-actions"><button className="primary-button" data-testid="settings-save-button" disabled={busy} onClick={save}><Save size={17}/>{busy ? "Saving…" : "Save settings"}</button>{onSignOut && <button className="outline-button danger" type="button" data-testid="settings-sign-out-button" onClick={onSignOut}>Sign out</button>}{message && <span className="success-message" data-testid="settings-message"><Check size={15}/>{message}</span>}</div></>;
};