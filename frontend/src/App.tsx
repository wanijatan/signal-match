import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import SignalFlow from "./pages/SignalFlow";
import Login from "./pages/Login";
import MySignal from "./pages/MySignal";
import MatchPage from "./pages/MatchPage";
import RequestPage from "./pages/RequestPage";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/admin/AdminLayout";
import Overview from "./pages/admin/Overview";
import Signals from "./pages/admin/Signals";
import Matches from "./pages/admin/Matches";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/start" element={<SignalFlow />} />
      <Route path="/login" element={<Login />} />
      <Route path="/my-signal" element={<MySignal />} />
      <Route path="/match/:token" element={<MatchPage />} />
      <Route path="/request/:token" element={<RequestPage />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Overview />} />
        <Route path="signals" element={<Signals />} />
        <Route path="matches" element={<Matches />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
