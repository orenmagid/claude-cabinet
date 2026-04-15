#!/usr/bin/env bash
# skill-validator.sh — mechanically validates SKILL.md files against
# the rules encoded in templates/cabinet/skill-best-practices.md.
#
# Usage: bash skill-validator.sh <path-to-SKILL.md> [<path>...]
# Exit: 0 if all pass, 1 if any file fails.

set -u

BEST_PRACTICES_DOC="templates/cabinet/skill-best-practices.md"

TOTAL=0
PASSED=0
FAILED=0
FAILED_FILES=()

# --- helpers ---------------------------------------------------------

pass() {
  local file="$1" check="$2" detail="$3"
  printf '[PASS] %s: %s (%s)\n' "$file" "$check" "$detail"
}

fail() {
  local file="$1" check="$2" detail="$3" hint="$4"
  printf '[FAIL] %s: %s (%s)\n' "$file" "$check" "$detail"
  printf '       → %s\n' "$hint"
  FILE_FAILED=1
}

warn() {
  local file="$1" check="$2" detail="$3" hint="$4"
  printf '[WARN] %s: %s (%s)\n' "$file" "$check" "$detail"
  printf '       → %s\n' "$hint"
}

# Extract frontmatter (between first two lines that are exactly "---")
# into a variable. Prints frontmatter lines to stdout.
# Returns 0 if frontmatter found, 1 otherwise.
extract_frontmatter() {
  local file="$1"
  awk '
    BEGIN { state = 0 }
    NR == 1 && /^---$/ { state = 1; next }
    state == 1 && /^---$/ { exit }
    state == 1 { print }
  ' "$file"
}

# Count body lines (content after closing ---).
# If no frontmatter, body = whole file.
body_line_count() {
  local file="$1"
  awk '
    BEGIN { state = 0; count = 0 }
    NR == 1 && /^---$/ { state = 1; next }
    state == 1 && /^---$/ { state = 2; next }
    state == 2 { count++ }
    END {
      if (state == 0) { print NR }    # no frontmatter; count everything
      else if (state == 1) { print 0 } # unclosed frontmatter; treat body as empty
      else { print count }
    }
  ' "$file"
}

# Extract a top-level field value from frontmatter.
# Handles: `field: value` and `field: "value"`.
# Does NOT handle block scalars (>, |) — for those use field_block_scalar.
field_value() {
  local fm="$1" field="$2"
  printf '%s\n' "$fm" | awk -v f="$field" '
    $0 ~ "^" f ":" {
      sub("^" f ": *", "")
      # If the value is a block scalar indicator, return empty so the
      # caller falls through to field_block_scalar.
      if ($0 == ">" || $0 == "|" || $0 == ">-" || $0 == "|-") { print ""; exit }
      gsub(/^["'\'']|["'\'']$/, "")
      print
      exit
    }
  '
}

# Extract a possibly-block-scalar field (description: > or description: |).
# Joins continuation lines with a space.
field_block_scalar() {
  local fm="$1" field="$2"
  printf '%s\n' "$fm" | awk -v f="$field" '
    BEGIN { in_block = 0; first = 1; inline = "" }
    $0 ~ "^" f ":" {
      line = $0
      sub("^" f ": *", "", line)
      if (line == ">" || line == "|") {
        in_block = 1
        next
      }
      # inline value
      gsub(/^["'\'']|["'\'']$/, "", line)
      print line
      exit
    }
    in_block == 1 {
      # stop at next top-level field or end of frontmatter
      if ($0 ~ /^[a-zA-Z_][a-zA-Z0-9_-]*:/) { exit }
      if ($0 ~ /^[^[:space:]]/) { exit }
      sub(/^[[:space:]]+/, "")
      if ($0 == "") next
      if (inline == "") inline = $0
      else inline = inline " " $0
    }
    END {
      if (in_block && inline != "") print inline
    }
  '
}

# Get the skill directory basename (e.g., cabinet-security, plan)
# from a SKILL.md path.
skill_dir_basename() {
  local file="$1"
  basename "$(dirname "$file")"
}

# Extract body (content after second ---)
body_content() {
  local file="$1"
  awk '
    BEGIN { state = 0 }
    NR == 1 && /^---$/ { state = 1; next }
    state == 1 && /^---$/ { state = 2; next }
    state == 2 { print }
  ' "$file"
}

# --- individual checks ----------------------------------------------

check_frontmatter() {
  local file="$1"
  if ! head -1 "$file" | grep -q '^---$'; then
    fail "$file" "frontmatter" "missing opening ---" \
      "Add YAML frontmatter at the top: --- ... ---"
    return 1
  fi
  local fm_lines
  fm_lines=$(extract_frontmatter "$file" | wc -l | tr -d ' ')
  if [[ "$fm_lines" -eq 0 ]]; then
    fail "$file" "frontmatter" "empty or unclosed" \
      "Frontmatter must be between two --- markers on their own lines."
    return 1
  fi
  pass "$file" "frontmatter" "parsed ($fm_lines lines)"
  return 0
}

