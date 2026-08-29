import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "../components/Footer";

export default function NotFound() {
  return (
    <div>
      <Nav />
      <section className="container-page flex flex-col items-center py-24 text-center">
        <h1 className="font-display text-4xl font-semibold">Page not found.</h1>
        <p className="mt-3 text-muted">This link may have expired, or it never existed.</p>
        <Link to="/" className="btn-primary mt-6">Back to Signal</Link>
      </section>
      <Footer />
    </div>
  );
}
