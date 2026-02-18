import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import Editor from "./WebEditor/Editor";
import ResizeHandle from "./ResizeHandle";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";

const MIN_SECOND_PERCENT = 20;
const MAX_SECOND_PERCENT = 80;
const LMS_SAVE_DELAY_MS = 1500;

/**
 * Parse LMS URL params for save/load to student_saved_projects.
 * Required from URL: studentId, courseId, topicId, levelId.
 * apiBase: from URL, or fallback to REACT_APP_API_BASE_URL from .env.
 * authToken: required for API-based save/load.
 */
function getLmsParams() {
  if (typeof window === "undefined" || !window.location.search) return null;
  const params = new URLSearchParams(window.location.search);
  const apiBase = params.get("apiBase") || process.env.REACT_APP_API_BASE_URL || "";
  const authToken = params.get("authToken");
  const studentId = params.get("studentId");
  const courseId = params.get("courseId");
  const topicId = params.get("topicId");
  const topicName = params.get("topicName") ? decodeURIComponent(params.get("topicName")) : null;
  const levelId = params.get("levelId");
  const projectId = params.get("savedProjectId") || params.get("projectId");
  const teamMemberIdsRaw = params.get("teamMemberIds");
  const teamMemberIds = teamMemberIdsRaw ? teamMemberIdsRaw.split(",").map((id) => id.trim()).filter(Boolean) : [];
  if (!apiBase || !authToken || !studentId || !courseId || !topicId || !levelId) return null;
  return { apiBase, authToken, studentId, courseId, topicId, topicName: topicName || "Project", levelId, projectId, teamMemberIds };
}