check_line_count() {
  local file="$1"
  local count
  count=$(body_line_count "$file")
  if [[ "$count" -gt 500 ]]; then
    fail "$file" "line-count" "$count > 500" \
      "Extract sections to reference files. See $BEST_PRACTICES_DOC §Progressive disclosure."
  elif [[ "$count" -ge 450 ]]; then
    warn "$file" "line-count" "$count (approaching 500)" \
      "Consider extracting sections before you hit the limit."
  else
    pass "$file" "line-count" "$count ≤ 500"
  fi
}

check_name() {
  local file="$1" fm="$2"
  local name
  name=$(field_value "$fm" "name")
  if [[ -z "$name" ]]; then
    fail "$file" "name" "missing or empty" \
      "Add 'name: <skill-name>' to frontmatter."
    return
  fi
  if [[ "${#name}" -gt 64 ]]; then
    fail "$file" "name" "${#name} chars > 64" \
      "Shorten the name to 64 characters or fewer."
    return
  fi
  if ! [[ "$name" =~ ^[a-z0-9-]+$ ]]; then
    fail "$file" "name" "'$name' contains invalid chars" \
      "Use lowercase letters, digits, hyphens only."
    return
  fi
  # Reserved words: name must not BE "anthropic"/"claude" or START with
  # those as a whole word. Mid-name usage (e.g., cabinet-anthropic-insider
  # describing the domain) is allowed.
  if [[ "$name" =~ ^(anthropic|claude)(-|$) ]]; then
    fail "$file" "name" "'$name' starts with reserved word (anthropic/claude)" \
      "Rename so it doesn't start with 'anthropic-' or 'claude-'."
    return
  fi
  pass "$file" "name" "'$name'"
}

check_description() {
  local file="$1" fm="$2"
  local desc
  desc=$(field_value "$fm" "description")
  if [[ -z "$desc" ]]; then
    desc=$(field_block_scalar "$fm" "description")
  fi
  if [[ -z "$desc" ]]; then
    fail "$file" "description" "missing or empty" \
      "Add 'description: ...' stating what the skill does and when to use it."
    return
  fi
  if [[ "${#desc}" -gt 1024 ]]; then
    fail "$file" "description" "${#desc} chars > 1024" \
      "Shorten the description to 1024 characters or fewer."
    return
  fi
  if [[ "$desc" =~ \<[a-zA-Z] ]]; then
    fail "$file" "description" "contains XML/HTML tags" \
      "Remove <tag> patterns — use plain prose."
    return
  fi
  # Sentence count: count sentence terminators; require ≥2.
  local period_count
  period_count=$(printf '%s' "$desc" | grep -o '[.!?]' | wc -l | tr -d ' ')
  if [[ "$period_count" -lt 2 ]]; then
    fail "$file" "description" "only $period_count sentence(s)" \
      "Description should state both what the skill does AND when to use it. See $BEST_PRACTICES_DOC §Description."
    return
  fi
  # "When" component: the description must contain an explicit trigger
  # phrase. This is heuristic but catches the common cases of describing
  # only the skill's scope without saying when to invoke it.
  local when_phrases='(Use when|Use at|Use after|Use before|Use during|Use to |Run when|Run at|Invoke when|Invoke during|Activated during|Activated when|Activates during|Activates when|Activate when|Trigger(s|ed)? (when|during|on)|Call when|Called during|Fires when)'
  if ! printf '%s' "$desc" | grep -qE "$when_phrases"; then
    fail "$file" "description-when" "no explicit trigger phrase" \
      "Add a 'when' component. Workflow skills: 'Use when...'. Cabinet members: 'Activated during audit/plan/execute...'. See $BEST_PRACTICES_DOC §Description."
    return
  fi
  pass "$file" "description" "${#desc} chars, $period_count sentences, has 'when'"
}

