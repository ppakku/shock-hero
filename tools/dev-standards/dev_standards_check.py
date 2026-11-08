"""데이터라이즈 개발자 기준 검사 (dev-standards)

PR에서 새로 더한 줄만 검사한다. 이미 있는 코드는 막지 않고, 새로 늘어나는 것만 막는다.
원본: datarize-inhouse/dev-minsung-bot standards/ci/dev_standards_check.py
각 레포는 이 파일을 tools/dev-standards/에 그대로 복사해 쓴다. 고칠 때는 원본을 고치고 VERSION을 올린다.

사용: python3 tools/dev-standards/dev_standards_check.py [--base origin/main]
통과시키려면 그 줄이나 바로 윗줄에 `dev-standards: allow <규칙> <이유>` 주석을 단다. 이유가 없으면 통과하지 않는다.
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

VERSION = 2
CODE_EXT = {".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".kt"}
SKIP_PARTS = {"node_modules", "dist", "build", ".next", "vendor", "coverage", "__generated__", "generated", ".venv"}
TEST_RE = re.compile(r"(^|/)(tests?|__tests__|e2e|fixtures?|__mocks__)/|\.(test|spec|stories)\.[jt]sx?$|(^|/)test_[^/]*\.py$|_test\.py$|conftest\.py$")
GENERATED_RE = re.compile(r"(^|/)(db-types|database\.types|supabase\.types)\.ts$|\.gen\.|_pb2\.py$|\.d\.ts$|(^|/)(package-lock\.json|pnpm-lock\.yaml)$")
MAX_LINES = 1000

LOG_CALL = re.compile(r"\b(console\.(log|info|warn|error|debug)|logger\.\w+|logging\.\w+|log\.\w+|print)\s*\(")
PII_WORD = re.compile(r"(?i)\b\w*(email|e_mail|phone|mobile|tel_no|phone_number|resident|ssn|account_number|password|passwd|secret|token|주민|계좌|전화)\w*\b")
PII_SAFE = re.compile(r"(?i)mask|redact|hash|_id\b|Id\b|ids\b|count|len\(|length|domain|has_|is_|exists|valid|token_type|\bkind\b")

RULES = {
    "pii-log": "로그에 개인정보나 비밀값으로 보이는 값을 찍습니다. 식별자(id)만 남기거나 mask 함수를 쓰세요.",
    "naive-time": "시간대 없는 날짜입니다. 서버 시간대(UTC)에 따라 한국 날짜가 하루 어긋납니다. 시간대를 명시하세요.",
    "swallowed-error": "실패를 아무 기록 없이 삼킵니다. 최소한 로그나 알림을 남기세요.",
    "file-size": f"{MAX_LINES}줄 넘는 파일을 새로 만들거나 더 키웁니다. 책임별로 나누세요.",
}
NAIVE_TIME = [
    re.compile(r"\bdatetime\.now\(\s*\)"),
    re.compile(r"\bdatetime\.utcnow\("),
    re.compile(r"\bdate\.today\("),
    re.compile(r"toISOString\(\)\s*\.\s*(slice|substring|substr)\(\s*0\s*,\s*10\s*\)"),
    re.compile(r"toISOString\(\)\s*\.\s*split\(\s*['\"]T['\"]\s*\)"),
]
NAIVE_SAFE = re.compile(r"(?i)\butc\(|Date\.UTC|9\s*\*\s*3_?600|\bkst\b|tz=|tzinfo|timezone|ZoneInfo")
SWALLOW = [
    re.compile(r"catch\s*(\([^)]*\))?\s*\{\s*\}"),
    re.compile(r"\.catch\(\s*\(\s*\w*\s*\)\s*=>\s*\{\s*\}\s*\)"),
    re.compile(r"^\s*except(\s+(Exception|BaseException)(\s+as\s+\w+)?)?\s*:\s*(pass|continue)\s*$"),
]
ALLOW = re.compile(r"dev-standards:\s*allow\s+([\w-]+)\s+(\S.{2,})")


class GitError(RuntimeError):
    pass


def run(*args, must=False):
    r = subprocess.run(args, capture_output=True, text=True, check=False)
    if must and r.returncode != 0:
        raise GitError(f"{' '.join(args)} 실패: {r.stderr.strip()[:300]}")
    return r.stdout


def is_code(path):
    p = Path(path)
    return p.suffix in CODE_EXT and not any(part in SKIP_PARTS for part in p.parts) and "dev-standards" not in p.parts


def added_lines(base):
    """{파일: [(줄번호, 내용)]}: base 이후 더한 줄."""
    diff = run("git", "diff", "--unified=0", "--no-color", f"{base}...HEAD", must=True)
    out, cur, line_no = {}, None, 0
    for raw in diff.splitlines():
        if raw.startswith("+++ "):
            cur = raw[6:] if raw.startswith("+++ b/") else None
            continue
        if raw.startswith("@@"):
            m = re.search(r"\+(\d+)", raw)
            line_no = int(m.group(1)) if m else 0
            continue
        if cur and raw.startswith("+") and not raw.startswith("+++"):
            out.setdefault(cur, []).append((line_no, raw[1:]))
            line_no += 1
    return out


def allowed(rule, text, prev):
    for t in (text, prev):
        m = ALLOW.search(t or "")
        if m and m.group(1) in (rule, "all"):
            return True
    return False


STRING = re.compile(r"(\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|`(?:\\\\.|[^`\\\\])*`)")
INTERP = re.compile(r"\$\{([^}]*)\}|\{([^{}]*)\}")


def code_values(text):
    """문자열 글자는 지우고, 문자열 안에 끼워 넣는 값(f-string, 템플릿)과 바깥 코드만 남긴다."""
    def keep_interp(m):
        return " ".join(a or b for a, b in INTERP.findall(m.group(0)))
    return STRING.sub(keep_interp, text)


def check_line(path, text, prev):
    found = []
    stripped = text.strip()
    if stripped.startswith(("#", "//", "*", "/*")):
        return found
    values = code_values(text)
    if LOG_CALL.search(text) and PII_WORD.search(values) and not PII_SAFE.search(values):
        found.append("pii-log")
    if any(p.search(text) for p in NAIVE_TIME) and not NAIVE_SAFE.search(text):
        found.append("naive-time")
    py_bare = stripped in ("pass", "continue") and re.match(r"^\s*except(\s+(Exception|BaseException)(\s+as\s+\w+)?)?\s*:\s*$", prev or "")
    if any(p.search(text) for p in SWALLOW) or py_bare:
        found.append("swallowed-error")
    return [r for r in found if not allowed(r, text, prev)]


def file_lines(rev_path):
    text = run("git", "show", rev_path)
    return text.count("\n") + (1 if text and not text.endswith("\n") else 0) if text else 0


def check(base):
    problems = []
    for path, lines in added_lines(base).items():
        if not is_code(path) or not Path(path).exists():
            continue
        is_test = bool(TEST_RE.search(path))
        is_generated = bool(GENERATED_RE.search(path))
        content = Path(path).read_text(errors="ignore").splitlines()
        if not is_test:
            for no, text in lines:
                prev = content[no - 2] if no >= 2 and no - 2 < len(content) else ""
                for rule in check_line(path, text, prev):
                    problems.append((path, no, rule, text.strip()[:120]))
        after = len(content)
        before = file_lines(f"{base}:{path}")
        if not is_test and not is_generated and after > MAX_LINES and after > before and not any(allowed("file-size", t, "") for t in content[:5]):
            problems.append((path, 1, "file-size", f"{before} → {after}줄"))
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="origin/main")
    args = ap.parse_args(argv)
    try:
        problems = check(args.base)
    except GitError as e:
        print(f"dev-standards v{VERSION}: 비교 기준을 읽지 못해 검사하지 못했습니다. 통과로 치지 않습니다.\n{e}")
        return 2
    if not problems:
        print(f"dev-standards v{VERSION}: 새로 더한 코드에서 문제를 찾지 못했습니다.")
        return 0
    print(f"dev-standards v{VERSION}: {len(problems)}건\n")
    for path, no, rule, text in problems:
        print(f"{path}:{no} [{rule}] {RULES[rule]}\n    {text}")
    print("\n정말 필요한 줄이면 그 줄이나 바로 윗줄에 `dev-standards: allow <규칙> <이유>` 주석을 다세요.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
