import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("The page is missing its root container");
}

createRoot(container).render(<App />);