check_reference_depth() {
  local file="$1"
  local skill_dir
  skill_dir=$(dirname "$file")
  local body
  body=$(body_content "$file")
  # Extract markdown links to .md files: [text](target.md)
  local links
  links=$(printf '%s\n' "$body" | grep -oE '\[[^]]+\]\([^)]+\.md\)' | \
    grep -oE '\([^)]+\.md\)' | tr -d '()')

  local violation=""
  while IFS= read -r link; do
    [[ -z "$link" ]] && continue
    # Skip external URLs
    [[ "$link" =~ ^https?:// ]] && continue
    # Resolve relative to skill_dir
    local resolved
    case "$link" in
      /*) resolved="$link" ;;
      *) resolved="$skill_dir/$link" ;;
    esac
    # Only check files inside skill_dir
    case "$(cd "$(dirname "$resolved")" 2>/dev/null && pwd)" in
      "$(cd "$skill_dir" 2>/dev/null && pwd)"*) ;;
      *) continue ;;
    esac
    if [[ ! -f "$resolved" ]]; then
      continue
    fi
    # Read the referenced file and check for further .md links
    local nested
    nested=$(grep -oE '\[[^]]+\]\([^)]+\.md\)' "$resolved" 2>/dev/null | \
      grep -oE '\([^)]+\.md\)' | tr -d '()' | \
      grep -vE '^https?://' || true)
    if [[ -n "$nested" ]]; then
      # Check if any nested link points inside the same skill dir
      while IFS= read -r nested_link; do
        [[ -z "$nested_link" ]] && continue
        local nested_resolved
        case "$nested_link" in
          /*) nested_resolved="$nested_link" ;;
          *) nested_resolved="$(dirname "$resolved")/$nested_link" ;;
        esac
        if [[ -f "$nested_resolved" ]]; then
          local nested_dir
          nested_dir=$(cd "$(dirname "$nested_resolved")" 2>/dev/null && pwd)
          local sk_dir_abs
          sk_dir_abs=$(cd "$skill_dir" 2>/dev/null && pwd)
          if [[ "$nested_dir" == "$sk_dir_abs"* ]]; then
            violation="$link → $nested_link"
            break 2
          fi
        fi
      done <<< "$nested"
    fi
  done <<< "$links"

  if [[ -n "$violation" ]]; then
    fail "$file" "reference-depth" "$violation" \
      "Flatten — link the inner target directly from SKILL.md instead."
  else
    pass "$file" "reference-depth" "one level deep"
  fi
}

check_path_slashes() {
  local file="$1"
  local body
  body=$(body_content "$file")
  # Strip fenced code blocks (```…```) and indented code blocks before
  # checking — backslash usage inside code (regex, grep patterns, shell
  # escapes) is expected and not a path problem.
  local stripped
  stripped=$(printf '%s\n' "$body" | awk '
    BEGIN { in_fence = 0 }
    /^```/ { in_fence = !in_fence; next }
    in_fence { next }
    /^    / { next }  # indented code block
    { print }
  ')
  # Look for a Windows-style path fragment: word-chars, backslash,
  # word-chars, where the character after the backslash is NOT a common
  # escape letter (n, t, r, s, b, d, w, S, B, D, W).
  local hits
  hits=$(printf '%s\n' "$stripped" | grep -cE '[a-zA-Z0-9_-]+\\[a-mo-rt-vyzA-CE-Z][a-zA-Z]' || true)
  if [[ "$hits" -gt 0 ]]; then
    fail "$file" "path-slashes" "$hits backslash-path patterns" \
      "Use forward slashes; backslashes break on Unix."
  else
    pass "$file" "path-slashes" "forward slashes only"
  fi
}

check_cabinet_rules() {
  local file="$1" fm="$2"
  local ui
  ui=$(field_value "$fm" "user-invocable")
  if [[ "$ui" != "false" ]]; then
    warn "$file" "user-invocable" "'$ui' (expected 'false' for cabinet members)" \
      "Add 'user-invocable: false' to frontmatter."
  else
    pass "$file" "user-invocable" "false"
  fi
}

# --- main loop ------------------------------------------------------

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <SKILL.md> [<SKILL.md>...]" >&2
  exit 2
fi

for file in "$@"; do
  if [[ ! -f "$file" ]]; then
    printf '[FAIL] %s: file not found\n' "$file"
    FAILED=$((FAILED + 1))
    FAILED_FILES+=("$file")
    TOTAL=$((TOTAL + 1))
    continue
  fi

  TOTAL=$((TOTAL + 1))
  FILE_FAILED=0

  fm=$(extract_frontmatter "$file")

  if ! check_frontmatter "$file"; then
    FAILED=$((FAILED + 1))
    FAILED_FILES+=("$file")
    continue
  fi

  check_line_count "$file"
  check_name "$file" "$fm"
  check_description "$file" "$fm"
  check_reference_depth "$file"
  check_path_slashes "$file"

  basename=$(skill_dir_basename "$file")
  case "$basename" in
    cabinet-*)
      check_cabinet_rules "$file" "$fm"
      ;;
  esac

  if [[ "$FILE_FAILED" -eq 1 ]]; then
    FAILED=$((FAILED + 1))
    FAILED_FILES+=("$file")
  else
    PASSED=$((PASSED + 1))
  fi
done

echo
echo "---"
printf 'Checked: %d skill(s)\n' "$TOTAL"
printf 'Passed:  %d\n' "$PASSED"
printf 'Failed:  %d\n' "$FAILED"
if [[ "$FAILED" -gt 0 ]]; then
  echo
  echo "Failed files:"
  for f in "${FAILED_FILES[@]}"; do
    printf '  %s\n' "$f"
  done
  exit 1
fi
exit 0
