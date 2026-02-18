import React from "react";
import CodeMirrorLib from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/material.css";
import { Controlled as CodeMirror } from "react-codemirror2";
import "codemirror/mode/xml/xml";
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/css/css";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/matchtags";
import "codemirror/addon/edit/closebrackets";
import "codemirror/addon/edit/matchbrackets";

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

function Editor(props) {
  const mode = props.launguage;
  const isHtml = mode === "xml";
  const options = {
    mode: mode,
    theme: "material",
    lineNumbers: true,
    scrollbarStyle: "null",
    lineWrapping: true,
    indentUnit: 2,
    autoCloseTags: true,
    matchTags: true,
    autoCloseBrackets: true,
    matchBrackets: true,
  };
  if (isHtml) {
    options.extraKeys = options.extraKeys || {};
    options.extraKeys["Enter"] = htmlEnterKeyHandler;
  }
  return (
    <div>
      <CodeMirror
        value={props.value}
        options={options}
        onBeforeChange={(editor, data, value) => {
          props.onChange(value);
        }}
      />
    </div>
  );
}

export default Editor;
