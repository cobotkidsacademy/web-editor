import React, { useState } from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import CodeMirrorLib from "codemirror";
import ResizeHandle from "./ResizeHandle";
import "codemirror/mode/htmlmixed/htmlmixed";
import "codemirror/mode/css/css";
import "codemirror/mode/javascript/javascript";
import "codemirror/addon/hint/show-hint";
import "codemirror/addon/hint/css-hint";
import "codemirror/addon/edit/closebrackets";
import "codemirror/addon/fold/xml-fold";
import "codemirror/addon/edit/closetag";

/** When pressing Enter between two tags (e.g. <div>|</div>), inserts newline, indent, blank line, and moves closing tag to its own line */
function htmlEnterKeyHandler(cm) {
  const cursor = cm.getCursor();
  const line = cursor.line;
  const ch = cursor.ch;
  const lineText = cm.getLine(line);
  const textFromCursor = lineText.substring(ch);
  const match = textFromCursor.match(/^\s*<\/(\w+)>\s*$/);
  if (!match) {
    return CodeMirrorLib.Pass;
  }
  const tagName = match[1];
  const baseIndent = lineText.match(/^(\s*)/)[1];
  const indentUnit = cm.getOption("indentUnit") || 2;
  const innerIndent = baseIndent + " ".repeat(indentUnit);
  const closingTag = "</" + tagName + ">";
  const insertText = "\n" + innerIndent + "\n" + baseIndent + closingTag;
  cm.replaceRange(insertText, { line, ch }, { line, ch: lineText.length });
  cm.setCursor({ line: line + 1, ch: innerIndent.length });
}

const codeMirrorOptions = {
  theme: "material",
  lineNumbers: true,
  scrollbarStyle: null,
  lineWrapping: true,
  indentUnit: 2,
  extraKeys: { Enter: htmlEnterKeyHandler },
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

const MIN_SECOND_HEIGHT = 80;
const MAX_SECOND_HEIGHT = 500;
const DEFAULT_SECOND_HEIGHT = 180;

export default function EditorPanels({ html, css, js, secondEditor, onHtmlChange, onCssChange, onJsChange }) {
  const [secondEditorHeight, setSecondEditorHeight] = useState(DEFAULT_SECOND_HEIGHT);

  const handleResize = (deltaY, _extra) => {
    setSecondEditorHeight((prev) => Math.max(MIN_SECOND_HEIGHT, Math.min(MAX_SECOND_HEIGHT, prev - deltaY)));
  };

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
      <ResizeHandle orientation="horizontal" onResize={handleResize} />
      <div
        className={`code-editor ${secondEditor === "css" ? "css-editor" : "js-editor"}`}
        style={{ flex: `0 0 ${secondEditorHeight}px`, minHeight: MIN_SECOND_HEIGHT }}
      >
        {secondEditor === "css" ? (
          <>
            <div className="editor-header">CSS</div>
            <CodeMirror
              value={css}
              options={{
                mode: "css",
                ...codeMirrorOptions,
                extraKeys: { ...codeMirrorOptions.extraKeys, "Ctrl-Space": "autocomplete" },
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
          </>
        ) : (
          <>
            <div className="editor-header">JavaScript</div>
            <CodeMirror
              value={js}
              options={{ mode: "javascript", ...codeMirrorOptions }}
              onBeforeChange={(editor, data, value) => onJsChange(value)}
            />
          </>
        )}
      </div>
    </div>
  );
}
