import { I18nProvider } from "../i18n";
import { RoundTable } from "../features/round-table/RoundTable";
import "./App.scss";
export function App() { return <I18nProvider><main className="consilium-app"><RoundTable /></main></I18nProvider>; }
