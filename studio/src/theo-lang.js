import { StreamLanguage } from "@codemirror/language";

const theoLanguage = StreamLanguage.define({
  startState() {
    return { inCode: false };
  },
  token(stream, state) {
    // Fenced code blocks
    if (stream.match(/^```/)) {
      state.inCode = !state.inCode;
      return "meta";
    }
    if (state.inCode) {
      stream.skipToEnd();
      return "string";
    }

    // Title
    if (stream.sol() && stream.match(/^#\s+/)) {
      stream.skipToEnd();
      return "heading";
    }
    // Author
    if (stream.sol() && stream.match(/^@\s+/)) {
      stream.skipToEnd();
      return "keyword";
    }
    // Reference
    if (stream.sol() && stream.match(/^ref\s+/)) {
      stream.skipToEnd();
      return "link";
    }
    // Section header
    if (stream.sol() && stream.match(/^==\s+/)) {
      stream.skipToEnd();
      return "heading";
    }
    // Argument start
    if (stream.sol() && stream.match(/^>>\s+/)) {
      stream.skipToEnd();
      return "atom";
    }
    // Claim
    if (stream.sol() && stream.match(/^>\s+/)) {
      stream.skipToEnd();
      return "variable-2";
    }
    // Figure
    if (stream.sol() && stream.match(/^~~\s+/)) {
      stream.skipToEnd();
      return "tag";
    }
    // Argument fields (indented)
    if (stream.sol() && stream.match(/^\s+(evidence|counter|synthesis|thesis):/)) {
      stream.skipToEnd();
      return "property";
    }
    // Separator
    if (stream.sol() && stream.match(/^---$/)) {
      return "hr";
    }

    stream.next();
    return null;
  },
});

export default theoLanguage;
