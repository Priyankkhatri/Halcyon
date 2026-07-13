import { useState } from 'react';
import { Route, Switch } from "wouter";
import LandingPage from './components/LandingPage';
import AppShell from './components/layout/AppShell';
import Dashboard from './components/Dashboard';
import IncidentDetail from './components/IncidentDetail';
import MemoryView from './components/MemoryView';
import AuditView from './components/AuditView';
import BillingView from './components/BillingView';
import SettingsView from './components/SettingsView';

function App() {
  const [inApp, setInApp] = useState(false);
  const [globalState, setGlobalState] = useState('calm');

  if (!inApp) {
    return <LandingPage onEnterApp={() => setInApp(true)} />;
  }

  return (
    <AppShell systemState={globalState}>
      <Switch>
        <Route path="/">
          <Dashboard setGlobalState={setGlobalState} />
        </Route>
        <Route path="/incident/:id">
          {(params) => <IncidentDetail id={params.id} />}
        </Route>
        <Route path="/memory">
          <MemoryView />
        </Route>
        <Route path="/audit">
          <AuditView />
        </Route>
        <Route path="/billing">
          <BillingView />
        </Route>
        <Route path="/settings">
          <SettingsView />
        </Route>
        <Route>
          <div className="text-center py-20 text-halcyon-text-muted">404 - Not Found</div>
        </Route>
      </Switch>
    </AppShell>
  );
}

export default App;
