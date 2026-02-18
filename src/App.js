import React from "react";
import WebEditor from "./Components/WebEditor";
import { BrowserRouter as Router, Route } from "react-router-dom";

function App() {
  return (
    <Router>
      <Route path="/" component={WebEditor} />
    </Router>
  );
}

export default App;
