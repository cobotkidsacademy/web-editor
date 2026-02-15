import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import CodeMirrorLib from "codemirror";
import "codemirror/mode/htmlmixed/htmlmixed";
import "codemirror/mode/css/css";
import "codemirror/mode/javascript/javascript";
import "codemirror/addon/hint/show-hint";
import "codemirror/addon/hint/css-hint";
import "codemirror/addon/edit/closebrackets";
import "codemirror/addon/fold/xml-fold";
import "codemirror/addon/edit/closetag";

const codeMirrorOptions = {
  theme: "material",
  lineNumbers: true,
  scrollbarStyle: null,
  lineWrapping: true,
  autoCloseBrackets: { pairs: "()[]{}''\"\":;", explode: "[]{}", override: true },
  autoCloseTags: {
    whenOpening: true,
    whenClosing: true,
    indentTags: [],
    dontCloseTags: [
      "area", "base", "br", "col", "command", "embed", "hr", "img", "input", "keygen", "link",
      "meta", "param", "source", "track", "wbr"
    ]
  }
};

export default function EditorPanels({ html, css, js, secondEditor, onHtmlChange, onCssChange, onJsChange }) {
  return (
    <div className="editors-container">
      <div className="code-editor html-editor">
        <div className="editor-header">HTML</div>
        <CodeMirror
          value={html}
          options={{ mode: "htmlmixed", ...codeMirrorOptions }}
          onBeforeChange={(editor, data, value) => onHtmlChange(value)}
        />
      </div>
      {secondEditor === "css" && (
        <div className="code-editor css-editor">
          <div className="editor-header">CSS</div>
          <CodeMirror
            value={css}
            options={{
              mode: "css",
              ...codeMirrorOptions,
              extraKeys: { "Ctrl-Space": "autocomplete" },
              hintOptions: { completeSingle: false, closeOnUnfocus: true }
            }}
            onBeforeChange={(editor, data, value) => onCssChange(value)}
            editorDidMount={(editor) => {
              let hintDelay;
              editor.on("inputRead", (cm, change) => {
                clearTimeout(hintDelay);
                if (!change.origin || change.origin === "+input") {
                  hintDelay = setTimeout(() => {
                    cm.showHint({ hint: CodeMirrorLib.hint.css, completeSingle: false });
                  }, 300);
                }
              });
            }}
          />
        </div>
      )}
      {secondEditor === "js" && (
        <div className="code-editor js-editor">
          <div className="editor-header">JavaScript</div>
          <CodeMirror
            value={js}
            options={{ mode: "javascript", ...codeMirrorOptions }}
            onBeforeChange={(editor, data, value) => onJsChange(value)}
          />
        </div>
      )}
    </div>
  );
}
