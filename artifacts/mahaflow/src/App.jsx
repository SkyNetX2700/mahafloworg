import { useEffect, useState } from "react";
import { BusFront, Camera, Code2, KeyRound, LockKeyhole, MapPin, Menu, Moon, ShieldCheck, Sparkles, Sun, UserRound, Users, X, BrainCircuit } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { AuthPage } from "@/components/auth/AuthPage";
import { AuthorityOnboarding } from "@/components/auth/AuthorityOnboarding";
import { ResetPassword } from "@/components/auth/ResetPassword";
import { AuthorityWorkspace } from "@/components/workspace/AuthorityWorkspace";
import { DeveloperWorkspace } from "@/components/workspace/DeveloperWorkspace";
import { PassengerWorkspace } from "@/components/workspace/PassengerWorkspace";
import { MahaFlowAI } from "@/components/workspace/MahaFlowAI";
import { WorkspaceUtilities } from "@/components/workspace/WorkspaceUtilities";
import MapView from "@/components/MapView";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n";
import { getUserSettings } from "@/lib/supabaseData";
import { useAuthSession } from "@/hooks/useAuthSession";
import "@/App.css";
import "@/Mobile.css";
import "@/Workspace.css";

const navigation = {
  passenger: [["Search", BusFront], ["MF AI", BrainCircuit], ["AI crowd prediction", BrainCircuit], ["Crowd map", Users], ["Saved routes", MapPin], ["Settings", Sun]],
  authority: [["Live monitoring", Users], ["MF AI", BrainCircuit], ["AI crowd prediction", BrainCircuit], ["CCTV cameras", Camera], ["Transport registry", BusFront], ["Reports", Sparkles], ["Settings", Sun]],
  developer: [["Access codes", KeyRound], ["Authorities", ShieldCheck], ["Facilities", MapPin], ["App Branding", Sparkles], ["Settings", Sun]],
};

const Logo = ({ light = false, testId }) => <BrandLogo light={light} testId={testId}/>;

const navTranslationKeys = {
  Search: "nav.search",
  "AI crowd prediction": "nav.aiPrediction",
  "MF AI": "nav.mfAi",
  "Crowd map": "nav.crowdMap",
  "Saved routes": "nav.savedRoutes",
  Settings: "nav.settings",
  "Live monitoring": "passenger.liveMonitoring",
  "CCTV cameras": "nav.crowdMap",
  "Transport registry": "nav.busRail",
  Reports: "nav.overview",
  "Access codes": "nav.codes",
  Authorities: "nav.workspace",
  Facilities: "nav.crowdMap",
  "App Branding": "nav.branding",
};

