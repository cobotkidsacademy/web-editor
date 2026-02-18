//importing requirements
import React, { Component, Suspense, lazy } from "react";
import pushid from "pushid";
import axios from "axios";

import "./App.css";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/material.css";
import "codemirror/addon/hint/show-hint.css";

const EditorPanels = lazy(() => import("./EditorPanels"));
const ResizeHandle = lazy(() => import("./ResizeHandle"));

// Parse URL query params for LMS integration (studentId, courseId, courseName, levelId, levelName, topicId, topicName, apiBase, authToken, savedProjectId)
function getLmsParams() {
  if (typeof window === "undefined" || !window.location.search) return null;
  const params = new URLSearchParams(window.location.search);
  const apiBase = params.get("apiBase");
  const authToken = params.get("authToken");
  const studentId = params.get("studentId");
  const courseId = params.get("courseId");
  const courseName = params.get("courseName") ? decodeURIComponent(params.get("courseName")) : null;
  const topicId = params.get("topicId");
  const topicName = params.get("topicName") ? decodeURIComponent(params.get("topicName")) : null;
  const levelId = params.get("levelId");
  const levelName = params.get("levelName") ? decodeURIComponent(params.get("levelName")) : null;
  const projectId = params.get("savedProjectId") || params.get("projectId");
  if (!apiBase || !authToken || !studentId || !courseId || !topicId || !levelId) return null;
  return {
    apiBase,
    authToken,
    studentId,
    courseId,
    courseName: courseName || "",
    topicId,
    topicName: topicName || "Project",
    levelId,
    levelName: levelName || "",
    projectId
  };
}

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      id: "",
      html: "",
      css: "",
      js: "",
      secondEditor: "css",
      editorPreviewSplit: 50,
      lmsProjectId: null,
      lmsSaveStatus: null, // null | "saving" | "saved" | "error"
      lmsContext: null
    };

    this.pusher = null;
    this.channel = null;
    this.lmsSaveTimer = null;
    this.LMS_SAVE_DELAY_MS = 1500;
  }

  componentDidUpdate() {
    this.runCode();
  }

  componentDidMount() {
    this.setState({ id: pushid() });

    const lms = getLmsParams();
    if (lms) {
      this.setState({ lmsContext: lms, lmsProjectId: lms.projectId || null });
      this.loadLmsProject(lms);
    }

    if (!lms) {
      import("pusher-js").then(({ default: Pusher }) => {
        const pusher = new Pusher("d90d11b1a8b505ec91f5", { cluster: "ap2", forceTLS: true });
        const channel = pusher.subscribe("editor");
        channel.bind("text-update", data => {
          const { id } = this.state;
          if (data.id === id) return;
          this.setState({ html: data.html, css: data.css, js: data.js });
        });
        this.pusher = pusher;
        this.channel = channel;
      });
    }
  }

  componentWillUnmount() {
    if (this.lmsSaveTimer) clearTimeout(this.lmsSaveTimer);
    if (this.pusher) this.pusher.disconnect();
  }

  loadLmsProject = (lms) => {
    const { apiBase, authToken, projectId, topicId } = lms;
    const client = axios.create({
      baseURL: apiBase,
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const loadFromProject = (project) => {
      const data = project.project_data;
      const hasWebData = data && (data.html != null || data.css != null || data.js != null);
      const hasLegacyHtml = project.project_html;
      if (hasWebData || hasLegacyHtml) {
        this.setState({
          html: hasWebData && data.html != null ? data.html : (project.project_html || ""),
          css: hasWebData && data.css != null ? data.css : "",
          js: hasWebData && data.js != null ? data.js : (project.project_code || ""),
          lmsProjectId: project.id
        });
      }
    };

    if (projectId) {
      client.get(`/student-courses/project/${projectId}`).then((res) => {
        loadFromProject(res.data);
      }).catch((err) => {
        console.error("Failed to load project by id:", err);
      });
      return;
    }

    client.get(`/student-courses/topic/${topicId}/projects`).then((res) => {
      const list = res.data || [];
      const hasWebData = (p) => (p.project_data && p.project_data.html != null) || p.project_type === "html" || p.project_type === "web";
      const current = list.find((p) => p.is_current && hasWebData(p)) || list.find(hasWebData);
      if (current) loadFromProject(current);
    }).catch((err) => {
      console.error("Failed to load topic projects:", err);
    });
  };

  scheduleLmsSave = () => {
    if (!this.state.lmsContext) return;
    if (this.lmsSaveTimer) clearTimeout(this.lmsSaveTimer);
    this.lmsSaveTimer = setTimeout(this.doLmsSave, this.LMS_SAVE_DELAY_MS);
  };

  doLmsSave = () => {
    this.lmsSaveTimer = null;
    const { lmsContext, lmsProjectId, html, css, js } = this.state;
    if (!lmsContext) return;

    this.setState({ lmsSaveStatus: "saving" });
    const { apiBase, authToken, courseId, topicId, topicName, levelId } = lmsContext;
    const client = axios.create({
      baseURL: apiBase,
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }
    });

    const editorUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";
    const body = {
      topic_id: topicId,
      course_level_id: levelId,
      course_id: courseId,
      project_name: topicName && String(topicName).trim() ? topicName : "Project",
      editor_type: "inter",
      editor_url: editorUrl,
      project_data: { html: html || "", css: css || "", js: js || "" },
      project_type: "html",
      file_format: "html",
      is_autosaved: true
    };
    if (lmsProjectId) body.project_id = lmsProjectId;

    client.post("/student-courses/save-project", body).then((res) => {
      const id = res.data && res.data.id;
      this.setState({ lmsSaveStatus: "saved", lmsProjectId: id || lmsProjectId });
      setTimeout(() => this.setState({ lmsSaveStatus: null }), 2000);
    }).catch((err) => {
      const msg = err.response && err.response.data && (err.response.data.message || err.response.data.error || err.response.data);
      console.error("Auto-save failed:", msg || err.message, err.response && err.response.data);
      this.setState({ lmsSaveStatus: "error" });
      setTimeout(() => this.setState({ lmsSaveStatus: null }), 3000);
    });
  };

  syncUpdates = () => {
    const data = { ...this.state };
    axios
      .post("http://localhost:5002/update-editor", data)
      .catch(console.error);
    this.scheduleLmsSave();
  };

  runCode = () => {
    const { html, css, js } = this.state;

    const iframe = this.refs.iframe;
    const document = iframe.contentDocument;
    const documentContents = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>Document</title>
        <style>
          ${css}
        </style>
      </head>
      <body>
        ${html}

        <script type="text/javascript">
          ${js}
        </script>
      </body>
      </html>
    `;

    document.open();
    document.write(documentContents);
    document.close();
  };

  downloadCode() {
    const documentContents = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>Document</title>
        <style>
          ${this.state.css}
        </style>
      </head>
      <body>
        ${this.state.html}
        <script type="text/javascript">
          ${this.state.js}
        </script>
      </body>
      </html>
    `;

    var element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=UTF-8," + encodeURIComponent(documentContents)
    );
    element.setAttribute("download", "index.html");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  handleEditorPreviewResize = (delta, { deltaX, deltaY } = {}) => {
    this.setState((prev) => {
      const container = document.querySelector(".main-content");
      if (!container) return prev;
      const isRow = window.innerWidth > 768;
      const size = isRow ? container.offsetWidth : container.offsetHeight;
      const d = isRow ? (deltaX ?? delta) : (deltaY ?? -delta);
      const deltaPercent = (d / size) * 100;
      let next = prev.editorPreviewSplit + deltaPercent;
      next = Math.max(25, Math.min(75, next));
      return { editorPreviewSplit: next };
    });
  };

  render() {
    const { html, js, css, secondEditor, editorPreviewSplit, lmsSaveStatus, lmsContext } = this.state;

    return (
      <div className="App">
        <div className="toolbar">
          <div className="toolbar-toggle">
            <span className="toolbar-label">Switch editor:</span>
            <button
              className={secondEditor === "css" ? "active" : ""}
              onClick={() => this.setState({ secondEditor: "css" })}
            >
              CSS
            </button>
            <button
              className={secondEditor === "js" ? "active" : ""}
              onClick={() => this.setState({ secondEditor: "js" })}
            >
              JavaScript
            </button>
          </div>
          <button className="download-btn" onClick={() => this.downloadCode()}>
            Download Code
          </button>
          {lmsContext && (
            <span className={`lms-save-status ${lmsSaveStatus || ""}`}>
              {lmsSaveStatus === "saving" && "Saving…"}
              {lmsSaveStatus === "saved" && "Saved"}
              {lmsSaveStatus === "error" && "Save failed"}
            </span>
          )}
        </div>

        <div className="main-content">
          <Suspense fallback={<div className="editors-loading">Loading editor…</div>}>
            <div className="editors-wrapper" style={{ flex: `0 0 ${editorPreviewSplit}%` }}>
              <EditorPanels
                html={html}
                css={css}
                js={js}
                secondEditor={secondEditor}
                onHtmlChange={(html) => this.setState({ html }, () => this.syncUpdates())}
                onCssChange={(css) => this.setState({ css }, () => this.syncUpdates())}
                onJsChange={(js) => this.setState({ js }, () => this.syncUpdates())}
              />
            </div>
            <ResizeHandle orientation="vertical" onResize={this.handleEditorPreviewResize} />
            <section className="liveviewsection" style={{ flex: `1 1 ${100 - editorPreviewSplit}%` }}>
              <div className="section-heading">Preview</div>
              <iframe title="result" className="iframe" ref="iframe" />
            </section>
          </Suspense>
        </div>
      </div>
    );
  }
}

export default App;