function LaunguageManager() {
  const getBlobURL = (code, type) => {
    if (!code) return "";
    const blob = new Blob([code], { type });
    return URL.createObjectURL(blob);
  };

  const [html, setHtml] = useState("");
  const [css, setCss] = useState("");
  const [js, setJs] = useState("");
  const [secondEditor, setSecondEditor] = useState("css");
  const [editorPreviewSplit, setEditorPreviewSplit] = useState(50);
  const [secondEditorPercent, setSecondEditorPercent] = useState(50);
  const [mobileView, setMobileView] = useState("split");
  const [lmsContext, setLmsContext] = useState(null);
  const [lmsProjectId, setLmsProjectId] = useState(null);
  const [lmsSaveStatus, setLmsSaveStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef(null);
  const latestRef = useRef({ html: "", css: "", js: "" });

  const cssURL = getBlobURL(css, "text/css");
  const jsURL = getBlobURL(js, "text/javascript");

  const srcDoc = `
      <!DOCTYPE html>
      <html>
      <head>
      ${css ? `<link rel="stylesheet" type="text/css" href="${cssURL}" />` : ""}
      <script src="https://code.jquery.com/jquery-3.5.1.min.js"
      integrity="sha256-9/aliU8dGd2tb6OSsuzixeV4y/faTqgFtohetphbbj0=" crossorigin="anonymous"></script>
      </head>
        <body>${html}
        ${js ? `<script src="${jsURL}"></script>` : ""}
        </body>
      </html>`;

  const loadLmsProject = useCallback((lms) => {
    const { apiBase, authToken, projectId, topicId } = lms;
    const client = axios.create({
      baseURL: apiBase,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const loadFromProject = (project) => {
      const data = project.project_data;
      const hasWebData = data && (data.html != null || data.css != null || data.js != null);
      const hasLegacyHtml = project.project_html;
      if (hasWebData || hasLegacyHtml) {
        const h = hasWebData && data.html != null ? data.html : (project.project_html || "");
        const c = hasWebData && data.css != null ? data.css : "";
        const j = hasWebData && data.js != null ? data.js : (project.project_code || "");
        latestRef.current = { html: h, css: c, js: j };
        setHtml(h);
        setCss(c);
        setJs(j);
        setLmsProjectId(project.id);
      }
    };

    if (projectId) {
      client
        .get(`/student-courses/project/${projectId}`)
        .then((res) => loadFromProject(res.data))
        .catch((err) => console.error("Failed to load project:", err))
        .finally(() => setLoading(false));
      return;
    }

    client
      .get(`/student-courses/topic/${topicId}/projects`)
      .then((res) => {
        const list = res.data || [];
        const hasWebData = (p) =>
          (p.project_data && p.project_data.html != null) ||
          p.project_type === "html" ||
          p.project_type === "web";
        const current = list.find((p) => p.is_current && hasWebData(p)) || list.find(hasWebData);
        if (current) loadFromProject(current);
      })
      .catch((err) => console.error("Failed to load topic projects:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const lms = getLmsParams();
    if (lms) {
      setLmsContext(lms);
      setLmsProjectId(lms.projectId || null);
      loadLmsProject(lms);
    } else {
      setLoading(false);
    }
  }, [loadLmsProject]);

  const doLmsSave = useCallback(() => {
    if (!lmsContext) return;
    saveTimerRef.current = null;

    setLmsSaveStatus("saving");
    const { apiBase, authToken, courseId, topicId, topicName, levelId, teamMemberIds } = lmsContext;
    const client = axios.create({
      baseURL: apiBase,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    const editorUrl =
      typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";
    const { html: h, css: c, js: j } = latestRef.current;
    const body = {
      topic_id: topicId,
      course_level_id: levelId,
      course_id: courseId,
      project_name: topicName && String(topicName).trim() ? topicName : "Project",
      editor_type: "inter",
      editor_url: editorUrl,
      project_data: { html: h || "", css: c || "", js: j || "" },
      project_type: "html",
      file_format: "html",
      is_autosaved: true,
    };
    if (lmsProjectId) body.project_id = lmsProjectId;
    if (teamMemberIds && teamMemberIds.length > 0) body.team_member_ids = teamMemberIds;

    client
      .post("/student-courses/save-project", body)
      .then((res) => {
        const id = res.data && res.data.id;
        setLmsProjectId(id || lmsProjectId);
        setLmsSaveStatus("saved");
        setTimeout(() => setLmsSaveStatus(null), 2000);
      })
      .catch((err) => {
        console.error("Auto-save failed:", err.response?.data || err.message);
        setLmsSaveStatus("error");
        setTimeout(() => setLmsSaveStatus(null), 3000);
      });
  }, [lmsContext, lmsProjectId]);

  const scheduleLmsSave = useCallback(() => {
    if (!lmsContext) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doLmsSave, LMS_SAVE_DELAY_MS);
  }, [lmsContext, doLmsSave]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleHtmlChange = (val) => {
    latestRef.current.html = val;
    setHtml(val);
    if (lmsContext) scheduleLmsSave();
  };
  const handleCssChange = (val) => {
    latestRef.current.css = val;
    setCss(val);
    if (lmsContext) scheduleLmsSave();
  };
  const handleJsChange = (val) => {
    latestRef.current.js = val;
    setJs(val);
    if (lmsContext) scheduleLmsSave();
  };

  const handleEditorPreviewResize = (delta, { deltaX, deltaY } = {}) => {
    const container = document.querySelector(".editor-layout");
    if (!container) return;
    const isRow = window.innerWidth > 768;
    const size = isRow ? container.offsetWidth : container.offsetHeight;
    const d = isRow ? (deltaX ?? delta) : (deltaY ?? -delta);
    const deltaPercent = (d / size) * 100;
    setEditorPreviewSplit((prev) => Math.max(25, Math.min(75, prev + deltaPercent)));
  };

  const handleSecondEditorResize = (deltaY) => {
    setSecondEditorPercent((prev) => {
      const container = document.querySelector(".editors-stack");
      if (!container) return prev;
      const totalH = container.offsetHeight;
      const deltaPercent = totalH > 0 ? (deltaY / totalH) * 100 : 0;
      return Math.max(MIN_SECOND_PERCENT, Math.min(MAX_SECOND_PERCENT, prev - deltaPercent));
    });
  };

  if (loading) {
    return (
      <div className="editor-layout" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="text-center" style={{ color: "#9ca3af", fontSize: "1rem" }}>
          <div
            className="spinner-border"
            role="status"
            style={{ width: "2rem", height: "2rem", marginBottom: "0.5rem" }}
          >
            <span className="visually-hidden">Loading...</span>
          </div>
          <p>Loading your project...</p>
        </div>
      </div>
    );
  }

  const showCode = mobileView === "code" || mobileView === "split";
  const showPreview = mobileView === "preview" || mobileView === "split";

  return (
    <div className="editor-layout">
      <div className="mobile-view-toggle" aria-label="View mode">
        <button
          className={mobileView === "code" ? "active" : ""}
          onClick={() => setMobileView("code")}
          title="Code only"
        >
          <i className="fas fa-code" aria-hidden />
          <span>Code</span>
        </button>
        <button
          className={mobileView === "split" ? "active" : ""}
          onClick={() => setMobileView("split")}
          title="Split view"
        >
          <i className="fas fa-columns" aria-hidden />
          <span>Split</span>
        </button>
        <button
          className={mobileView === "preview" ? "active" : ""}
          onClick={() => setMobileView("preview")}
          title="Preview only"
        >
          <i className="fas fa-eye" aria-hidden />
          <span>Preview</span>
        </button>
      </div>

      <div
        className={`editors-panel ${showCode ? "" : "hidden"}`}
        style={{ flex: showCode ? `0 0 ${editorPreviewSplit}%` : "0 0 0" }}
      >
        <div className="editor-toolbar">
          <span className="toolbar-label">Editor:</span>
          <button
            className={secondEditor === "css" ? "active" : ""}
            onClick={() => setSecondEditor("css")}
            aria-pressed={secondEditor === "css"}
          >
            <i className="fab fa-css3-alt" aria-hidden /> CSS
          </button>
          <button
            className={secondEditor === "js" ? "active" : ""}
            onClick={() => setSecondEditor("js")}
            aria-pressed={secondEditor === "js"}
          >
            <i className="fab fa-js-square" aria-hidden /> JS
          </button>
          <span className={`lms-save-status ${lmsSaveStatus || ""}`}>
            {lmsContext ? (
              <>
                {lmsSaveStatus === "saving" && <><i className="fas fa-spinner fa-spin" aria-hidden /> Saving…</>}
                {lmsSaveStatus === "saved" && <><i className="fas fa-check" aria-hidden /> Saved</>}
                {lmsSaveStatus === "error" && <><i className="fas fa-exclamation-triangle" aria-hidden /> Save failed</>}
                {!lmsSaveStatus && <><i className="fas fa-cloud" aria-hidden /> Auto-save</>}
              </>
            ) : (
              <span className="lms-save-status-hint">Open from Courses to save</span>
            )}
          </span>
        </div>

        <div className="editors-stack">
          <div
            className="editor-slot html-slot"
            style={{ flex: `1 1 ${100 - secondEditorPercent}%`, minHeight: 0 }}
          >
            <div className="editor-text">
              <i className="fab fa-html5" aria-hidden /> HTML
            </div>
            <Editor launguage="xml" value={html} onChange={handleHtmlChange} />
          </div>

          <ResizeHandle orientation="horizontal" onResize={handleSecondEditorResize} />

          <div
            className={`editor-slot ${secondEditor}-slot`}
            style={{ flex: `1 1 ${secondEditorPercent}%`, minHeight: 0 }}
          >
            {secondEditor === "css" ? (
              <>
                <div className="editor-text">
                  <i className="fab fa-css3-alt" aria-hidden /> CSS
                </div>
                <Editor launguage="css" value={css} onChange={handleCssChange} />
              </>
            ) : (
              <>
                <div className="editor-text">
                  <i className="fab fa-js-square" aria-hidden /> JavaScript
                </div>
                <Editor launguage="javascript" value={js} onChange={handleJsChange} />
              </>
            )}
          </div>
        </div>
      </div>

      {showCode && showPreview && (
        <ResizeHandle orientation="vertical" onResize={handleEditorPreviewResize} />
      )}

      <div
        className={`preview-panel ${showPreview ? "" : "hidden"}`}
        style={{ flex: showPreview ? `1 1 ${mobileView === "preview" ? "100%" : `${100 - editorPreviewSplit}%`}` : "0 0 0" }}
      >
        <div className="preview-heading">
          <i className="fas fa-desktop" aria-hidden /> Live Preview
        </div>
        <iframe srcDoc={srcDoc} className="output-pane" allowFullScreen title="Preview" />
      </div>

    </div>
  );
}

export default LaunguageManager;