const Sidebar = ({ role, page, setPage, theme, setTheme, mobileOpen, setMobileOpen, profile, session, onSignOut }) => {
  const { t } = useLanguage();
  const RoleIcon = role === "developer" ? Code2 : role === "authority" ? ShieldCheck : UserRound;
  const displayName = profile?.full_name || session.user.email || "MahaFlow user";
  const initials = displayName.split(/\s|@/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "MF";
  return <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`} data-testid="workspace-sidebar">
    <div className="sidebar-mobile-head"><Logo testId="sidebar-mobile-logo"/><button className="icon-button" data-testid="mobile-close-button" aria-label="Close workspace navigation" onClick={() => setMobileOpen(false)}><X size={18}/></button></div>
    <div className="desktop-logo"><Logo testId="sidebar-logo"/></div>
    <div className="current-role" data-testid="current-user-role"><RoleIcon size={16}/><span><small>Signed in as</small><b>{role}</b></span><LockKeyhole size={14}/></div>
    <div className="nav-label">{t("nav.workspace")}</div>
    <nav>{navigation[role].map(([label, Icon]) => <button key={label} className={page === label ? "selected" : ""} onClick={() => { setPage(label); setMobileOpen(false); }} data-testid={`nav-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`}><Icon size={18}/>{t(navTranslationKeys[label] || label)}</button>)}</nav>
    <div className="sidebar-bottom"><LanguageSwitcher className="sidebar-language"/><div className="theme-row"><span><Sun size={15}/>{t("nav.appearance")}</span><button data-testid="theme-toggle-button" aria-label="Toggle color theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon size={16}/> : <Sun size={16}/>}</button></div><div className="profile-chip" data-testid="signed-in-user"><div className="avatar">{initials}</div><span><b>{displayName}</b><small>{session.user.email || role}</small></span></div></div>
  </aside>;
};

const Workspace = ({ role = "passenger", profile, session, onSignOut }) => {
  const [page, setPage] = useState(role === "passenger" ? "Search" : role === "authority" ? "Live monitoring" : "Access codes"); const [theme, setTheme] = useState("light"); const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { getUserSettings(session.user.id).then(settings => { if (settings?.theme) setTheme(settings.theme); }).catch(() => {}); }, [session.user.id]);
  useEffect(() => { const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.classList.toggle("dark", dark); }, [theme]);
  const pageProps = { page, session, profile, theme, setTheme, onSignOut };
  return <div className="workspace" data-testid="workspace">
    <Sidebar {...{ role, page, setPage, theme, setTheme, mobileOpen, setMobileOpen, profile, session, onSignOut }}/>
    {mobileOpen && <button className="sidebar-scrim" data-testid="mobile-navigation-scrim" aria-label="Close workspace navigation" onClick={() => setMobileOpen(false)}/>} 
    <main className="workspace-main"><div className="mobile-top"><Logo testId="workspace-mobile-logo"/><button className="icon-button" data-testid="mobile-menu-button" aria-label="Open workspace navigation" onClick={() => setMobileOpen(true)}><Menu/></button></div>
      {profile?.facility_id && <div className="facility-chip" data-testid="assigned-facility"><MapPin size={14}/>Facility access is code-locked</div>}
      <WorkspaceUtilities role={role} setPage={setPage}/>
      {page === "MF AI" && <MahaFlowAI role={role} session={session}/>}
      {role === "passenger" && page !== "MF AI" && <PassengerWorkspace {...pageProps}/>}
      {role === "authority" && page !== "MF AI" && <AuthorityWorkspace {...pageProps}/>}
      {role === "developer" && <DeveloperWorkspace {...pageProps}/>} 
    </main>
  </div>;
};

export default function App() {
  const auth = useAuthSession();
  const { t } = useLanguage();
  const authorityPending = sessionStorage.getItem("mahaflow-authority-onboarding") === "true";
  if (import.meta.env.DEV && window.location.pathname === "/map-health") return <main className="map-health" data-testid="map-health-page"><h1>Google Maps diagnostic</h1><MapView/><p data-testid="map-health-help">This preview-only route uses the same key and component as MahaFlow workspaces.</p></main>;
  if (auth.loading) return <main className="session-loader" data-testid="session-loading"><Logo testId="session-loader-logo"/><span>{t("app.restoring")}</span></main>;
  if (window.location.pathname === "/reset-password") return <ResetPassword session={auth.session} onFinished={() => window.location.reload()}/>;
  if (auth.session && authorityPending && auth.role === "passenger") return <AuthorityOnboarding session={auth.session} onComplete={() => auth.applySession(auth.session)} onCancel={auth.signOut}/>;
  if (auth.session && auth.profile?.status && auth.profile.status !== "active") return <main className="access-restricted" data-testid="access-restricted"><ShieldCheck/><h1>Account access paused</h1><p>Your MahaFlow account is {auth.profile.status}. Contact a platform developer for review.</p><button className="outline-button" data-testid="restricted-logout-button" onClick={auth.signOut}>Sign out</button></main>;
  return auth.session ? <Workspace role={auth.role} profile={auth.profile} session={auth.session} onSignOut={auth.signOut}/> : <AuthPage onAuthenticated={auth.applySession} authError={auth.error}/>;
}